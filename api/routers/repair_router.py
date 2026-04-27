from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import RepairTicket, RepairStatus, DeviceInventory, DeviceCostLedger, RepairMapping, PartsInventory, User, RoleEnum, LaborRateConfig
from schemas import RepairTicketOut, RepairTicketCreate, RepairCompleteRequest
from auth import get_current_user
from datetime import datetime

router = APIRouter(prefix="/api/repair", tags=["Repair"])

@router.post("/triage", response_model=RepairTicketOut)
def triage_device(req: RepairTicketCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    device = db.query(DeviceInventory).filter(
        DeviceInventory.imei == req.imei,
        DeviceInventory.org_id == current_user.current_org_id
    ).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    # Create Ticket
    ticket = RepairTicket(
        imei=req.imei,
        symptoms=req.symptoms,
        notes=req.notes,
        status=RepairStatus.In_Repair,
        org_id=current_user.current_org_id
    )
    # Strictly force assignment
    ticket.org_id = current_user.current_org_id
    db.add(ticket)
    
    # Update Device Status
    device.device_status = "In_Repair"
    db.commit()
    db.refresh(ticket)
    return ticket

@router.get("/tickets", response_model=List[RepairTicketOut])
def list_tickets(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(RepairTicket).filter(
        RepairTicket.status != RepairStatus.Completed,
        RepairTicket.org_id == current_user.current_org_id
    ).all()

@router.post("/complete")
def complete_repair(req: RepairCompleteRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ticket = db.query(RepairTicket).filter(
        RepairTicket.imei == req.imei, 
        RepairTicket.status == RepairStatus.In_Repair,
        RepairTicket.org_id == current_user.current_org_id
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Active repair ticket not found")
    
    device = db.query(DeviceInventory).filter(
        DeviceInventory.imei == req.imei,
        DeviceInventory.org_id == current_user.current_org_id
    ).first()
    
    # --- THE GHOST ACCOUNTANT ---
    for category in req.work_completed:
        # 1. Find mapping for this model and category
        mapping = db.query(RepairMapping).filter(
            RepairMapping.device_model_number == device.model_number,
            RepairMapping.repair_category == category
        ).first()
        
        if mapping:
            # 2. Fetch Part MAC
            part = db.query(PartsInventory).filter(PartsInventory.sku == mapping.default_part_sku).first()
            if part and part.current_stock_qty > 0:
                # 3. Deduct Stock
                part.current_stock_qty -= 1
                
                # 4. Log Cost to Ledger
                ledger_entry = DeviceCostLedger(
                    imei=device.imei,
                    cost_type=f"Part: {category}",
                    amount=part.moving_average_cost,
                    org_id=current_user.current_org_id
                )
                # Strictly force assignment
                ledger_entry.org_id = current_user.current_org_id
                db.add(ledger_entry)
                
                # 5. Update Device Cost Basis
                device.cost_basis += part.moving_average_cost
            
            # 6. Log Labor Fee
            labor_rate = db.query(LaborRateConfig).filter(LaborRateConfig.action_name == f"Repair_{category}").first()
            if not labor_rate:
                # Fallback to a generic repair fee if specific one not found
                labor_rate = db.query(LaborRateConfig).filter(LaborRateConfig.action_name == "Repair_Standard").first()
            
            if labor_rate:
                labor_entry = DeviceCostLedger(
                    imei=device.imei,
                    cost_type=f"Labor: {category}",
                    amount=labor_rate.fee_amount,
                    org_id=current_user.current_org_id
                )
                # Strictly force assignment
                labor_entry.org_id = current_user.current_org_id
                db.add(labor_entry)
                device.cost_basis += labor_rate.fee_amount

    # Mark Ticket Complete
    ticket.status = RepairStatus.Completed
    ticket.completed_at = datetime.utcnow()
    ticket.assigned_tech_id = current_user.email
    
    # Update Device Status to QC (or Sellable if tech is final)
    device.device_status = "Sellable" # Or "In_QC"
    
    db.commit()
    return {"status": "success", "imei": req.imei}
