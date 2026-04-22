import os
from jose import jwt
from datetime import datetime, timedelta
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas
from typing import Optional
import httpx

CLERK_PUBLISHABLE_KEY = os.getenv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY")
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")
# Extract frontend API from publishable key (e.g., pk_test_...)
CLERK_FRONTEND_API = CLERK_PUBLISHABLE_KEY.split("_")[2] if CLERK_PUBLISHABLE_KEY and len(CLERK_PUBLISHABLE_KEY.split("_")) > 2 else ""

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    
    # For local development without Clerk keys, fallback to a mock admin
    if not CLERK_PUBLISHABLE_KEY:
        return db.query(models.User).filter(models.User.role == models.RoleEnum.admin).first()

    try:
        # In a real production app, you should verify the token against Clerk's JWKS
        # and check the 'exp', 'iss', and 'aud' claims.
        payload = jwt.get_unverified_claims(token)
        clerk_id = payload.get("sub")
        
        if not clerk_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing sub claim")
            
        user = db.query(models.User).filter(models.User.clerk_id == clerk_id).first()
        if not user:
            # Auto-create user from Clerk if they don't exist? 
            # For now, we'll assume they must be in our DB.
            raise HTTPException(status_code=401, detail="User not found in local database")
        return user
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

def require_role(roles: list[str]):
    def role_checker(current_user: models.User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Operation not permitted")
        return current_user
    return role_checker
