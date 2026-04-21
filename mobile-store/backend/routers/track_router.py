from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import models, schemas, auth
from database import get_db

router = APIRouter(prefix="/api/track", tags=["track"])

@router.get("/", response_model=schemas.DeviceJourneyOut)
def track_device(identifier: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c", "technician"]))):
    try:
        stmt = db.query(models.DeviceInventory).filter(
            (models.DeviceInventory.imei == identifier) | 
            (models.DeviceInventory.serial_number == identifier)
        )
        
        # Admin/Technician bypass store filter, others only see their store
        if current_user.role not in ["admin", "technician"] and current_user.store_id:
            stmt = stmt.filter(models.DeviceInventory.store_id == current_user.store_id)
            
        device = stmt.first()
        
        if not device:
            raise HTTPException(status_code=404, detail="Device not found or access denied")
            
        logs = db.query(models.DeviceHistoryLog).filter(models.DeviceHistoryLog.imei == device.imei).order_by(models.DeviceHistoryLog.timestamp.asc()).all()
        ledger = db.query(models.DeviceCostLedger).filter(models.DeviceCostLedger.imei == device.imei).order_by(models.DeviceCostLedger.created_at.asc()).all()

        return {
            "device": device,
            "timeline": logs or [],
            "cost_ledger": ledger or []
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500, 
            detail={"detail": "Database Error", "message": str(e)}
        )
