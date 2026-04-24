from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import PartsInventory, User, Supplier, PartIntake, UnifiedCustomer, CustomerType
from schemas import PartsInventoryOut, PartsIntakeRequest, PartReceiveRequest, PartPriceRequest, PartIntakeOut, SupplierOut
from auth import get_current_user
import uuid

router = APIRouter(prefix="/api/parts", tags=["Parts"])

@router.post("/receive", response_model=PartIntakeOut)
def receive_parts(req: PartReceiveRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # SKU Generation: Model-Category-Quality (e.g., A2848-SCR-OEM)
    # Mapping categories and qualities to short codes
    cat_map = {"Screen": "SCR", "Battery": "BAT", "Charge Port": "CHG", "Camera": "CAM", "Back Glass": "BGL", "Speaker": "SPK"}
    qual_map = {"OEM": "OEM", "Aftermarket": "AFT", "Premium": "PRM"}
    
    cat_code = cat_map.get(req.category, req.category[:3].upper())
    qual_code = qual_map.get(req.quality, req.quality[:3].upper())
    sku = f"{req.model_number}-{cat_code}-{qual_code}"
    
    # Ensure Part exists in inventory
    part = db.query(PartsInventory).filter(
        PartsInventory.sku == sku,
        PartsInventory.org_id == current_user.current_org_id
    ).first()
    if not part:
        part = PartsInventory(
            sku=sku,
            part_name=f"{req.model_number} {req.category} ({req.quality})",
            current_stock_qty=0,
            moving_average_cost=0.0,
            org_id=current_user.current_org_id
        )
        db.add(part)
    
    # Update Stock
    part.current_stock_qty += req.qty
    
    # Log Unpriced Intake
    intake = PartIntake(
        sku=sku,
        qty=req.qty,
        supplier_id=req.supplier_id,
        is_priced=0,
        org_id=current_user.current_org_id
    )
    db.add(intake)
    db.commit()
    db.refresh(intake)
    return intake

@router.put("/price", response_model=PartsInventoryOut)
def price_intake(req: PartPriceRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    intake = db.query(PartIntake).filter(
        PartIntake.id == req.intake_id,
        PartIntake.org_id == current_user.current_org_id
    ).first()
    if not intake:
        raise HTTPException(status_code=404, detail="Intake record not found")
    
    if intake.is_priced == 1:
        raise HTTPException(status_code=400, detail="Intake already priced")
    
    part = db.query(PartsInventory).filter(
        PartsInventory.sku == intake.sku,
        PartsInventory.org_id == current_user.current_org_id
    ).first()
    
    # MAC Calculation: (Old Value + New Value) / (Old Qty + New Qty)
    # Landed Cost: New Value = total_price + shipping_fees
    old_qty = part.current_stock_qty - intake.qty
    total_old_value = old_qty * part.moving_average_cost
    
    landed_total_price = req.total_price + req.shipping_fees
    part.moving_average_cost = (total_old_value + landed_total_price) / part.current_stock_qty
    
    intake.total_price = req.total_price
    intake.is_priced = 1
    
    db.commit()
    db.refresh(part)
    return part

@router.get("/unpriced", response_model=List[PartIntakeOut])
def list_unpriced(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(PartIntake).filter(
        PartIntake.is_priced == 0,
        PartIntake.org_id == current_user.current_org_id
    ).all()

@router.get("/suppliers", response_model=List[SupplierOut])
def list_suppliers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Supplier).all()

@router.post("/seed")
def seed_mock_data(db: Session = Depends(get_db)):
    # 1. Suppliers
    suppliers = ["Phonelcdparts", "MobileSentrix", "GadgetFix"]
    for s_name in suppliers:
        if not db.query(Supplier).filter(Supplier.name == s_name).first():
            db.add(Supplier(name=s_name))
    
    # 2. Wholesale Customer
    if not db.query(UnifiedCustomer).filter(UnifiedCustomer.company_name == "Wholesale Partner X").first():
        db.add(UnifiedCustomer(
            crm_id=f"CRM-{uuid.uuid4().hex[:8].upper()}",
            customer_type=CustomerType.Wholesale,
            company_name="Wholesale Partner X",
            phone="555-0101",
            credit_limit=5000.0,
            payment_terms_days=15
        ))
    
    # 3. Parts Inventory
    models = ["A2848", "A2651", "A2633", "A2482", "A2341"]
    for m in models:
        for cat, code in [("Screen", "SCR"), ("Battery", "BAT")]:
            sku = f"{m}-{code}-OEM"
            if not db.query(PartsInventory).filter(PartsInventory.sku == sku).first():
                db.add(PartsInventory(
                    sku=sku,
                    part_name=f"{m} {cat} (OEM)",
                    current_stock_qty=10,
                    moving_average_cost=45.0 if cat == "Screen" else 15.0
                ))
    
    db.commit()
    return {"status": "success", "message": "Mock data seeded"}

@router.get("/", response_model=List[PartsInventoryOut])
def list_parts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(PartsInventory).filter(PartsInventory.org_id == current_user.current_org_id).all()
