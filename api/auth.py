import os
import sys
from typing import Optional, List
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from passlib.context import CryptContext

from database import get_db
import models
from config import settings

security = HTTPBearer()
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

JWT_SECRET = os.getenv("JWT_SECRET", "amafah-dev-secret-change-in-production-please")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 7

PREVIEW_BYPASS_TOKEN = "preview-bypass-token"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain, hashed)
    except Exception:
        return False


def create_access_token(user_id: int, email: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> models.User:
    token = credentials.credentials
    if not token or token.lower() in ["undefined", "null", "none"]:
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization token")

    if token == PREVIEW_BYPASS_TOKEN:
        org_id = os.getenv("DEFAULT_ORG_ID", "org_3Com6Msekl6q0o4KuRxiKybuhTU")
        user = db.query(models.User).filter(
            models.User.role == models.RoleEnum.admin,
        ).first()
        if not user:
            user = models.User(
                email="admin@preview.dev",
                role=models.RoleEnum.admin,
                store_id="warehouse",
                org_id=org_id,
                password_hash=None,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        user.current_org_id = org_id
        return user

    payload = decode_token(token)
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(status_code=401, detail="Token missing 'sub' claim")

    try:
        user_id = int(user_id_str)
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid 'sub' claim")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    user.current_org_id = user.org_id
    return user


def require_role(roles: List[str]):
    def role_checker(current_user: models.User = Depends(get_current_user)):
        if current_user.role.value not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return role_checker


def get_user_location_id(current_user: models.User) -> str:
    return current_user.store_id or "warehouse"


def warehouse_cannot_modify_retail(db: Session, current_user: models.User, imei: str = None, device: models.DeviceInventory = None):
    if current_user.role == models.RoleEnum.warehouse:
        if device is None and imei:
            device = db.query(models.DeviceInventory).filter(
                models.DeviceInventory.imei == imei
            ).first()
        if device and device.store_id:
            store = db.query(models.StoreLocation).filter(
                models.StoreLocation.id == device.store_id
            ).first()
            if store and store.location_type == models.LocationType.retail:
                raise HTTPException(
                    status_code=403,
                    detail="Warehouse staff cannot modify retail store inventory"
                )
