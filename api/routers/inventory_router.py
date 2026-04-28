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
        cost_basis=request.inventory.cost_basis or 0.0,
        org_id=getattr(current_user, 'current_org_id', None)
    )
    # Strictly force assignment as requested
    db_inventory.org_id = getattr(current_user, 'current_org_id', None)
    db.add(db_inventory)
    
    # Log the receipt
    wms_core._log_history(db, request.inventory.imei, "Received", current_user.email, "Sellable", None, "Fast Received", org_id=getattr(current_user, 'current_org_id', None))
    
    db.commit()
    db.refresh(db_inventory)
    return db_inventory

@router.get("/central", response_model=List[schemas.DeviceInventoryOut])
def get_central_inventory(db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role(["admin"]))):
    # Admins can see global central inventory, but we'll filter by Warehouse_Alpha by default
    return db.query(models.DeviceInventory).filter(
        models.DeviceInventory.location_id == "Warehouse_Alpha",
        models.DeviceInventory.org_id == getattr(current_user, 'current_org_id', None)
    ).all()

@router.get("/store", response_model=List[schemas.DeviceInventoryOut])
def get_store_inventory(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        stmt = db.query(models.DeviceInventory).filter(models.DeviceInventory.org_id == getattr(current_user, 'current_org_id', None))
        
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
        
    return db.query(models.DeviceInventory).filter(
        models.DeviceInventory.imei == imei,
        models.DeviceInventory.org_id == getattr(current_user, 'current_org_id', None)
    ).first()

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
    return db.query(models.User).filter(
        models.User.role == models.RoleEnum.technician,
        models.User.org_id == getattr(current_user, 'current_org_id', None)
    ).all()

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
            models.DeviceInventory.org_id == getattr(current_user, 'current_org_id', None),
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
        res = wms_core.finalize_audit(db, request.location_id, current_user.email, getattr(current_user, 'current_org_id', None), request.report.model_dump())
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

    from sqlalchemy.exc import IntegrityError
    
    try:
        # Step 1: Stage all devices and cost ledgers
        for dev in request.devices:
            db_device = models.DeviceInventory(
                imei=dev.imei,
                serial_number=dev.serial_number,
                model_number=dev.model_number,
                location_id=current_user.store_id or "Warehouse_Alpha",
                store_id=current_user.store_id,
                device_status=models.DeviceStatus.Sellable if dev.model_number else None,
                cost_basis=dev.acquisition_cost or 0.0,
                org_id=getattr(current_user, 'current_org_id', None)
            )
            db_device.org_id = getattr(current_user, 'current_org_id', None)
            db.add(db_device)
            results.append(db_device)

            if dev.acquisition_cost:
                db_ledger = models.DeviceCostLedger(
                    imei=dev.imei,
                    cost_type="Base_Acquisition",
                    amount=dev.acquisition_cost,
                    org_id=getattr(current_user, 'current_org_id', None)
                )
                # Strictly force assignment
                db_ledger.org_id = getattr(current_user, 'current_org_id', None)
                db.add(db_ledger)

        # Step 2: Flush to the database to satisfy Foreign Key constraints for the logs
        db.flush()

        # Step 3: Now that IMEIs exist in the DB session, create the history logs
        for dev in request.devices:
            wms_core._log_history(
                db, 
                dev.imei, 
                "Manual Intake" if dev.model_number else "Raw Scan", 
                current_user.email, 
                "Sellable" if dev.model_number else "Pending",
                None, 
                f"Asset ingested via bulk workflow",
                org_id=getattr(current_user, 'current_org_id', None)
            )

        db.commit()
        for r in results:
            db.refresh(r)
        return results

    except IntegrityError as e:
        db.rollback()
        # Extract IMEI from error if possible, or send generic duplicate message
        raise HTTPException(
            status_code=400, 
            detail="Integrity Error: One or more IMEIs in this batch already exist in the inventory."
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/bulk-intake", response_model=List[schemas.DeviceInventoryOut])
def bulk_blind_intake(
    request: schemas.BulkReceiveRequest, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))
):
    """
    IMEI-Centric Blind Scan: Accepts only a list of IMEIs and creates raw records.
    Metadata binding happens later via Auction/Invoice sheets.
    """
    from sqlalchemy.exc import IntegrityError
    results = []
    
    # Filter out IMEIs that already exist to allow idempotent "re-scans"
    existing_imeis = {d.imei for d in db.query(models.DeviceInventory.imei).filter(models.DeviceInventory.imei.in_(request.imeis)).all()}
    new_imeis = [i for i in request.imeis if i not in existing_imeis]
    
    if not new_imeis:
        return []

    try:
        for imei in new_imeis:
            db_device = models.DeviceInventory(
                imei=imei,
                location_id=current_user.store_id or "Warehouse_Alpha",
                store_id=current_user.store_id,
                device_status=None, # Raw state
                is_hydrated=False,
                cost_basis=0.0,
                org_id=getattr(current_user, 'current_org_id', None)
            )
            db_device.org_id = getattr(current_user, 'current_org_id', None)
            db.add(db_device)
            results.append(db_device)

        db.flush()

        for imei in new_imeis:
            wms_core._log_history(
                db, imei, "Blind Scan", current_user.email, "Raw", None, "Initial IMEI Registration", org_id=getattr(current_user, 'current_org_id', None)
            )

        db.commit()
        for r in results:
            db.refresh(r)
        return results
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/bind-specs")
def bind_specs_to_imeis(
    data_sheet: List[dict], # List of rows with imei, model_number, cost, etc.
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin"]))
):
    """
    The 'Data Binder': Hydrates raw-scanned devices with technical specs from external sources.
    """
    bound_count = 0
    for row in data_sheet:
        imei = row.get("imei")
        if not imei: continue
        
        db_device = db.query(models.DeviceInventory).filter(models.DeviceInventory.imei == imei).first()
        if db_device:
            # Bind specs
            if "model_number" in row:
                db_device.model_number = row["model_number"]
            if "cost" in row:
                db_device.cost_basis = row["cost"]
            
            db_device.is_hydrated = True
            db_device.device_status = models.DeviceStatus.Sellable
            bound_count += 1
            
            wms_core._log_history(
                db, imei, "Data Binding", current_user.email, "Sellable", "Raw", f"Specs bound from sheet by {current_user.email}", org_id=getattr(current_user, 'current_org_id', None)
            )

    db.commit()
    return {"status": "success", "bound_count": bound_count}

@router.post("/batch-reconcile")
def batch_reconcile(
    request: schemas.BatchManualIntakeRequest, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.require_role(["admin"]))
):
    """
    Updates existing partial device records with metadata (model, cost, condition).
    Typically used for reconciling raw-scanned IMEIs with an auction sheet.
    """
    updated_count = 0
    for dev in request.devices:
        db_device = db.query(models.DeviceInventory).filter(models.DeviceInventory.imei == dev.imei).first()
        if db_device:
            if dev.model_number:
                db_device.model_number = dev.model_number
            if dev.acquisition_cost:
                db_device.cost_basis = dev.acquisition_cost
                # Update/Create ledger
                ledger = db.query(models.DeviceCostLedger).filter(
                    models.DeviceCostLedger.imei == dev.imei,
                    models.DeviceCostLedger.cost_type == "Base_Acquisition"
                ).first()
                if ledger:
                    ledger.amount = dev.acquisition_cost
                else:
                    db.add(models.DeviceCostLedger(imei=dev.imei, cost_type="Base_Acquisition", amount=dev.acquisition_cost, org_id=getattr(current_user, 'current_org_id', None)))
            
            if dev.condition:
                # We can map condition to status or notes if needed
                db_device.device_status = models.DeviceStatus.Sellable
            
            updated_count += 1
            
    db.commit()
    return {"status": "success", "reconciled_count": updated_count}

@router.get("/{imei}", response_model=schemas.DeviceInventoryOut)
def get_device_by_imei(imei: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c", "technician"]))):
    device = db.query(models.DeviceInventory).filter(
        models.DeviceInventory.imei == imei,
        models.DeviceInventory.org_id == getattr(current_user, 'current_org_id', None)
    ).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device
