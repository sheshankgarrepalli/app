import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import models, schemas, auth, wms_core
from database import get_db

router = APIRouter(prefix="/api/qc", tags=["qc"])


def _enrich_device_out(device: models.DeviceInventory, db: Session) -> schemas.DeviceInventoryOut:
    store_map = {}
    if device.store_id:
        store = db.query(models.StoreLocation).filter(
            models.StoreLocation.id == device.store_id
        ).first()
        if store:
            store_map[device.store_id] = store

    return schemas.DeviceInventoryOut(
        imei=device.imei,
        serial_number=device.serial_number,
        model_number=device.model_number,
        location_id=device.location_id,
        sub_location_bin=device.sub_location_bin,
        device_status=device.device_status,
        assigned_technician_id=device.assigned_technician_id,
        cost_basis=device.cost_basis or 0.0,
        received_date=device.received_date,
        model=schemas.PhoneModelOut(
            model_number=device.model.model_number,
            brand=device.model.brand,
            name=device.model.name,
            color=device.model.color,
            storage_gb=device.model.storage_gb,
        ) if device.model else None,
        store_name=store_map[device.store_id].name if device.store_id and device.store_id in store_map else None,
        location_type=store_map[device.store_id].location_type.value if device.store_id and device.store_id in store_map else None,
    )


def _inspection_to_out(insp: models.QCInspection) -> schemas.QCInspectionOut:
    return schemas.QCInspectionOut(
        id=insp.id,
        imei=insp.imei,
        screen_condition=insp.screen_condition,
        frame_condition=insp.frame_condition,
        camera_lens_damage=insp.camera_lens_damage or False,
        face_id_issue=insp.face_id_issue or False,
        battery_service=insp.battery_service or False,
        speaker_issue_ear=insp.speaker_issue_ear or False,
        speaker_issue_loud=insp.speaker_issue_loud or False,
        charging_port_issue=insp.charging_port_issue or False,
        network_locked=insp.network_locked or False,
        grade=insp.grade,
        needs_repair=insp.needs_repair or False,
        repair_items=json.loads(insp.repair_items) if insp.repair_items else None,
        notes=insp.notes,
        inspector_id=insp.inspector_id,
        created_at=insp.created_at,
    )


@router.get("/{imei}", response_model=schemas.QCDeviceDetailOut)
def get_qc_details(
    imei: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin"]))
):
    device = db.query(models.DeviceInventory).filter(
        models.DeviceInventory.imei == imei,
        models.DeviceInventory.org_id == getattr(current_user, 'current_org_id', None)
    ).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    inspections = (
        db.query(models.QCInspection)
        .filter(
            models.QCInspection.imei == imei,
            models.QCInspection.org_id == getattr(current_user, 'current_org_id', None)
        )
        .order_by(models.QCInspection.created_at.desc())
        .all()
    )

    return schemas.QCDeviceDetailOut(
        device=_enrich_device_out(device, db),
        inspections=[_inspection_to_out(i) for i in inspections]
    )


@router.post("/{imei}", response_model=schemas.QCInspectionOut)
def save_qc_inspection(
    imei: str,
    req: schemas.QCInspectionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin"]))
):
    org_id = getattr(current_user, 'current_org_id', None)
    device = db.query(models.DeviceInventory).filter(
        models.DeviceInventory.imei == imei,
        models.DeviceInventory.org_id == org_id
    ).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    inspection = models.QCInspection(
        imei=imei,
        org_id=org_id,
        screen_condition=req.screen_condition,
        frame_condition=req.frame_condition,
        camera_lens_damage=req.camera_lens_damage,
        face_id_issue=req.face_id_issue,
        battery_service=req.battery_service,
        speaker_issue_ear=req.speaker_issue_ear,
        speaker_issue_loud=req.speaker_issue_loud,
        charging_port_issue=req.charging_port_issue,
        network_locked=req.network_locked,
        grade=req.grade,
        needs_repair=req.needs_repair,
        repair_items=json.dumps(req.repair_items) if req.repair_items else None,
        notes=req.notes,
        inspector_id=current_user.email,
    )
    db.add(inspection)

    wms_core._log_history(
        db, imei, "QC_Inspection", current_user.email,
        device.device_status.value if device.device_status else "Unknown",
        None,
        f"QC Inspection by {current_user.email}. Grade: {req.grade}. Notes: {req.notes or 'N/A'}",
        org_id=org_id
    )

    db.commit()
    db.refresh(inspection)
    return _inspection_to_out(inspection)
