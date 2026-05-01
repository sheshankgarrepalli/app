from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
from database import get_db
from models import (
    RepairTicket, RepairStatus, DeviceInventory, DeviceCostLedger,
    RepairMapping, PartsInventory, User, LaborRateConfig, DeviceHistoryLog, DeviceStatus
)
from schemas import (
    RepairTicketOut, RepairTicketCreate, RepairTicketUpdate,
    RepairCompleteRequest, RepairConsumePartRequest, RepairScrapRequest, RepairAssignRequest
)
from auth import get_current_user
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
    out = []
    for t in tickets:
        device = db.query(DeviceInventory).filter(
            DeviceInventory.imei == t.imei, DeviceInventory.org_id == org_id
        ).first()
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

        for category in req.work_completed:
            if device and device.model_number:
                mapping = db.query(RepairMapping).filter(
                    RepairMapping.device_model_number == device.model_number,
                    RepairMapping.repair_category == category
                ).first()
                if mapping:
                    part = db.query(PartsInventory).filter(
                        PartsInventory.sku == mapping.default_part_sku,
                        PartsInventory.org_id == org_id
                    ).first()
                    if part and part.current_stock_qty > 0:
                        part.current_stock_qty -= 1
                        part_total += part.moving_average_cost
                        db.add(DeviceCostLedger(
                            imei=device.imei, org_id=org_id,
                            cost_type=f"Part: {category}", amount=part.moving_average_cost
                        ))

            labor_rate = db.query(LaborRateConfig).filter(
                LaborRateConfig.action_name == f"Repair_{category}",
                LaborRateConfig.org_id == org_id
            ).first()
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
