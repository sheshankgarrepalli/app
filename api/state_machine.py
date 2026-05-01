"""
Centralized Device Status State Machine.

Every device_inventory.device_status transition MUST flow through
execute_transition().  This guarantees:
  - only valid source→target moves are accepted
  - required side-effects (ticket creation, transfer locking, etc.) always fire
  - the whole transition is atomic: any side-effect failure rolls back the status change
"""

from __future__ import annotations

import enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Set

from sqlalchemy.orm import Session

from models import (
    DeviceInventory,
    DeviceStatus,
    DeviceHistoryLog,
    RepairTicket,
    RepairStatus,
    TransferOrder,
    TransferType,
    LaborRateConfig,
    DeviceCostLedger,
)


# ── Transition map ──────────────────────────────────────────────────────────

TRANSITION_MAP: Dict[Optional[DeviceStatus], Set[DeviceStatus]] = {
    None: {
        DeviceStatus.Sellable,
        DeviceStatus.In_QC,
        DeviceStatus.In_Repair,
        DeviceStatus.Scrapped,
    },
    DeviceStatus.Sellable: {
        DeviceStatus.In_QC,
        DeviceStatus.In_Repair,
        DeviceStatus.In_Transit,
        DeviceStatus.Sold,
        DeviceStatus.Reserved_Layaway,
        DeviceStatus.Scrapped,
    },
    DeviceStatus.In_QC: {
        DeviceStatus.Sellable,
        DeviceStatus.In_Repair,
        DeviceStatus.In_Transit,
        DeviceStatus.Scrapped,
    },
    DeviceStatus.In_Repair: {
        DeviceStatus.Sellable,
        DeviceStatus.Awaiting_Parts,
        DeviceStatus.Scrapped,
    },
    DeviceStatus.Awaiting_Parts: {
        DeviceStatus.In_Repair,
        DeviceStatus.Scrapped,
    },
    DeviceStatus.In_Transit: {
        DeviceStatus.Sellable,
        DeviceStatus.In_QC,
        DeviceStatus.In_Repair,
        DeviceStatus.Scrapped,
    },
    DeviceStatus.Transit_to_Repair: {
        DeviceStatus.In_Repair,
        DeviceStatus.Scrapped,
    },
    DeviceStatus.Transit_to_QC: {
        DeviceStatus.In_QC,
        DeviceStatus.Scrapped,
    },
    DeviceStatus.Transit_to_Main_Bin: {
        DeviceStatus.Sellable,
        DeviceStatus.Scrapped,
    },
    DeviceStatus.Reserved_Layaway: {
        DeviceStatus.Sellable,
        DeviceStatus.Sold,
        DeviceStatus.Scrapped,
    },
    DeviceStatus.Pending_Acknowledgment: {
        DeviceStatus.Sellable,
        DeviceStatus.In_QC,
        DeviceStatus.In_Repair,
        DeviceStatus.In_Transit,
        DeviceStatus.Scrapped,
    },
    # Terminal states — no outgoing transitions
    DeviceStatus.Sold: set(),
    DeviceStatus.Scrapped: set(),
}


# ── Requirement descriptors (what the frontend must prompt for) ──────────────

class Requirement(enum.Enum):
    LOCATION = "location"           # must provide location_id / sub_location_bin
    NOTES = "notes"                 # must provide a note / reason
    TICKET = "ticket"              # will auto-create a RepairTicket
    TRANSFER = "transfer"          # must link to a TransferOrder
    TECHNICIAN = "technician"      # must assign a technician


TARGET_REQUIREMENTS: Dict[DeviceStatus, Set[Requirement]] = {
    DeviceStatus.Sellable:        {Requirement.LOCATION},
    DeviceStatus.In_QC:           {Requirement.NOTES},
    DeviceStatus.In_Repair:       {Requirement.TICKET},
    DeviceStatus.Awaiting_Parts:  set(),
    DeviceStatus.In_Transit:      {Requirement.TRANSFER},
    DeviceStatus.Transit_to_Repair:  {Requirement.NOTES},
    DeviceStatus.Transit_to_QC:      {Requirement.NOTES},
    DeviceStatus.Transit_to_Main_Bin: {Requirement.LOCATION},
    DeviceStatus.Reserved_Layaway: set(),
    DeviceStatus.Pending_Acknowledgment: {Requirement.NOTES},
    DeviceStatus.Sold:            set(),
    DeviceStatus.Scrapped:        {Requirement.NOTES},
}


# ── Public helpers ──────────────────────────────────────────────────────────

def allowed_transitions(device: DeviceInventory) -> List[Dict[str, Any]]:
    """Return every valid next status + what it requires (for the frontend)."""
    src = device.device_status
    targets = TRANSITION_MAP.get(src, set())
    result: List[Dict[str, Any]] = []
    for t in targets:
        reqs = TARGET_REQUIREMENTS.get(t, set())
        result.append({
            "target": t.value,
            "label": t.value.replace("_", " "),
            "requirements": [r.value for r in reqs],
        })
    return sorted(result, key=lambda x: x["label"])


@dataclass
class TransitionResult:
    success: bool
    new_status: str
    ticket_id: Optional[int] = None
    transfer_id: Optional[str] = None
    errors: List[str] = field(default_factory=list)


# ── Atomic executor ─────────────────────────────────────────────────────────

def execute_transition(
    db: Session,
    device: DeviceInventory,
    target: DeviceStatus,
    *,
    employee_id: str,
    location_id: Optional[str] = None,
    sub_location_bin: Optional[str] = None,
    notes: Optional[str] = None,
    technician_id: Optional[str] = None,
    transfer_id: Optional[str] = None,
    defects: Optional[List[str]] = None,
    ticket_id: Optional[int] = None,
) -> TransitionResult:
    """
    Single entry-point for every device status change.

    Validates the transition, executes required side-effects in order, and commits
    atomically.  Any failure rolls back the entire change.
    """
    src = device.device_status
    org_id: str = getattr(device, 'org_id', None)

    # 1. Validate
    allowed = TRANSITION_MAP.get(src, set())
    if target not in allowed:
        src_label = src.value if src else "None"
        return TransitionResult(
            success=False, new_status=target.value,
            errors=[f"Cannot transition from {src_label} to {target.value}"],
        )

    reqs = TARGET_REQUIREMENTS.get(target, set())

    # 2. Pre-flight checks for required side-effects
    if Requirement.LOCATION in reqs:
        if not location_id and not sub_location_bin:
            return TransitionResult(
                success=False, new_status=target.value,
                errors=["Location or bin is required to transition to Sellable"],
            )

    if Requirement.TRANSFER in reqs:
        if not transfer_id:
            return TransitionResult(
                success=False, new_status=target.value,
                errors=["Transfer order ID is required for In_Transit"],
            )
        tx = db.query(TransferOrder).filter(
            TransferOrder.id == transfer_id, TransferOrder.org_id == org_id
        ).first()
        if not tx:
            return TransitionResult(
                success=False, new_status=target.value,
                errors=[f"Transfer order {transfer_id} not found"],
            )

    try:
        # 3. Execute side-effects in order

        created_ticket_id: Optional[int] = None

        # ── Ticket creation ──
        if Requirement.TICKET in reqs:
            existing = db.query(RepairTicket).filter(
                RepairTicket.imei == device.imei,
                RepairTicket.status.in_([
                    RepairStatus.Pending_Triage,
                    RepairStatus.In_Repair,
                    RepairStatus.Awaiting_Parts,
                ]),
                RepairTicket.org_id == org_id,
            ).first()
            if existing:
                created_ticket_id = existing.id
            else:
                ticket = RepairTicket(
                    imei=device.imei,
                    org_id=org_id,
                    symptoms=", ".join(defects) if defects else "",
                    notes=notes or "",
                    status=RepairStatus.Pending_Triage,
                )
                db.add(ticket)
                db.flush()
                created_ticket_id = ticket.id

        # ── Location update ──
        if Requirement.LOCATION in reqs:
            if location_id:
                device.location_id = location_id
            if sub_location_bin:
                device.sub_location_bin = sub_location_bin

        # ── Technician assignment ──
        if Requirement.TECHNICIAN in reqs and technician_id:
            device.assigned_technician_id = technician_id

        # ── Transfer linking ──
        transfer_order_id: Optional[str] = None
        if Requirement.TRANSFER in reqs and transfer_id:
            device.assigned_transfer_order_id = transfer_id
            transfer_order_id = transfer_id

        # ── Scrap clears assignments ──
        if target == DeviceStatus.Scrapped:
            device.assigned_technician_id = None
            device.assigned_transfer_order_id = None

        # 4. Execute the status change
        prev_status = device.device_status
        device.device_status = target

        # 5. Write history log
        db.add(DeviceHistoryLog(
            imei=device.imei,
            org_id=org_id,
            action_type=f"State_Transition",
            employee_id=employee_id,
            previous_status=prev_status.value if prev_status else "None",
            new_status=target.value,
            notes=notes or f"Transition {prev_status} → {target} by {employee_id}",
        ))

        # 6. Commit — everything succeeds or nothing does
        db.commit()
        db.refresh(device)

        return TransitionResult(
            success=True,
            new_status=target.value,
            ticket_id=created_ticket_id,
            transfer_id=transfer_order_id,
        )

    except Exception as exc:
        db.rollback()
        return TransitionResult(
            success=False,
            new_status=target.value,
            errors=[str(exc)],
        )


# ── Convenience: single-endpoint transition parser ──────────────────────────

def parse_target(raw: str) -> Optional[DeviceStatus]:
    """Safely parse a raw status string into a DeviceStatus enum member."""
    try:
        return DeviceStatus(raw)
    except ValueError:
        return None
