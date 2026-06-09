from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import models, schemas, auth
from database import get_db

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("", include_in_schema=False)
@router.get("/", response_model=List[schemas.PhoneModelOut])
def get_models(
    search: Optional[str] = Query(None),
    brand: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    q = db.query(models.PhoneModel).filter(
        models.PhoneModel.org_id == getattr(current_user, 'current_org_id', None)
    )
    if search:
        q = q.filter(
            models.PhoneModel.name.ilike(f"%{search}%") |
            models.PhoneModel.brand.ilike(f"%{search}%") |
            models.PhoneModel.model_number.ilike(f"%{search}%")
        )
    if brand:
        q = q.filter(models.PhoneModel.brand.ilike(f"%{brand}%"))
    return q.order_by(models.PhoneModel.brand, models.PhoneModel.name).all()


@router.get("/brands", response_model=List[str])
def get_brands(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    rows = db.query(models.PhoneModel.brand).filter(
        models.PhoneModel.org_id == getattr(current_user, 'current_org_id', None)
    ).distinct().order_by(models.PhoneModel.brand).all()
    return [r[0] for r in rows if r[0]]


@router.get("/{model_number}", response_model=schemas.PhoneModelOut)
def get_model(
    model_number: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    db_model = db.query(models.PhoneModel).filter(
        models.PhoneModel.model_number == model_number,
        models.PhoneModel.org_id == getattr(current_user, 'current_org_id', None),
    ).first()
    if not db_model:
        raise HTTPException(status_code=404, detail="Model not found")
    return db_model


@router.post("/", response_model=schemas.PhoneModelOut)
def create_model(
    model: schemas.PhoneModelCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin"])),
):
    existing = db.query(models.PhoneModel).filter(
        models.PhoneModel.model_number == model.model_number,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Model with that number already exists")
    db_model = models.PhoneModel(**model.model_dump())
    db_model.org_id = getattr(current_user, 'current_org_id', None)
    db.add(db_model)
    try:
        db.commit()
        db.refresh(db_model)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to create model")
    return db_model


@router.put("/{model_number}", response_model=schemas.PhoneModelOut)
def update_model(
    model_number: str,
    model: schemas.PhoneModelCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin"])),
):
    db_model = db.query(models.PhoneModel).filter(
        models.PhoneModel.model_number == model_number,
        models.PhoneModel.org_id == getattr(current_user, 'current_org_id', None),
    ).first()
    if not db_model:
        raise HTTPException(status_code=404, detail="Model not found")
    db_model.brand = model.brand
    db_model.name = model.name
    db_model.color = model.color
    db_model.storage_gb = model.storage_gb
    # If model_number changed, check uniqueness
    if model.model_number != model_number:
        existing = db.query(models.PhoneModel).filter(
            models.PhoneModel.model_number == model.model_number,
            models.PhoneModel.model_number != model_number,
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Target model number already exists")
        db_model.model_number = model.model_number
    db.commit()
    db.refresh(db_model)
    return db_model


@router.delete("/{model_number}")
def delete_model(
    model_number: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin"])),
):
    db_model = db.query(models.PhoneModel).filter(
        models.PhoneModel.model_number == model_number,
        models.PhoneModel.org_id == getattr(current_user, 'current_org_id', None),
    ).first()
    if not db_model:
        raise HTTPException(status_code=404, detail="Model not found")
    device_count = db.query(models.DeviceInventory).filter(
        models.DeviceInventory.model_number == model_number,
    ).count()
    if device_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete: {device_count} devices reference this model")
    db.delete(db_model)
    db.commit()
    return {"status": "deleted"}
