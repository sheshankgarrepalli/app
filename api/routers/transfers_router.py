from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import models, schemas, auth
import wms_core
from database import get_db

router = APIRouter(prefix="/api/transfers", tags=["transfers"])

@router.post("/bulk-route")
def bulk_route_devices(req: schemas.BulkRouteRequest, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    success_count = 0
    errors = []
    
    for imei in req.imeis:
        device = db.query(models.DeviceInventory).filter(models.DeviceInventory.imei == imei).first()
        if not device:
            errors.append(f"IMEI {imei} not found")
            continue
            
        old_status = device.device_status
        device.device_status = req.destination
        
        # Audit Log
        log = models.DeviceHistoryLog(
            imei=imei,
            action_type="Bulk Transfer Dispatch",
            employee_id=current_user.email,
            previous_status=old_status,
            new_status=req.destination,
            notes=f"Routed to {req.destination}. Defects: {', '.join(req.defects)}. {req.notes}"
        )
        db.add(log)
        success_count += 1
        
    db.commit()
    return {"success_count": success_count, "errors": errors}

@router.post("/bulk-receive")
def bulk_receive_devices(req: schemas.BulkReceiveRequest, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    success_count = 0
    errors = []
    
    for imei in req.imeis:
        device = db.query(models.DeviceInventory).filter(models.DeviceInventory.imei == imei).first()
        if not device:
            errors.append(f"IMEI {imei} not found")
            continue
            
        old_status = device.device_status
        new_status = ""
        
        if old_status == models.DeviceStatus.Transit_to_Repair:
            new_status = models.DeviceStatus.In_Repair
            # Activate Repair Ticket
            ticket = db.query(models.RepairTicket).filter(models.RepairTicket.imei == imei, models.RepairTicket.status == models.RepairStatus.Pending).first()
            if ticket:
                ticket.status = models.RepairStatus.In_Progress
        elif old_status == models.DeviceStatus.Transit_to_Main_Bin:
            new_status = models.DeviceStatus.Sellable
        elif old_status == models.DeviceStatus.Transit_to_QC:
            new_status = models.DeviceStatus.In_QC
            # Log QC Labor Fee
            qc_rate = db.query(models.LaborRateConfig).filter(models.LaborRateConfig.action_name == 'QC_Standard').first()
            if qc_rate:
                ledger_entry = models.DeviceCostLedger(
                    imei=imei,
                    cost_type="QC Labor",
                    amount=qc_rate.fee_amount
                )
                db.add(ledger_entry)
                device.cost_basis += qc_rate.fee_amount
        else:
            errors.append(f"IMEI {imei} is not in a transit state ({old_status})")
            continue
            
        device.device_status = new_status
        
        # Audit Log
        log = models.DeviceHistoryLog(
            imei=imei,
            action_type="Inventory Receipt",
            employee_id=current_user.email,
            previous_status=old_status,
            new_status=new_status,
            notes=f"Acknowledged receipt. Status moved to {new_status}. {req.notes}"
        )
        db.add(log)
        success_count += 1
        
    db.commit()
    return {"success_count": success_count, "errors": errors}

@router.post("/")
def create_transfer(transfer: schemas.TransferOrderCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role(["admin"]))):
    try:
        to_id = wms_core.create_transfer_order(db, transfer.imei_list, transfer.destination_location_id, transfer.transfer_type, current_user.email)
        return {"transfer_order_id": to_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{transfer_order_id}/receive")
def receive_transfer(transfer_order_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))):
    try:
        received = wms_core.receive_transfer_order(db, transfer_order_id, current_user.email)
        return {"message": "Received successfully", "imeis": received}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/")
def get_transfers(db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))):
    if current_user.role == "admin":
        orders = db.query(models.TransferOrder).all()
    else:
        orders = db.query(models.TransferOrder).filter(models.TransferOrder.destination_location_id == current_user.role).all()
        
    return orders
