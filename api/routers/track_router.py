from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import models, schemas, auth
from database import get_db

router = APIRouter(prefix="/api/track", tags=["track"])

@router.get("/", response_model=schemas.DeviceJourneyOut)
def track_device(identifier: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role(["admin", "warehouse", "store", "technician"]))):
    try:
        org_id = getattr(current_user, 'current_org_id', None)
        stmt = db.query(models.DeviceInventory).filter(
            (models.DeviceInventory.imei == identifier) |
            (models.DeviceInventory.serial_number == identifier)
        )

        # Also try phone number lookup via customer records
        phone_matched = False
        if org_id:
            stmt = stmt.filter(models.DeviceInventory.org_id == org_id)

        device = stmt.first()

        if not device:
            # Try phone number lookup through customer records
            if org_id:
                customers = db.query(models.UnifiedCustomer).filter(
                    models.UnifiedCustomer.phone == identifier,
                    models.UnifiedCustomer.org_id == org_id
                ).all()
            else:
                customers = db.query(models.UnifiedCustomer).filter(
                    models.UnifiedCustomer.phone == identifier
                ).all()

            if customers:
                for customer in customers:
                    devices = db.query(models.DeviceInventory).filter(
                        models.DeviceInventory.sold_to_crm_id == customer.crm_id,
                        models.DeviceInventory.org_id == org_id
                    ).all()
                    if devices:
                        phone_matched = True
                        # Return all devices for this customer
                        results = []
                        for dev in devices:
                            logs = db.query(models.DeviceHistoryLog).filter(
                                models.DeviceHistoryLog.imei == dev.imei
                            ).order_by(models.DeviceHistoryLog.timestamp.asc()).all()
                            ledger = db.query(models.DeviceCostLedger).filter(
                                models.DeviceCostLedger.imei == dev.imei
                            ).order_by(models.DeviceCostLedger.created_at.asc()).all()
                            results.append({
                                "device": dev,
                                "timeline": logs or [],
                                "cost_ledger": ledger or []
                            })
                        if results:
                            return results[0]

            if not phone_matched:
                raise HTTPException(status_code=404, detail="Device not found")

        # Admin/Technician bypass store filter, others only see their store
        if current_user.role not in ["admin", "technician"] and current_user.store_id:
            if device and device.store_id != current_user.store_id:
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
