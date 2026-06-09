from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import models, schemas, auth
from database import get_db
import re

router = APIRouter(prefix="/api/models", tags=["models"])


def infer_device_type(name: str) -> str:
    n = name.lower()
    for kw in ["iphone", "galaxy", "pixel", "oneplus", "xiaomi", "motorola", "nokia", "moto"]:
        if kw in n: return "Phone"
    for kw in ["ipad", "tablet", "tab"]:
        if kw in n: return "Tablet"
    for kw in ["macbook", "imac", "mac mini", "mac pro", "mac"]:
        if kw in n: return "Laptop"
    for kw in ["watch"]:
        if kw in n: return "Watch"
    for kw in ["nintendo", "playstation", "xbox", "ps5"]:
        if kw in n: return "Console"
    for kw in ["airpods", "pencil", "keyboard", "mouse", "trackpad", "homepod", "airtag", "beats", "case", "charger", "cable", "adapter"]:
        if kw in n: return "Accessory"
    return "Other"


@router.get("", include_in_schema=False)
@router.get("/", response_model=List[schemas.PhoneModelOut])
def get_models(
    search: Optional[str] = Query(None),
    brand: Optional[str] = Query(None),
    device_type: Optional[str] = Query(None),
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
    if device_type:
        # Filter by inferred device type from the model name
        name_conditions = []
        dt = device_type.lower()
        if dt == "phone":
            name_conditions.append(models.PhoneModel.name.ilike("%iphone%"))
            name_conditions.append(models.PhoneModel.name.ilike("%galaxy%"))
            name_conditions.append(models.PhoneModel.name.ilike("%pixel%"))
            name_conditions.append(models.PhoneModel.name.ilike("%moto%"))
            name_conditions.append(models.PhoneModel.name.ilike("%oneplus%"))
            name_conditions.append(models.PhoneModel.name.ilike("%nokia%"))
            name_conditions.append(models.PhoneModel.name.ilike("%xiaomi%"))
        elif dt == "tablet":
            name_conditions.append(models.PhoneModel.name.ilike("%ipad%"))
            name_conditions.append(models.PhoneModel.name.ilike("%tab%"))
        elif dt == "laptop":
            name_conditions.append(models.PhoneModel.name.ilike("%macbook%"))
            name_conditions.append(models.PhoneModel.name.ilike("%imac%"))
            name_conditions.append(models.PhoneModel.name.ilike("%mac%"))
        elif dt == "watch":
            name_conditions.append(models.PhoneModel.name.ilike("%watch%"))
        elif dt == "console":
            name_conditions.append(models.PhoneModel.name.ilike("%nintendo%"))
            name_conditions.append(models.PhoneModel.name.ilike("%playstation%"))
            name_conditions.append(models.PhoneModel.name.ilike("%xbox%"))
        elif dt == "accessory":
            name_conditions.append(models.PhoneModel.name.ilike("%airpods%"))
            name_conditions.append(models.PhoneModel.name.ilike("%pencil%"))
            name_conditions.append(models.PhoneModel.name.ilike("%keyboard%"))
            name_conditions.append(models.PhoneModel.name.ilike("%mouse%"))
            name_conditions.append(models.PhoneModel.name.ilike("%homepod%"))
            name_conditions.append(models.PhoneModel.name.ilike("%airtag%"))
            name_conditions.append(models.PhoneModel.name.ilike("%beats%"))
        if name_conditions:
            from sqlalchemy import or_
            q = q.filter(or_(*name_conditions))
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


# ── Helper: reconstruct model_number from device column ─────────────────────

KNOWN_BRANDS = ["Apple", "Samsung", "Motorola", "Google", "OnePlus", "Nokia", "Xiaomi", "Oppo", "Huawei", "LG", "Sony"]


def detect_brand_and_name(raw_name: str):
    name = raw_name.strip()
    for brand in KNOWN_BRANDS:
        prefix = brand + " "
        if name.lower().startswith(prefix.lower()):
            return brand, name
    parts = name.split(" ", 1)
    if len(parts) == 2 and parts[0] in KNOWN_BRANDS:
        return parts[0], name
    return name, name


def infer_brand_from_model_number(mn: str) -> str:
    mn_lower = mn.lower()
    brand_keywords = {
        "Apple": ["iphone", "ipad", "macbook", "imac", "mac mini", "mac pro", "watch", "airpods"],
        "Samsung": ["galaxy", "z flip", "z fold"],
        "Motorola": ["moto", "razr"],
        "Google": ["pixel"],
    }
    for brand, keywords in brand_keywords.items():
        for kw in keywords:
            if kw in mn_lower:
                return brand
    return ""


def generate_model_number(display_name: str, storage_gb: int) -> str:
    if storage_gb > 0:
        return f"{display_name} - {storage_gb}GB"
    return display_name


@router.post("/sync-from-inventory")
def sync_catalog_from_inventory(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin"])),
):
    """Rebuild the catalog from existing device_inventory entries — fill in ANY missing or inconsistent model records."""
    org_id = getattr(current_user, 'current_org_id', None)
    devices = db.query(models.DeviceInventory).all()
    created = 0
    updated = 0

    for device in devices:
        if not device.model_number:
            continue
        mn = device.model_number

        # Check if a model record exists
        existing = db.query(models.PhoneModel).filter(
            models.PhoneModel.model_number == mn,
        ).first()

        if existing:
            # Update if brand/name is empty or looks wrong
            needs_fix = False
            if not existing.brand or not existing.name or existing.name != existing.model_number:
                needs_fix = True
            if needs_fix:
                brand = infer_brand_from_model_number(mn) or existing.brand or "Unknown"
                name = mn.split(" - ")[0] if " - " in mn else mn
                existing.brand = brand
                existing.name = name
                existing.org_id = org_id
                updated += 1
        else:
            brand = infer_brand_from_model_number(mn) or "Unknown"
            name = mn.split(" - ")[0] if " - " in mn else mn
            pm = models.PhoneModel(
                model_number=mn,
                brand=brand,
                name=name,
                storage_gb=0,
                org_id=org_id,
            )
            db.add(pm)
            created += 1

    db.commit()
    return {"created": created, "updated": updated, "message": f"Catalog synced: {created} created, {updated} updated"}
