from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

import models
from auth import (
    get_current_user, require_role,
    hash_password, verify_password, create_access_token,
)
from database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    id: int
    email: str
    role: str
    store_id: Optional[str]
    is_active: bool
    created_at: datetime
    last_login_at: Optional[datetime]

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    role: str = "store"
    store_id: Optional[str] = None


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    store_id: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=8)


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == req.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    if not user.password_hash or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.email, user.role.value)
    return TokenResponse(
        access_token=token,
        user=UserOut.model_validate(user),
    )


@router.post("/logout")
def logout(current_user: models.User = Depends(get_current_user)):
    return {"status": "logged_out"}


@router.get("/me", response_model=UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.get("/users", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role(["admin"])),
):
    return db.query(models.User).order_by(models.User.created_at.desc()).all()


@router.post("/users", response_model=UserOut)
def create_user(
    req: UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role(["admin"])),
):
    if req.role not in models.RoleEnum.__members__:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {list(models.RoleEnum.__members__)}")

    existing = db.query(models.User).filter(models.User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with that email already exists")

    user = models.User(
        email=req.email,
        role=models.RoleEnum(req.role),
        store_id=req.store_id,
        password_hash=hash_password(req.password),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    req: UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role(["admin"])),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if req.role is not None:
        if req.role not in models.RoleEnum.__members__:
            raise HTTPException(status_code=400, detail="Invalid role")
        user.role = models.RoleEnum(req.role)
    if req.email is not None:
        user.email = req.email
    if req.store_id is not None:
        user.store_id = req.store_id
    if req.is_active is not None:
        user.is_active = req.is_active
    if req.password is not None:
        user.password_hash = hash_password(req.password)

    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role(["admin"])),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"status": "deleted"}


TokenResponse.model_rebuild()
