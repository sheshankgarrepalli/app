from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
from database import get_db
from models import PartsInventory, User, Supplier, PartIntake, UnifiedCustomer, CustomerType
from schemas import (
    PartsInventoryOut, PartIntakeOut, PartReceiveRequest, PartPriceRequest,
    PartCreateRequest, PartUpdateRequest, PartIntakeRequest, PartReturnRequest,
    StockAdjustRequest, PartDetailOut, SupplierOut, LaborRateConfigOut,
    LaborRateConfigCreate, LaborRateConfigUpdate
)
from models import LaborRateConfig
from auth import get_current_user
import uuid

router = APIRouter(prefix="/api/parts", tags=["Parts"])


def _get_org_id(user: User) -> str:
    return getattr(user, 'current_org_id', None)


def _sku(model: str, category: str, quality: str) -> str:
    cat_map = {"Screen": "SCR", "Battery": "BAT", "Charge Port": "CHG",
               "Camera": "CAM", "Back Glass": "BGL", "Speaker": "SPK"}
    qual_map = {"OEM": "OEM", "Aftermarket": "AFT", "Premium": "PRM"}
    cat_code = cat_map.get(category, category[:3].upper())
    qual_code = qual_map.get(quality, quality[:3].upper())
    return f"{model}-{cat_code}-{qual_code}"


# ── Static routes FIRST (before parameterized routes) ────────────────────────

@router.get("/", response_model=List[PartsInventoryOut])
def list_parts(search: str = "", low_stock_only: bool = False,
               db: Session = Depends(get_db),
               current_user: User = Depends(get_current_user)):
    org_id = _get_org_id(current_user)
    q = db.query(PartsInventory).filter(PartsInventory.org_id == org_id)
    if search:
        q = q.filter(
            PartsInventory.sku.ilike(f"%{search}%") |
            PartsInventory.part_name.ilike(f"%{search}%")
        )
    if low_stock_only:
        q = q.filter(PartsInventory.current_stock_qty <= PartsInventory.low_stock_threshold)
    return q.order_by(PartsInventory.part_name).all()


@router.post("/", response_model=PartsInventoryOut, status_code=status.HTTP_201_CREATED)
def create_part(req: PartCreateRequest, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    org_id = _get_org_id(current_user)
    sku = _sku(req.model_number, req.category, req.quality)
    existing = db.query(PartsInventory).filter(
        PartsInventory.sku == sku, PartsInventory.org_id == org_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"SKU {sku} already exists")
    landed = req.total_price + req.shipping_fees
    mac = landed / req.qty if req.qty > 0 else 0.0
    part = PartsInventory(
        sku=sku, org_id=org_id,
        part_name=f"{req.model_number} {req.category} ({req.quality})",
        current_stock_qty=req.qty, moving_average_cost=mac, low_stock_threshold=5
    )
    db.add(part)
    db.add(PartIntake(sku=sku, org_id=org_id, qty=req.qty, total_price=landed,
                      is_priced=1, supplier_id=req.supplier_id))
    db.commit()
    db.refresh(part)
    return part


@router.post("/receive", response_model=PartIntakeOut)
def receive_parts(req: PartReceiveRequest, db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    org_id = _get_org_id(current_user)
    sku = _sku(req.model_number, req.category, req.quality)
    part = db.query(PartsInventory).filter(
        PartsInventory.sku == sku, PartsInventory.org_id == org_id
    ).first()
    if not part:
        part = PartsInventory(
            sku=sku, org_id=org_id,
            part_name=f"{req.model_number} {req.category} ({req.quality})",
            current_stock_qty=0, moving_average_cost=0.0
        )
        db.add(part)
    part.current_stock_qty += req.qty
    intake = PartIntake(sku=sku, org_id=org_id, qty=req.qty,
                        supplier_id=req.supplier_id, is_priced=0)
    db.add(intake)
    db.commit()
    db.refresh(intake)
    return intake


@router.put("/price", response_model=PartsInventoryOut)
def price_intake(req: PartPriceRequest, db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    org_id = _get_org_id(current_user)
    intake = db.query(PartIntake).filter(
        PartIntake.id == req.intake_id, PartIntake.org_id == org_id
    ).first()
    if not intake:
        raise HTTPException(status_code=404, detail="Intake record not found")
    if intake.is_priced == 1:
        raise HTTPException(status_code=400, detail="Intake already priced")
    part = db.query(PartsInventory).filter(
        PartsInventory.sku == intake.sku, PartsInventory.org_id == org_id
    ).first()
    old_qty = part.current_stock_qty - intake.qty
    total_old_value = old_qty * part.moving_average_cost
    landed = req.total_price + req.shipping_fees
    part.moving_average_cost = (total_old_value + landed) / part.current_stock_qty
    intake.total_price = req.total_price
    intake.is_priced = 1
    db.commit()
    db.refresh(part)
    return part


@router.get("/unpriced", response_model=List[PartIntakeOut])
def list_unpriced(db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    org_id = _get_org_id(current_user)
    return db.query(PartIntake).filter(
        PartIntake.is_priced == 0, PartIntake.org_id == org_id
    ).all()


# ── Suppliers ────────────────────────────────────────────────────────────────

@router.get("/suppliers", response_model=List[SupplierOut])
def list_suppliers(db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    org_id = _get_org_id(current_user)
    return db.query(Supplier).filter(
        (Supplier.org_id == org_id) | (Supplier.org_id == None)
    ).all()


@router.post("/suppliers", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
def create_supplier(name: str, db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    org_id = _get_org_id(current_user)
    existing = db.query(Supplier).filter(
        Supplier.name == name, Supplier.org_id == org_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Supplier already exists")
    supplier = Supplier(name=name, org_id=org_id)
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


# ── Labor Rates ──────────────────────────────────────────────────────────────

@router.get("/labor-rates", response_model=List[LaborRateConfigOut])
def list_labor_rates(db: Session = Depends(get_db),
                     current_user: User = Depends(get_current_user)):
    org_id = _get_org_id(current_user)
    return db.query(LaborRateConfig).filter(
        (LaborRateConfig.org_id == org_id) | (LaborRateConfig.org_id == None)
    ).all()


@router.post("/labor-rates", response_model=LaborRateConfigOut, status_code=status.HTTP_201_CREATED)
def create_labor_rate(req: LaborRateConfigCreate, db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    org_id = _get_org_id(current_user)
    existing = db.query(LaborRateConfig).filter(
        LaborRateConfig.action_name == req.action_name,
        LaborRateConfig.org_id == org_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Labor rate config already exists")
    cfg = LaborRateConfig(action_name=req.action_name, fee_amount=req.fee_amount, org_id=org_id)
    db.add(cfg)
    db.commit()
    db.refresh(cfg)
    return cfg


@router.put("/labor-rates/{rate_id}", response_model=LaborRateConfigOut)
def update_labor_rate(rate_id: int, req: LaborRateConfigUpdate,
                      db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    org_id = _get_org_id(current_user)
    cfg = db.query(LaborRateConfig).filter(
        LaborRateConfig.id == rate_id, LaborRateConfig.org_id == org_id
    ).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="Labor rate config not found")
    cfg.fee_amount = req.fee_amount
    db.commit()
    db.refresh(cfg)
    return cfg


@router.post("/seed")
def seed_mock_data(db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    org_id = _get_org_id(current_user)
    suppliers = ["Phonelcdparts", "MobileSentrix", "GadgetFix"]
    for s_name in suppliers:
        if not db.query(Supplier).filter(
            Supplier.name == s_name, Supplier.org_id == org_id
        ).first():
            db.add(Supplier(name=s_name, org_id=org_id))
    if not db.query(UnifiedCustomer).filter(
        UnifiedCustomer.company_name == "Wholesale Partner X"
    ).first():
        db.add(UnifiedCustomer(
            crm_id=f"CRM-{uuid.uuid4().hex[:8].upper()}",
            customer_type=CustomerType.Wholesale, company_name="Wholesale Partner X",
            phone="555-0101", credit_limit=5000.0, payment_terms_days=15
        ))
    models_list = ["A2848", "A2651", "A2633", "A2482", "A2341"]
    for m in models_list:
        for cat, code in [("Screen", "SCR"), ("Battery", "BAT")]:
            sku = f"{m}-{code}-OEM"
            if not db.query(PartsInventory).filter(
                PartsInventory.sku == sku, PartsInventory.org_id == org_id
            ).first():
                db.add(PartsInventory(
                    sku=sku, org_id=org_id, part_name=f"{m} {cat} (OEM)",
                    current_stock_qty=10,
                    moving_average_cost=45.0 if cat == "Screen" else 15.0
                ))
    defaults = [("QC_Standard", 5.0), ("Repair_Screen", 25.0), ("Repair_Battery", 15.0),
                ("Repair_Charge_Port", 20.0), ("Repair_Camera", 30.0),
                ("Repair_Back_Glass", 40.0), ("Repair_Speaker", 15.0)]
    for action, fee in defaults:
        if not db.query(LaborRateConfig).filter(
            LaborRateConfig.action_name == action, LaborRateConfig.org_id == org_id
        ).first():
            db.add(LaborRateConfig(action_name=action, fee_amount=fee, org_id=org_id))
    db.commit()
    return {"status": "success", "message": "Mock data seeded"}


# ── Parameterized SKU routes LAST ────────────────────────────────────────────

@router.get("/{sku}", response_model=PartDetailOut)
def get_part(sku: str, db: Session = Depends(get_db),
             current_user: User = Depends(get_current_user)):
    org_id = _get_org_id(current_user)
    part = db.query(PartsInventory).filter(
        PartsInventory.sku == sku, PartsInventory.org_id == org_id
    ).first()
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    intakes = db.query(PartIntake).filter(
        PartIntake.sku == sku, PartIntake.org_id == org_id
    ).order_by(desc(PartIntake.created_at)).all()
    valuation = part.current_stock_qty * part.moving_average_cost
    return PartDetailOut(
        sku=part.sku, part_name=part.part_name,
        current_stock_qty=part.current_stock_qty,
        moving_average_cost=part.moving_average_cost,
        low_stock_threshold=part.low_stock_threshold,
        created_at=part.created_at, intakes=intakes, total_valuation=valuation
    )


@router.put("/{sku}", response_model=PartsInventoryOut)
def update_part(sku: str, req: PartUpdateRequest, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    org_id = _get_org_id(current_user)
    part = db.query(PartsInventory).filter(
        PartsInventory.sku == sku, PartsInventory.org_id == org_id
    ).first()
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    if req.part_name is not None:
        part.part_name = req.part_name
    if req.low_stock_threshold is not None:
        part.low_stock_threshold = req.low_stock_threshold
    db.commit()
    db.refresh(part)
    return part


@router.post("/{sku}/intake", response_model=PartsInventoryOut)
def intake_stock(sku: str, req: PartIntakeRequest, db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    org_id = _get_org_id(current_user)
    part = db.query(PartsInventory).filter(
        PartsInventory.sku == sku, PartsInventory.org_id == org_id
    ).first()
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    landed = req.total_price + req.shipping_fees
    old_value = part.current_stock_qty * part.moving_average_cost
    part.current_stock_qty += req.qty
    part.moving_average_cost = (old_value + landed) / part.current_stock_qty
    db.add(PartIntake(sku=sku, org_id=org_id, qty=req.qty,
                      total_price=landed, is_priced=1, supplier_id=req.supplier_id))
    db.commit()
    db.refresh(part)
    return part


@router.post("/{sku}/return", response_model=PartsInventoryOut)
def return_to_supplier(sku: str, req: PartReturnRequest,
                       db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    org_id = _get_org_id(current_user)
    part = db.query(PartsInventory).filter(
        PartsInventory.sku == sku, PartsInventory.org_id == org_id
    ).first()
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    if req.qty > part.current_stock_qty:
        raise HTTPException(status_code=400, detail="Return qty exceeds stock")
    part.current_stock_qty -= req.qty
    db.add(PartIntake(sku=sku, org_id=org_id, qty=-req.qty,
                      total_price=-(req.qty * part.moving_average_cost),
                      is_priced=1, supplier_id=0))
    db.commit()
    db.refresh(part)
    return part


@router.post("/{sku}/adjust", response_model=PartsInventoryOut)
def adjust_stock(sku: str, req: StockAdjustRequest,
                 db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    org_id = _get_org_id(current_user)
    part = db.query(PartsInventory).filter(
        PartsInventory.sku == sku, PartsInventory.org_id == org_id
    ).first()
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    if req.new_qty < 0:
        raise HTTPException(status_code=400, detail="Stock cannot be negative")
    delta = req.new_qty - part.current_stock_qty
    part.current_stock_qty = req.new_qty
    db.add(PartIntake(sku=sku, org_id=org_id, qty=delta,
                      total_price=delta * part.moving_average_cost if delta > 0 else 0,
                      is_priced=1, supplier_id=0))
    db.commit()
    db.refresh(part)
    return part
