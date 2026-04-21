from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models, schemas, auth
from database import get_db

router = APIRouter(prefix="/api/admin", tags=["Admin"])

@router.get("/rates", response_model=List[schemas.LaborRateConfigOut])
def get_rates(db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role(["admin"]))):
    return db.query(models.LaborRateConfig).all()

@router.put("/rates/upsert", response_model=schemas.LaborRateConfigOut)
def upsert_rate(req: schemas.LaborRateConfigBase, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role(["admin"]))):
    try:
        rate = db.query(models.LaborRateConfig).filter(models.LaborRateConfig.action_name == req.action_name).first()
        if rate:
            rate.fee_amount = req.fee_amount
        else:
            rate = models.LaborRateConfig(action_name=req.action_name, fee_amount=req.fee_amount)
            db.add(rate)
        db.commit()
        db.refresh(rate)
        return rate
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/users", response_model=List[schemas.UserOut])
def get_users(db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role(["admin"]))):
    try:
        return db.query(models.User).all()
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500, 
            detail={"detail": "Database Error", "message": str(e)}
        )

@router.post("/users", response_model=schemas.UserOut)
def create_user(req: schemas.UserCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role(["admin"]))):
    if db.query(models.User).filter(models.User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = models.User(
        email=req.email,
        password_hash=auth.get_password_hash(req.password),
        role=req.role,
        store_id=req.store_id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.get("/stores", response_model=List[schemas.StoreLocationOut])
def get_stores(db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c", "technician"]))):
    try:
        return db.query(models.StoreLocation).all()
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500, 
            detail={"detail": "Database Error", "message": str(e)}
        )

@router.post("/stores", response_model=schemas.StoreLocationOut)
def create_store(req: schemas.StoreLocationCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role(["admin"]))):
    if db.query(models.StoreLocation).filter(models.StoreLocation.id == req.id).first():
        raise HTTPException(status_code=400, detail="Store ID already exists")
    
    new_store = models.StoreLocation(id=req.id, name=req.name, address=req.address)
    db.add(new_store)
    db.commit()
    db.refresh(new_store)
    return new_store

@router.post("/rates/seed")
def seed_rates(db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role(["admin"]))):
    defaults = [
        ('QC_Standard', 5.0),
        ('Repair_Screen', 15.0),
        ('Repair_Battery', 10.0),
        ('Repair_Standard', 12.0)
    ]
    for name, fee in defaults:
        if not db.query(models.LaborRateConfig).filter(models.LaborRateConfig.action_name == name).first():
            db.add(models.LaborRateConfig(action_name=name, fee_amount=fee))
    db.commit()
    return {"status": "success"}
