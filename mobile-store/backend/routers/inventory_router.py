from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import models, schemas, auth
import wms_core
from database import get_db
from datetime import datetime

router = APIRouter(prefix="/api/inventory", tags=["inventory"])

@router.post("/central/fast-receive", response_model=schemas.DeviceInventoryOut)
def fast_receive(request: schemas.FastReceiveRequest, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role(["admin"]))):
    db_model = db.query(models.PhoneModel).filter(models.PhoneModel.model_number == request.inventory.model_number).first()
    if not db_model:
        if request.phone_model:
            db_model = models.PhoneModel(**request.phone_model.model_dump())
            db.add(db_model)
            db.commit()
            db.refresh(db_model)
        else:
            raise HTTPException(status_code=404, detail="Model not found and no on-the-fly model provided")
            
    existing = db.query(models.DeviceInventory).filter(models.DeviceInventory.imei == request.inventory.imei).first()
    if existing:
        raise HTTPException(status_code=400, detail="IMEI already exists in system")
        
    db_inventory = models.DeviceInventory(
        imei=request.inventory.imei,
        serial_number=request.inventory.serial_number,
        model_number=request.inventory.model_number,
        location_id=request.location_id,
        sub_location_bin="Receiving_Bay",
        cost_basis=request.inventory.cost_basis or 0.0
    )
    db.add(db_inventory)
    
    # Log the receipt
    wms_core._log_history(db, request.inventory.imei, "Received", current_user.email, "Sellable", None, "Fast Received")
    
    db.commit()
    db.refresh(db_inventory)
    return db_inventory

@router.get("/central", response_model=List[schemas.DeviceInventoryOut])
def get_central_inventory(db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role(["admin"]))):
    # Admins can see global central inventory, but we'll filter by Warehouse_Alpha by default
    return db.query(models.DeviceInventory).filter(models.DeviceInventory.location_id == "Warehouse_Alpha").all()

@router.get("/store", response_model=List[schemas.DeviceInventoryOut])
def get_store_inventory(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        stmt = db.query(models.DeviceInventory)
        
        # Admin OR user with null store_id bypasses the filter
        if current_user.role == "admin" or not current_user.store_id:
            return stmt.filter(models.DeviceInventory.location_id != "Warehouse_Alpha").all()
            
        # Store-level employees only see their assigned store
        return stmt.filter(models.DeviceInventory.store_id == current_user.store_id).all()
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500, 
            detail={"detail": "Database Error", "message": str(e)}
        )
        
@router.post("/routing", response_model=schemas.DeviceInventoryOut)
def route_device_internally(
    request: schemas.InternalRoutingRequest, 
    imei: str, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))
):
    try:
        wms_core.update_device_internal_status(db, imei, request.new_bin, request.new_status, current_user.email)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    return db.query(models.DeviceInventory).filter(models.DeviceInventory.imei == imei).first()

@router.post("/repair/assign", response_model=schemas.DeviceInventoryOut)
def assign_repair(
    request: schemas.RepairAssignmentRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin"]))
):
    try:
        device = wms_core.assign_to_repair(db, request.imei, request.technician_id, current_user.email)
        return device
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/repair/{imei}/complete", response_model=schemas.DeviceInventoryOut)
def complete_repair(
    imei: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin", "technician"]))
):
    try:
        device = wms_core.complete_repair(db, imei, current_user.email)
        return device
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/technicians", response_model=List[schemas.UserOut])
def get_technicians(db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role(["admin"]))):
    return db.query(models.User).filter(models.User.role == models.RoleEnum.technician).all()

@router.post("/rapid-audit", response_model=schemas.AuditReportResponse)
def rapid_audit(
    request: schemas.BulkReceiveRequest, # Reusing schema with List[str] imeis
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Determine location_id from current_user
    location_id = current_user.store_id or "Warehouse_Alpha"
    
    # Audit logic: Compare scanned vs expected (Sellable or In_QC)
    try:
        expected_devices = db.query(models.DeviceInventory).filter(
            models.DeviceInventory.location_id == location_id,
            models.DeviceInventory.device_status.in_([models.DeviceStatus.Sellable, models.DeviceStatus.In_QC])
        ).all()
        
        expected_set = {d.imei for d in expected_devices}
        scanned_set = set(request.imeis)
        
        matched_set = expected_set & scanned_set
        missing_set = expected_set - scanned_set
        unexpected_set = scanned_set - expected_set
        
        missing_payload = []
        for imei in missing_set:
            last_log = db.query(models.DeviceHistoryLog).filter(models.DeviceHistoryLog.imei == imei).order_by(models.DeviceHistoryLog.timestamp.desc()).first()
            missing_payload.append({
                "imei": imei,
                "last_employee": last_log.employee_id if last_log else "Unknown",
                "last_action": last_log.action_type if last_log else "Unknown",
                "last_timestamp": last_log.timestamp if last_log else datetime.utcnow()
            })
            
        return {
            "matched": list(matched_set),
            "missing": missing_payload,
            "unexpected": list(unexpected_set)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/audit/reconcile", response_model=schemas.AuditReportResponse)
def audit_reconcile(
    request: schemas.AuditReconciliationRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))
):
    try:
        report = wms_core.generate_audit_report(db, request.location_id, request.scanned_imeis_list)
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/audit/finalize")
def audit_finalize(
    request: schemas.AuditFinalizeRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))
):
    try:
        res = wms_core.finalize_audit(db, request.location_id, current_user.email, request.report.model_dump())
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/batch-manual", response_model=List[schemas.DeviceInventoryOut])
def batch_manual_intake(
    request: schemas.BatchManualIntakeRequest, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))
):
    results = []
    # Check for duplicates first
    imeis = [d.imei for d in request.devices]
    existing = db.query(models.DeviceInventory).filter(models.DeviceInventory.imei.in_(imeis)).all()
    if existing:
        existing_imeis = [e.imei for e in existing]
        raise HTTPException(
            status_code=400, 
            detail=f"Duplicate IMEIs detected: {', '.join(existing_imeis)}"
        )

    try:
        for dev in request.devices:
            # 1. Create Device
            db_device = models.DeviceInventory(
                imei=dev.imei,
                serial_number=dev.serial_number,
                model_number=dev.model_number,
                location_id=current_user.store_id or "Warehouse_Alpha",
                store_id=current_user.store_id,
                device_status=models.DeviceStatus.Sellable,
                cost_basis=dev.acquisition_cost
            )
            db.add(db_device)
            
            # 2. Create Cost Ledger Entry
            db_ledger = models.DeviceCostLedger(
                imei=dev.imei,
                cost_type="Base_Acquisition",
                amount=dev.acquisition_cost
            )
            db.add(db_ledger)
            
            # 3. Create History Log
            wms_core._log_history(
                db, 
                dev.imei, 
                "Manual Intake", 
                current_user.email, 
                "Sellable", 
                None, 
                f"Manually added to inventory by {current_user.email}"
            )
            results.append(db_device)
        
        db.commit()
        for r in results:
            db.refresh(r)
        return results
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{imei}", response_model=schemas.DeviceInventoryOut)
def get_device_by_imei(imei: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c", "technician"]))):
    device = db.query(models.DeviceInventory).filter(models.DeviceInventory.imei == imei).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device
