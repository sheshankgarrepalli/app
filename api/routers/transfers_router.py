from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import models, schemas, auth, state_machine
import wms_core
from database import get_db
import uuid

router = APIRouter(prefix="/api/transfers", tags=["transfers"])

@router.post("/bulk-route")
def bulk_route_devices(req: schemas.BulkRouteRequest, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    org_id = getattr(current_user, 'current_org_id', None)
    success_count = 0
    errors = []

    target = state_machine.parse_target(req.destination)
    if target is None:
        raise HTTPException(status_code=400, detail=f"Invalid destination status: '{req.destination}'")

    for imei in req.imeis:
        device = db.query(models.DeviceInventory).filter(
            models.DeviceInventory.imei == imei,
            models.DeviceInventory.org_id == org_id
        ).first()
        if not device:
            errors.append(f"IMEI {imei} not found")
            continue

        result = state_machine.execute_transition(
            db, device, target,
            employee_id=current_user.email,
            notes=req.notes or f"Bulk routed to {target.value}",
            defects=req.defects,
        )

        if result.success:
            success_count += 1
        else:
            errors.append(f"IMEI {imei}: {'; '.join(result.errors)}")

    return {"success_count": success_count, "errors": errors}

@router.post("/dispatch", response_model=schemas.TransferManifestOut)
def dispatch_transfer(req: schemas.TransferDispatchRequest, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    org_id = getattr(current_user, 'current_org_id', None)
    # Create unique manifest ID
    manifest_id = f"MAN-{str(uuid.uuid4())[:8].upper()}"
    
    # Create Manifest
    manifest = models.TransferManifest(
        manifest_id=manifest_id,
        origin_id=req.origin,
        destination_id=req.destination,
        courier_name=req.courier_name,
        status=models.ManifestStatus.In_Transit, # The user says "updates status to In Transit"
        org_id=org_id
    )
    db.add(manifest)
    
    for imei in req.imeis:
        device = db.query(models.DeviceInventory).filter(
            models.DeviceInventory.imei == imei,
            models.DeviceInventory.org_id == org_id
        ).first()
        if not device:
            raise HTTPException(status_code=404, detail=f"IMEI {imei} not found")
        
        old_status = device.device_status
        if old_status in [models.DeviceStatus.In_Transit, models.DeviceStatus.Sold, models.DeviceStatus.Reserved_Layaway]:
            raise HTTPException(status_code=400, detail=f"IMEI {imei} cannot be dispatched. Current status: {old_status}")

        # Verify location ownership — non-admin users can only dispatch from their own store
        user_location = current_user.store_id or current_user.role
        if current_user.role != "admin" and device.location_id != user_location:
            raise HTTPException(status_code=403, detail=f"IMEI {imei} is not at your location (expected: {user_location}, actual: {device.location_id})")

        device.device_status = models.DeviceStatus.In_Transit
        
        # Audit Log
        log = models.DeviceHistoryLog(
            imei=imei,
            action_type="Transfer Dispatch",
            employee_id=current_user.email,
            previous_status=old_status,
            new_status=models.DeviceStatus.In_Transit,
            notes=f"Dispatched on Manifest {manifest_id}",
            org_id=org_id
        )
        db.add(log)
        
        # Manifest Item
        m_item = models.ManifestItem(
            manifest_id=manifest_id,
            imei=imei,
            org_id=org_id
        )
        db.add(m_item)
        
    db.flush() # Ensure atomic integrity before committing
    db.commit()
    db.refresh(manifest)
    return manifest

@router.post("/bulk-receive")
def bulk_receive_devices(req: schemas.BulkReceiveRequest, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    org_id = getattr(current_user, 'current_org_id', None)
    success_count = 0
    errors = []
    
    for imei in req.imeis:
        device = db.query(models.DeviceInventory).filter(
            models.DeviceInventory.imei == imei,
            models.DeviceInventory.org_id == org_id
        ).first()
        if not device:
            errors.append(f"IMEI {imei} not found")
            continue
            
        old_status = device.device_status
        new_status = ""
        
        if old_status == models.DeviceStatus.Transit_to_Repair:
            new_status = models.DeviceStatus.In_Repair
            # Auto-create RepairTicket if none exists
            existing_ticket = db.query(models.RepairTicket).filter(
                models.RepairTicket.imei == imei,
                models.RepairTicket.status.in_([
                    models.RepairStatus.Pending_Triage,
                    models.RepairStatus.In_Repair,
                    models.RepairStatus.Awaiting_Parts
                ]),
                models.RepairTicket.org_id == org_id
            ).first()
            if not existing_ticket:
                ticket = models.RepairTicket(
                    imei=imei, org_id=org_id,
                    symptoms="", notes="Auto-created from bulk transfer receive",
                    status=models.RepairStatus.Pending_Triage
                )
                db.add(ticket)
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
                    amount=qc_rate.fee_amount,
                    org_id=org_id
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
            notes=f"Acknowledged receipt. Status moved to {new_status}. {req.notes}",
            org_id=org_id
        )
        db.add(log)
        success_count += 1
        
    db.commit()
    return {"success_count": success_count, "errors": errors}

@router.post("/")
def create_transfer(transfer: schemas.TransferOrderCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role(["admin"]))):
    org_id = getattr(current_user, 'current_org_id', None)
    try:
        to_id = wms_core.create_transfer_order(db, transfer.imei_list, transfer.destination_location_id, transfer.transfer_type, current_user.email, org_id=org_id)
        return {"transfer_order_id": to_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{transfer_order_id}/receive")
def receive_transfer(transfer_order_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))):
    org_id = getattr(current_user, 'current_org_id', None)
    try:
        received = wms_core.receive_transfer_order(db, transfer_order_id, current_user.email)
        return {"message": "Received successfully", "imeis": received}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/")
def get_transfers(db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))):
    org_id = getattr(current_user, 'current_org_id', None)
    if current_user.role == "admin":
        orders = db.query(models.TransferOrder).filter(models.TransferOrder.org_id == org_id).all()
    else:
        orders = db.query(models.TransferOrder).filter(
            models.TransferOrder.destination_location_id == current_user.role,
            models.TransferOrder.org_id == org_id
        ).all()

    return orders


# ── Manifest-based Smart Receiving ─────────────────────────────────────────

@router.get("/manifests")
def get_incoming_manifests(db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))):
    org_id = getattr(current_user, 'current_org_id', None)
    dest_id = current_user.role if current_user.role != "admin" else None

    query = db.query(models.TransferManifest).filter(models.TransferManifest.org_id == org_id)
    if dest_id:
        query = query.filter(models.TransferManifest.destination_id == dest_id)
    query = query.filter(models.TransferManifest.status.in_([
        models.ManifestStatus.In_Transit, models.ManifestStatus.Pending_Acknowledgment
    ]))
    return query.order_by(models.TransferManifest.created_at.desc()).all()


@router.get("/manifests/{manifest_id}")
def get_manifest_detail(manifest_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))):
    org_id = getattr(current_user, 'current_org_id', None)
    manifest = db.query(models.TransferManifest).filter(
        models.TransferManifest.manifest_id == manifest_id,
        models.TransferManifest.org_id == org_id
    ).first()
    if not manifest:
        raise HTTPException(status_code=404, detail="Manifest not found")

    items = db.query(models.ManifestItem).filter(models.ManifestItem.manifest_id == manifest_id).all()
    item_details = []
    for mi in items:
        device = db.query(models.DeviceInventory).filter(models.DeviceInventory.imei == mi.imei).first()
        item_details.append({
            "imei": mi.imei,
            "model_number": device.model_number if device else None,
            "serial_number": device.serial_number if device else None,
            "device_status": device.device_status.value if device and device.device_status else None,
            "is_received": device.location_id == manifest.destination_id if device else False
        })

    return {
        "manifest": manifest,
        "items": item_details,
        "total_items": len(item_details),
        "received_count": sum(1 for i in item_details if i["is_received"])
    }


@router.post("/manifests/{manifest_id}/verify")
def verify_manifest_imeis(manifest_id: str, req: schemas.BulkReceiveRequest, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))):
    try:
        result = wms_core.verify_manifest_imeis(db, manifest_id, req.imeis, current_user.email)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
