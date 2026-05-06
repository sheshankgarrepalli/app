from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
from database import get_db
from models import (
    RepairTicket, RepairStatus, DeviceInventory, DeviceCostLedger,
    RepairMapping, PartsInventory, User, LaborRateConfig, DeviceHistoryLog, DeviceStatus,
    QCInspection
)
from schemas import (
    RepairTicketOut, RepairTicketCreate, RepairTicketUpdate,
    RepairCompleteRequest, RepairConsumePartRequest, RepairScrapRequest, RepairAssignRequest,
    RepairRecordRequest, RepairRouteRequest, RepairDeviceDetailOut,
    PartOptionOut, QCInspectionOut, PhoneModelOut, DeviceHistoryLogOut
)
from auth import get_current_user, require_role
import json
from datetime import datetime

router = APIRouter(prefix="/api/repair", tags=["Repair"])


def _org(user: User) -> str:
    return getattr(user, 'current_org_id', None)


# ── Tickets CRUD ─────────────────────────────────────────────────────────────

@router.get("/tickets", response_model=List[RepairTicketOut])
def list_tickets(status_filter: str = "", tech_filter: str = "",
                 db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    org_id = _org(current_user)
    q = db.query(RepairTicket).filter(RepairTicket.org_id == org_id)
    if status_filter:
        q = q.filter(RepairTicket.status == status_filter)
    if tech_filter:
        q = q.filter(RepairTicket.assigned_tech_id == tech_filter)

    tickets = q.order_by(desc(RepairTicket.created_at)).all()
    imeis = [t.imei for t in tickets]
    devices = {}
    if imeis:
        devs = db.query(DeviceInventory).filter(
            DeviceInventory.imei.in_(imeis), DeviceInventory.org_id == org_id
        ).all()
        devices = {d.imei: d for d in devs}
    out = []
    for t in tickets:
        device = devices.get(t.imei)
        out.append(RepairTicketOut(
            id=t.id, imei=t.imei, symptoms=t.symptoms, notes=t.notes,
            status=t.status, assigned_tech_id=t.assigned_tech_id,
            device_model=device.model_number if device else None,
            device_status=device.device_status if device else None,
            created_at=t.created_at, completed_at=t.completed_at,
            consumed_parts=[]
        ))
    return out


@router.post("/tickets", response_model=RepairTicketOut, status_code=status.HTTP_201_CREATED)
def create_ticket(req: RepairTicketCreate, db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    org_id = _org(current_user)
    device = db.query(DeviceInventory).filter(
        DeviceInventory.imei == req.imei, DeviceInventory.org_id == org_id
    ).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if device.device_status not in [DeviceStatus.Sellable, DeviceStatus.In_QC, DeviceStatus.In_Repair, DeviceStatus.Awaiting_Parts, None]:
        raise HTTPException(status_code=400,
                            detail=f"Device status '{device.device_status}' cannot be sent to repair")

    existing = db.query(RepairTicket).filter(
        RepairTicket.imei == req.imei,
        RepairTicket.status.in_([RepairStatus.Pending_Triage, RepairStatus.In_Repair, RepairStatus.Awaiting_Parts]),
        RepairTicket.org_id == org_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Active repair ticket already exists for this IMEI")

    ticket = RepairTicket(
        imei=req.imei, org_id=org_id,
        symptoms=req.symptoms, notes=req.notes,
        status=RepairStatus.Pending_Triage
    )
    db.add(ticket)

    old_status = device.device_status
    device.device_status = DeviceStatus.In_Repair
    db.add(DeviceHistoryLog(
        imei=req.imei, org_id=org_id,
        action_type="Repair Ticket Created",
        employee_id=current_user.email,
        previous_status=old_status,
        new_status=DeviceStatus.In_Repair,
        notes=f"Ticket #{ticket.id}: {req.symptoms}"
    ))

    db.commit()
    db.refresh(ticket)
    return RepairTicketOut(
        id=ticket.id, imei=ticket.imei, symptoms=ticket.symptoms, notes=ticket.notes,
        status=ticket.status, assigned_tech_id=ticket.assigned_tech_id,
        device_model=device.model_number, device_status=device.device_status,
        created_at=ticket.created_at, completed_at=ticket.completed_at,
        consumed_parts=[]
    )


@router.get("/tickets/{ticket_id}", response_model=RepairTicketOut)
def get_ticket(ticket_id: int, db: Session = Depends(get_db),
               current_user: User = Depends(get_current_user)):
    org_id = _org(current_user)
    ticket = db.query(RepairTicket).filter(
        RepairTicket.id == ticket_id, RepairTicket.org_id == org_id
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    device = db.query(DeviceInventory).filter(
        DeviceInventory.imei == ticket.imei, DeviceInventory.org_id == org_id
    ).first()
    ledger = db.query(DeviceCostLedger).filter(
        DeviceCostLedger.imei == ticket.imei, DeviceCostLedger.org_id == org_id
    ).order_by(desc(DeviceCostLedger.created_at)).all()

    return RepairTicketOut(
        id=ticket.id, imei=ticket.imei, symptoms=ticket.symptoms, notes=ticket.notes,
        status=ticket.status, assigned_tech_id=ticket.assigned_tech_id,
        device_model=device.model_number if device else None,
        device_status=device.device_status if device else None,
        created_at=ticket.created_at, completed_at=ticket.completed_at,
        consumed_parts=[{"cost_type": l.cost_type, "amount": l.amount, "date": str(l.created_at)} for l in ledger]
    )


@router.put("/tickets/{ticket_id}", response_model=RepairTicketOut)
def update_ticket(ticket_id: int, req: RepairTicketUpdate,
                  db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    org_id = _org(current_user)
    ticket = db.query(RepairTicket).filter(
        RepairTicket.id == ticket_id, RepairTicket.org_id == org_id
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    device = db.query(DeviceInventory).filter(
        DeviceInventory.imei == ticket.imei, DeviceInventory.org_id == org_id
    ).first()

    if req.status is not None:
        valid_transitions = {
            RepairStatus.Pending_Triage: [RepairStatus.In_Repair, RepairStatus.Cancelled],
            RepairStatus.In_Repair: [RepairStatus.Awaiting_Parts, RepairStatus.Completed],
            RepairStatus.Awaiting_Parts: [RepairStatus.In_Repair, RepairStatus.Cancelled],
        }
        allowed = valid_transitions.get(ticket.status, [])
        if req.status not in allowed:
            raise HTTPException(status_code=400,
                                detail=f"Cannot transition from {ticket.status.value} to {req.status.value}")

        old_ticket_status = ticket.status
        ticket.status = req.status

        if req.status == RepairStatus.Completed:
            ticket.completed_at = datetime.utcnow()
        if req.status == RepairStatus.Awaiting_Parts and device:
            device.device_status = DeviceStatus.Awaiting_Parts
            db.add(DeviceHistoryLog(
                imei=ticket.imei, org_id=org_id,
                action_type="Awaiting Parts", employee_id=current_user.email,
                previous_status=DeviceStatus.In_Repair,
                new_status=DeviceStatus.Awaiting_Parts,
                notes=f"Ticket #{ticket.id} waiting for parts"
            ))
        if req.status == RepairStatus.In_Repair and device and old_ticket_status == RepairStatus.Awaiting_Parts:
            device.device_status = DeviceStatus.In_Repair
            db.add(DeviceHistoryLog(
                imei=ticket.imei, org_id=org_id,
                action_type="Parts Arrived", employee_id=current_user.email,
                previous_status=DeviceStatus.Awaiting_Parts,
                new_status=DeviceStatus.In_Repair,
                notes=f"Ticket #{ticket.id} resumed"
            ))

    if req.assigned_tech_id is not None:
        ticket.assigned_tech_id = req.assigned_tech_id
    if req.symptoms is not None:
        ticket.symptoms = req.symptoms
    if req.notes is not None:
        ticket.notes = req.notes

    db.commit()
    db.refresh(ticket)
    return RepairTicketOut(
        id=ticket.id, imei=ticket.imei, symptoms=ticket.symptoms, notes=ticket.notes,
        status=ticket.status, assigned_tech_id=ticket.assigned_tech_id,
        device_model=device.model_number if device else None,
        device_status=device.device_status if device else None,
        created_at=ticket.created_at, completed_at=ticket.completed_at,
        consumed_parts=[]
    )


# ── Part Consumption ─────────────────────────────────────────────────────────

@router.post("/tickets/{ticket_id}/consume-part")
def consume_part(ticket_id: int, req: RepairConsumePartRequest,
                 db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    org_id = _org(current_user)
    ticket = db.query(RepairTicket).filter(
        RepairTicket.id == ticket_id, RepairTicket.org_id == org_id
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.status not in [RepairStatus.In_Repair, RepairStatus.Pending_Triage]:
        raise HTTPException(status_code=400, detail="Ticket is not in an active repair state")

    part = db.query(PartsInventory).filter(
        PartsInventory.sku == req.part_sku, PartsInventory.org_id == org_id
    ).first()
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    if part.current_stock_qty < req.qty:
        raise HTTPException(status_code=400, detail="Insufficient stock")

    part.current_stock_qty -= req.qty

    device = db.query(DeviceInventory).filter(
        DeviceInventory.imei == ticket.imei, DeviceInventory.org_id == org_id
    ).first()

    total_cost = part.moving_average_cost * req.qty
    db.add(DeviceCostLedger(
        imei=ticket.imei, org_id=org_id,
        cost_type=f"Part: {part.part_name}", amount=total_cost
    ))
    if device:
        device.cost_basis += total_cost

    db.commit()
    return {"status": "consumed", "sku": req.part_sku, "qty": req.qty, "cost": total_cost}


# ── Atomic Repair Completion ─────────────────────────────────────────────────

@router.post("/tickets/{ticket_id}/complete")
def complete_repair(ticket_id: int, req: RepairCompleteRequest,
                    db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    org_id = _org(current_user)
    ticket = db.query(RepairTicket).filter(
        RepairTicket.id == ticket_id, RepairTicket.org_id == org_id
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.status == RepairStatus.Completed:
        raise HTTPException(status_code=400, detail="Ticket already completed")

    device = db.query(DeviceInventory).filter(
        DeviceInventory.imei == ticket.imei, DeviceInventory.org_id == org_id
    ).first()

    try:
        # (1) Deduct parts via RepairMapping
        # (2) Log part cost to ledger
        # (3) Log labor cost to ledger
        # (4) Update device cost_basis
        # (5) Transition device status to Sellable
        # (6) Complete the ticket
        # (7) Write history log

        labor_total = 0.0
        part_total = 0.0

        # Pre-fetch maps to avoid N+1 queries inside the loop
        model = device.model_number if device else None
        mappings = {}
        parts_map = {}
        labor_rates_map = {}

        if model and req.work_completed:
            mappings_list = db.query(RepairMapping).filter(
                RepairMapping.device_model_number == model,
                RepairMapping.repair_category.in_(req.work_completed)
            ).all()
            mappings = {m.repair_category: m for m in mappings_list}
            skus = [m.default_part_sku for m in mappings_list]
            if skus:
                parts_list = db.query(PartsInventory).filter(
                    PartsInventory.sku.in_(skus),
                    PartsInventory.org_id == org_id
                ).all()
                parts_map = {p.sku: p for p in parts_list}

        labor_action_names = [f"Repair_{c}" for c in req.work_completed]
        labor_rates_list = db.query(LaborRateConfig).filter(
            LaborRateConfig.action_name.in_(labor_action_names),
            LaborRateConfig.org_id == org_id
        ).all()
        labor_rates_map = {lr.action_name: lr for lr in labor_rates_list}

        for category in req.work_completed:
            mapping = mappings.get(category)
            if mapping:
                part = parts_map.get(mapping.default_part_sku)
                if part and part.current_stock_qty > 0:
                    part.current_stock_qty -= 1
                    part_total += part.moving_average_cost
                    db.add(DeviceCostLedger(
                        imei=device.imei, org_id=org_id,
                        cost_type=f"Part: {category}", amount=part.moving_average_cost
                    ))

            labor_rate = labor_rates_map.get(f"Repair_{category}")
            if labor_rate:
                labor_total += labor_rate.fee_amount
                db.add(DeviceCostLedger(
                    imei=device.imei, org_id=org_id,
                    cost_type=f"Labor: {category}", amount=labor_rate.fee_amount
                ))

        if device:
            device.cost_basis += part_total + labor_total
            old_status = device.device_status
            device.device_status = DeviceStatus.Sellable
            db.add(DeviceHistoryLog(
                imei=device.imei, org_id=org_id,
                action_type="Repair Completed", employee_id=current_user.email,
                previous_status=old_status, new_status=DeviceStatus.Sellable,
                notes=f"Ticket #{ticket_id} completed. Parts: ${part_total:.2f}, Labor: ${labor_total:.2f}"
            ))

        ticket.status = RepairStatus.Completed
        ticket.completed_at = datetime.utcnow()
        ticket.assigned_tech_id = current_user.email

        db.commit()
        return {
            "status": "completed", "ticket_id": ticket_id, "imei": ticket.imei,
            "part_cost": part_total, "labor_cost": labor_total,
            "total_cost": part_total + labor_total
        }
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Repair completion failed — rolled back")


# ── Scrap ────────────────────────────────────────────────────────────────────

@router.post("/tickets/{ticket_id}/scrap")
def scrap_device(ticket_id: int, req: RepairScrapRequest,
                 db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    org_id = _org(current_user)
    ticket = db.query(RepairTicket).filter(
        RepairTicket.id == ticket_id, RepairTicket.org_id == org_id
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    device = db.query(DeviceInventory).filter(
        DeviceInventory.imei == ticket.imei, DeviceInventory.org_id == org_id
    ).first()

    old_ticket_status = ticket.status
    ticket.status = RepairStatus.Cancelled

    if device:
        old_device_status = device.device_status
        device.device_status = DeviceStatus.Scrapped
        db.add(DeviceHistoryLog(
            imei=device.imei, org_id=org_id,
            action_type="Device Scrapped", employee_id=current_user.email,
            previous_status=old_device_status, new_status=DeviceStatus.Scrapped,
            notes=f"Ticket #{ticket_id} scrapped. Reason: {req.reason}"
        ))

    db.commit()
    return {"status": "scrapped", "ticket_id": ticket_id, "imei": ticket.imei}


# ── Triage (legacy compat) ───────────────────────────────────────────────────

@router.post("/triage", response_model=RepairTicketOut)
def triage_device(req: RepairTicketCreate, db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    """Legacy: quick triage. Creates ticket and transitions device to In_Repair."""
    return create_ticket(req, db, current_user)


@router.post("/complete")
def complete_repair_legacy(req: RepairCompleteRequest, db: Session = Depends(get_db),
                           current_user: User = Depends(get_current_user)):
    """Legacy: find ticket by IMEI and complete it."""
    org_id = _org(current_user)
    ticket = db.query(RepairTicket).filter(
        RepairTicket.imei == req.imei,
        RepairTicket.status.in_([RepairStatus.In_Repair, RepairStatus.Pending_Triage, RepairStatus.Awaiting_Parts]),
        RepairTicket.org_id == org_id
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Active repair ticket not found")
    return complete_repair(ticket.id, req, db, current_user)


# ── Technician-Facing Endpoints (no cost exposure) ─────────────────────────────

@router.get("/imei/{imei}", response_model=RepairDeviceDetailOut)
def get_device_for_repair(
    imei: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "owner"]))
):
    org_id = _org(current_user)
    device = db.query(DeviceInventory).filter(
        DeviceInventory.imei == imei, DeviceInventory.org_id == org_id
    ).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    # Latest QC inspection
    qc = db.query(QCInspection).filter(
        QCInspection.imei == imei, QCInspection.org_id == org_id
    ).order_by(desc(QCInspection.created_at)).first()

    qc_out = None
    if qc:
        repair_items = json.loads(qc.repair_items) if qc.repair_items else None
        qc_out = QCInspectionOut(
            id=qc.id, imei=qc.imei,
            screen_condition=qc.screen_condition, frame_condition=qc.frame_condition,
            camera_lens_damage=qc.camera_lens_damage or False,
            face_id_issue=qc.face_id_issue or False,
            battery_service=qc.battery_service or False,
            speaker_issue_ear=qc.speaker_issue_ear or False,
            speaker_issue_loud=qc.speaker_issue_loud or False,
            charging_port_issue=qc.charging_port_issue or False,
            network_locked=qc.network_locked or False,
            grade=qc.grade, needs_repair=qc.needs_repair or False,
            repair_items=repair_items, notes=qc.notes,
            inspector_id=qc.inspector_id, created_at=qc.created_at
        )

    # Existing repair ticket
    ticket = db.query(RepairTicket).filter(
        RepairTicket.imei == imei,
        RepairTicket.status.in_([RepairStatus.Pending_Triage, RepairStatus.In_Repair, RepairStatus.Awaiting_Parts]),
        RepairTicket.org_id == org_id
    ).first()

    ticket_out = None
    if ticket:
        ticket_out = RepairTicketOut(
            id=ticket.id, imei=ticket.imei, symptoms=ticket.symptoms, notes=ticket.notes,
            status=ticket.status, assigned_tech_id=ticket.assigned_tech_id,
            device_model=device.model_number, device_status=device.device_status,
            created_at=ticket.created_at, completed_at=ticket.completed_at,
            consumed_parts=[]
        )

    # Available parts (no cost info)
    parts = db.query(PartsInventory).filter(
        PartsInventory.org_id == org_id,
        PartsInventory.current_stock_qty > 0
    ).order_by(PartsInventory.part_name).all()
    part_options = [PartOptionOut(sku=p.sku, part_name=p.part_name, in_stock=p.current_stock_qty) for p in parts]

    # Store info
    store_name = None
    if device.store_id:
        from models import StoreLocation
        store = db.query(StoreLocation).filter(StoreLocation.id == device.store_id).first()
        if store:
            store_name = store.name

    # Recent history
    history = db.query(DeviceHistoryLog).filter(
        DeviceHistoryLog.imei == imei, DeviceHistoryLog.org_id == org_id
    ).order_by(desc(DeviceHistoryLog.timestamp)).limit(15).all()

    return RepairDeviceDetailOut(
        imei=device.imei,
        serial_number=device.serial_number,
        model_number=device.model_number,
        location_id=device.location_id,
        sub_location_bin=device.sub_location_bin,
        device_status=device.device_status,
        received_date=device.received_date,
        model=PhoneModelOut(
            model_number=device.model.model_number,
            brand=device.model.brand,
            name=device.model.name,
            color=device.model.color,
            storage_gb=device.model.storage_gb,
        ) if device.model else None,
        store_name=store_name,
        qc_findings=qc_out,
        repair_ticket=ticket_out,
        available_parts=part_options,
        recent_history=[DeviceHistoryLogOut(
            log_id=h.log_id, imei=h.imei, timestamp=h.timestamp,
            action_type=h.action_type, employee_id=h.employee_id,
            previous_status=h.previous_status, new_status=h.new_status,
            notes=h.notes
        ) for h in history]
    )


@router.post("/imei/{imei}/record")
def record_repair(
    imei: str,
    req: RepairRecordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "owner"]))
):
    org_id = _org(current_user)
    device = db.query(DeviceInventory).filter(
        DeviceInventory.imei == imei, DeviceInventory.org_id == org_id
    ).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    # Find or create repair ticket
    ticket = db.query(RepairTicket).filter(
        RepairTicket.imei == imei,
        RepairTicket.status.in_([RepairStatus.Pending_Triage, RepairStatus.In_Repair, RepairStatus.Awaiting_Parts]),
        RepairTicket.org_id == org_id
    ).first()

    if not ticket:
        ticket = RepairTicket(
            imei=imei, org_id=org_id,
            symptoms="", notes="",
            status=RepairStatus.In_Repair
        )
        db.add(ticket)
        db.flush()

        old_status = device.device_status
        device.device_status = DeviceStatus.In_Repair
        db.add(DeviceHistoryLog(
            imei=imei, org_id=org_id,
            action_type="Repair Started", employee_id=current_user.email,
            previous_status=old_status, new_status=DeviceStatus.In_Repair,
            notes=f"Ticket #{ticket.id}: repair in progress"
        ))

    ticket.symptoms = ", ".join(req.work_completed) if req.work_completed else ""
    ticket.notes = req.notes
    ticket.assigned_tech_id = current_user.email

    # Consume parts (deduct from inventory, but don't expose cost)
    for pc in req.parts_consumed:
        part = db.query(PartsInventory).filter(
            PartsInventory.sku == pc.sku, PartsInventory.org_id == org_id
        ).first()
        if part and part.current_stock_qty >= pc.qty:
            part.current_stock_qty -= pc.qty
            db.add(DeviceCostLedger(
                imei=imei, org_id=org_id,
                cost_type=f"Part: {part.part_name}", amount=part.moving_average_cost * pc.qty
            ))

    db.commit()
    return {"status": "recorded", "ticket_id": ticket.id, "imei": imei}


@router.post("/imei/{imei}/route")
def route_after_repair(
    imei: str,
    req: RepairRouteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "owner"]))
):
    org_id = _org(current_user)
    device = db.query(DeviceInventory).filter(
        DeviceInventory.imei == imei, DeviceInventory.org_id == org_id
    ).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    # Parse target status
    import state_machine
    target = state_machine.parse_target(req.target)
    if target is None:
        raise HTTPException(status_code=400, detail=f"Invalid target status: '{req.target}'")

    # Complete any active repair ticket
    ticket = db.query(RepairTicket).filter(
        RepairTicket.imei == imei,
        RepairTicket.status.in_([RepairStatus.Pending_Triage, RepairStatus.In_Repair, RepairStatus.Awaiting_Parts]),
        RepairTicket.org_id == org_id
    ).first()

    if ticket:
        ticket.status = RepairStatus.Completed
        ticket.completed_at = datetime.utcnow()
        ticket.assigned_tech_id = current_user.email

    # Execute transition
    result = state_machine.execute_transition(
        db, device, target,
        employee_id=current_user.email,
        notes=req.notes or f"Repair completed, routed to {target.value}"
    )

    if not result.success:
        raise HTTPException(status_code=400, detail=result.errors[0] if result.errors else "Transition failed")

    db.commit()
    return {"status": "routed", "imei": imei, "new_status": target.value, "ticket_id": ticket.id if ticket else None}
