from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import DeviceInventory, DeviceCatalog, DeviceCostLedger, User
from schemas import DeviceImportRequest
from auth import get_current_user
from datetime import datetime

router = APIRouter(prefix="/api/import", tags=["Import"])

@router.post("/auction-devices")
def import_auction_devices(req: DeviceImportRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    success_count = 0
    failed_count = 0
    errors = []
    
    # Pre-fetch catalog for faster lookup
    catalog = {c.model_number: c for c in db.query(DeviceCatalog).all()}
    
    # Pre-fetch existing IMEIs to avoid duplicates
    existing_imeis = {d.imei for d in db.query(DeviceInventory.imei).all()}
    
    new_devices = []
    ledger_entries = []
    
    for row in req.devices:
        if row.imei in existing_imeis:
            failed_count += 1
            errors.append(f"IMEI {row.imei} already exists")
            continue
            
        spec = catalog.get(row.model_number)
        
        device = DeviceInventory(
            imei=row.imei,
            model_number=row.model_number,
            brand=spec.brand if spec else "Unknown",
            model_name=spec.name if spec else "Unknown",
            storage=spec.storage if spec else "Unknown",
            color=spec.color if spec else "Unknown",
            condition=row.grade,
            device_status="In_QC",
            location="Warehouse",
            cost_basis=row.cost,
            org_id=getattr(current_user, 'current_org_id', None)
        )
        
        if not spec:
            errors.append(f"Model {row.model_number} not found in catalog - manual review required")
            
        new_devices.append(device)
        
        # Log to Cost Ledger
        ledger_entry = DeviceCostLedger(
            imei=row.imei,
            cost_type="Base_Acquisition",
            amount=row.cost,
            org_id=getattr(current_user, 'current_org_id', None)
        )
        ledger_entries.append(ledger_entry)
        
        success_count += 1
        existing_imeis.add(row.imei) # Prevent duplicates within the same batch

    # Optimized Bulk Insert
    if new_devices:
        db.bulk_save_objects(new_devices)
        db.bulk_save_objects(ledger_entries)
        db.commit()
        
    return {
        "success_count": success_count,
        "failed_count": failed_count,
        "errors": errors
    }

@router.post("/seed-catalog")
def seed_catalog(db: Session = Depends(get_db)):
    # Seed some common models for testing
    seeds = [
        DeviceCatalog(model_number="A2848", brand="Apple", name="iPhone 15", storage="128GB", color="Black"),
        DeviceCatalog(model_number="A2651", brand="Apple", name="iPhone 14 Pro", storage="256GB", color="Deep Purple"),
        DeviceCatalog(model_number="A2633", brand="Apple", name="iPhone 13", storage="128GB", color="Blue"),
        DeviceCatalog(model_number="A2482", brand="Apple", name="iPhone 13 Pro", storage="128GB", color="Sierra Blue"),
        DeviceCatalog(model_number="A2341", brand="Apple", name="iPhone 12 Pro", storage="128GB", color="Pacific Blue"),
    ]
    
    for s in seeds:
        if not db.query(DeviceCatalog).filter(DeviceCatalog.model_number == s.model_number).first():
            db.add(s)
    
    db.commit()
    return {"status": "success", "message": "Catalog seeded"}
