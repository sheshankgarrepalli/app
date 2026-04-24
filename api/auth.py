import sys
import base64
import jwt
import httpx
from typing import Optional, List, Dict
from fastapi import Depends, HTTPException, status, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicKey
from jwt.algorithms import RSAAlgorithm

from database import get_db
import models
from config import settings

# --- CLERK AUTHENTICATION CONFIG ---
security = HTTPBearer()

# Global cache to prevent redundant JWKS fetches
JWKS_CACHE: Dict[str, dict] = {}
JWKS_URL: Optional[str] = None

def get_jwks_url():
    """Extracts the JWKS URL from the Clerk Publishable Key."""
    try:
        pk = settings.VITE_CLERK_PUBLISHABLE_KEY
        if not pk:
            print("CRITICAL AUTH ERROR: VITE_CLERK_PUBLISHABLE_KEY is not set.", file=sys.stderr)
            return None
            
        prefix = "pk_test_" if pk.startswith("pk_test_") else "pk_live_" if pk.startswith("pk_live_") else ""
        if not prefix:
            return None
            
        encoded_part = pk.replace(prefix, "")
        missing_padding = len(encoded_part) % 4
        if missing_padding:
            encoded_part += "=" * (4 - missing_padding)
            
        decoded = base64.b64decode(encoded_part).decode('utf-8')
        # Cleanly combine the domain and path, removing any rogue $ characters
        domain = decoded.strip().rstrip("$").rstrip("/")
        jwks_url = f"https://{domain}/.well-known/jwks.json"
        return jwks_url
    except Exception as e:
        print(f"CRITICAL AUTH ERROR: Failed to parse JWKS URL: {str(e)}", file=sys.stderr)
        return None

async def fetch_jwks():
    """Asynchronously fetches the JWKS from Clerk and caches the keys."""
    global JWKS_CACHE, JWKS_URL
    if not JWKS_URL:
        JWKS_URL = get_jwks_url()
    
    if not JWKS_URL:
        raise Exception("JWKS URL could not be resolved.")

    try:
        print(f"DEBUG: Fetching JWKS from {JWKS_URL}", file=sys.stderr)
        async with httpx.AsyncClient() as client:
            response = await client.get(JWKS_URL, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            
            # Map keys by their kid (Key ID) for fast lookup
            new_cache = {key["kid"]: key for key in data.get("keys", [])}
            JWKS_CACHE = new_cache
            print(f"DEBUG: JWKS Cache updated. Keys found: {list(JWKS_CACHE.keys())}", file=sys.stderr)
    except Exception as e:
        print(f"CRITICAL AUTH ERROR: Failed to fetch JWKS: {str(e)}", file=sys.stderr)
        raise

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
    db: Session = Depends(get_db)
) -> models.User:
    """
    Asynchronous dependency to verify Clerk JWT using httpx to bypass Vercel socket issues.
    """
    token = credentials.credentials
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")

    try:
        # 1. Get Key ID (kid) from unverified header
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        if not kid:
            raise Exception("Token header missing 'kid'")

        # 2. Ensure JWKS Cache is populated
        if kid not in JWKS_CACHE:
            await fetch_jwks()
            if kid not in JWKS_CACHE:
                raise Exception(f"Key with kid {kid} not found in JWKS")

        # 3. Construct Public Key
        jwk_data = JWKS_CACHE[kid]
        public_key = RSAAlgorithm.from_jwk(jwk_data)

        # 4. Decode and Verify
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={"verify_exp": True}
        )
        
        clerk_id = payload.get("sub")
        if not clerk_id:
            raise Exception("Token missing 'sub' (Clerk ID) claim")

        email = payload.get("email") or payload.get("sub")
        
        # 5. Extract Metadata and Sync to DB
        public_metadata = payload.get("public_metadata", {})
        # Some Clerk configurations put metadata in a top-level 'metadata' claim
        private_metadata = payload.get("metadata", {})
        
        role = public_metadata.get("role") or private_metadata.get("role") or "store_a"
        store_id = public_metadata.get("store_id") or private_metadata.get("store_id")
        org_id = payload.get("org_id")

        # Database operations are blocking; in a high-traffic app, use an async driver.
        # Here we rely on FastAPI's handling of async dependencies.
        # Primary lookup by clerk_id
        user = db.query(models.User).filter(models.User.clerk_id == clerk_id).first()
        
        # Fallback to email if clerk_id not yet set for an existing legacy user
        if not user:
            user = db.query(models.User).filter(models.User.email == email).first()

        if not user:
            print(f"AUTH INFO: Provisioning local user {email} (Clerk ID: {clerk_id})", file=sys.stderr)
            user = models.User(
                clerk_id=clerk_id,
                email=email,
                role=models.RoleEnum(role) if role in models.RoleEnum.__members__ else models.RoleEnum.store_a,
                store_id=store_id
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            # Anti-demotion safeguard: Extract and log the role from the token
            token_role = role
            print(f"DEBUG: Clerk token role for {email}: {token_role}", file=sys.stderr)
            
            # Sync clerk_id if it was missing (legacy user)
            updated = False
            if user.clerk_id != clerk_id:
                user.clerk_id = clerk_id
                updated = True
            
            # Prevent demoting an existing admin if the token role is different/lower
            if user.role.value == "admin" and token_role != "admin" and token_role != "owner":
                print(f"AUTH INFO: Preserving DB admin status for {email}. Ignoring Clerk role '{token_role}'.", file=sys.stderr)
            elif user.role.value != role or user.store_id != store_id:
                print(f"AUTH INFO: Syncing roles for {email}. Token role: {token_role}", file=sys.stderr)
                user.role = models.RoleEnum(role) if role in models.RoleEnum.__members__ else models.RoleEnum.store_a
                user.store_id = store_id
                updated = True
            
            if updated:
                db.commit()
                db.refresh(user)

        # Attach current org_id dynamically to the user context
        user.current_org_id = org_id
        
        return user

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as e:
        print(f"CRITICAL AUTH FAILURE: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

def require_role(roles: List[str]):
    """Dependency factory for role-based access control."""
    def role_checker(current_user: models.User = Depends(get_current_user)):
        if current_user.role.value not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return role_checker
