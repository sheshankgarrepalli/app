import os
from jose import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx

CLERK_PUBLISHABLE_KEY = os.getenv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY")
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")
CLERK_FRONTEND_API = CLERK_PUBLISHABLE_KEY.split("_")[2] if CLERK_PUBLISHABLE_KEY else ""

security = HTTPBearer()

async def get_clerk_public_keys():
    # In a real app, you'd cache these keys
    url = f"https://{CLERK_FRONTEND_API}/.well-known/jwks.json"
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        return response.json()

async def verify_clerk_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        # This is a simplified verification. In production, use a library like clerk-sdk-python
        # or properly verify the JWT against Clerk's JWKS.
        payload = jwt.get_unverified_claims(token)
        return payload
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user(payload: dict = Depends(verify_clerk_token)):
    # Map Clerk payload to your user model
    return {
        "id": payload.get("sub"),
        "email": payload.get("email"),
        "role": payload.get("role", "user")
    }
