from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import models, schemas, auth
from database import get_db

router = APIRouter(prefix="/api/models", tags=["models"])

def normalize_device_model(raw_model: str) -> str:
    if not raw_model:
        return raw_model
    raw_model = raw_model.strip()
    if not raw_model:
        return raw_model
        
    first_char = raw_model[0].upper()
    if first_char in ['F', 'N', 'P', 'G']:
        raw_model = 'M' + raw_model[1:]
        
    return raw_model[:5].upper()

@router.get("", include_in_schema=False)
@router.get("/", response_model=List[schemas.PhoneModelOut])
def get_models(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.PhoneModel).filter(
        models.PhoneModel.org_id == getattr(current_user, 'current_org_id', None)
    ).all()

@router.get("/{model_number}", response_model=schemas.PhoneModelOut)
def get_model(model_number: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    model_number = normalize_device_model(model_number)
    db_model = db.query(models.PhoneModel).filter(
        models.PhoneModel.model_number == model_number,
        models.PhoneModel.org_id == getattr(current_user, 'current_org_id', None)
    ).first()
    if not db_model:
        raise HTTPException(status_code=404, detail="Model not found")
    return db_model

@router.post("/", response_model=schemas.PhoneModelOut)
def create_model(model: schemas.PhoneModelCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))):
    db_model = models.PhoneModel(**model.model_dump())
    db_model.org_id = getattr(current_user, 'current_org_id', None)
    db.add(db_model)
    try:
         db.commit()
         db.refresh(db_model)
    except Exception:
         db.rollback()
         raise HTTPException(status_code=400, detail="Model might already exist")
    return db_model
