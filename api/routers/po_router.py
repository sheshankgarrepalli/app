from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
from datetime import datetime
from database import get_db
from models import PurchaseOrder, POItem, Supplier, PartsInventory, User
from schemas import PurchaseOrderCreate, PurchaseOrderOut, POReceiveItem
from auth import get_current_user
import uuid

router = APIRouter(prefix="/api/po", tags=["Purchase Orders"])


def _gen_po_number(db: Session, org_id: str) -> str:
    now = datetime.utcnow()
    yymm = now.strftime("%y%m")
    count = db.query(PurchaseOrder).filter(
        PurchaseOrder.po_number.like(f"PO-{yymm}-%"),
        PurchaseOrder.org_id == org_id
    ).count()
    seq = str(count + 1).zfill(4)
    return f"PO-{yymm}-{seq}"


@router.get("/", response_model=List[PurchaseOrderOut])
def list_pos(
    status_filter: str = "",
    store_id: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    org_id = getattr(current_user, 'current_org_id', None)
    q = db.query(PurchaseOrder).filter(PurchaseOrder.org_id == org_id)
    if status_filter:
        q = q.filter(PurchaseOrder.status == status_filter)
    if store_id:
        q = q.filter(PurchaseOrder.store_id == store_id)
    pos = q.order_by(desc(PurchaseOrder.created_at)).all()

    result = []
    for po in pos:
        items = db.query(POItem).filter(POItem.po_id == po.id).all()
        supplier = db.query(Supplier).filter(Supplier.id == po.supplier_id).first()
        result.append({
            **po.__dict__,
            "supplier_name": supplier.name if supplier else "",
            "items": items,
            "received_count": sum(i.quantity_received for i in items),
            "total_count": sum(i.quantity_ordered for i in items),
        })
    return result


@router.get("/{po_id}", response_model=PurchaseOrderOut)
def get_po(
    po_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    org_id = getattr(current_user, 'current_org_id', None)
    po = db.query(PurchaseOrder).filter(
        PurchaseOrder.id == po_id, PurchaseOrder.org_id == org_id
    ).first()
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")
    items = db.query(POItem).filter(POItem.po_id == po.id).all()
    supplier = db.query(Supplier).filter(Supplier.id == po.supplier_id).first()
    return {
        **po.__dict__,
        "supplier_name": supplier.name if supplier else "",
        "items": items,
        "received_count": sum(i.quantity_received for i in items),
        "total_count": sum(i.quantity_ordered for i in items),
    }


@router.post("/", response_model=PurchaseOrderOut, status_code=status.HTTP_201_CREATED)
def create_po(
    req: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    org_id = getattr(current_user, 'current_org_id', None)
    po_id = f"PO-{uuid.uuid4().hex[:8].upper()}"
    po_number = _gen_po_number(db, org_id)

    po = PurchaseOrder(
        id=po_id,
        org_id=org_id,
        po_number=po_number,
        supplier_id=req.supplier_id,
        store_id=req.store_id or current_user.store_id,
        status="Draft",
        expected_date=req.expected_date,
        shipping_cost=req.shipping_cost,
        tax_cost=req.tax_cost,
        total_cost=sum((i.unit_cost * i.quantity_ordered) for i in req.items) + req.shipping_cost + req.tax_cost,
        notes=req.notes,
        created_by_email=current_user.email,
    )
    db.add(po)
    db.flush()

    for item in req.items:
        pi = POItem(
            org_id=org_id,
            po_id=po_id,
            sku=item.sku,
            description=item.description,
            quantity_ordered=item.quantity_ordered,
            unit_cost=item.unit_cost,
            total_cost=item.unit_cost * item.quantity_ordered,
        )
        db.add(pi)

    db.commit()
    db.refresh(po)
    items = db.query(POItem).filter(POItem.po_id == po.id).all()
    supplier = db.query(Supplier).filter(Supplier.id == po.supplier_id).first()
    return {
        **po.__dict__,
        "supplier_name": supplier.name if supplier else "",
        "items": items,
        "received_count": 0,
        "total_count": sum(i.quantity_ordered for i in items),
    }


@router.post("/{po_id}/receive", response_model=PurchaseOrderOut)
def receive_po_items(
    po_id: str,
    items: List[POReceiveItem],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    org_id = getattr(current_user, 'current_org_id', None)
    po = db.query(PurchaseOrder).filter(
        PurchaseOrder.id == po_id, PurchaseOrder.org_id == org_id
    ).first()
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")

    for recv in items:
        pi = db.query(POItem).filter(
            POItem.id == recv.item_id, POItem.po_id == po_id
        ).first()
        if not pi:
            raise HTTPException(status_code=404, detail=f"PO item {recv.item_id} not found")
        received = pi.quantity_received + recv.qty
        if received > pi.quantity_ordered:
            raise HTTPException(status_code=400, detail=f"Cannot receive more than ordered for {pi.description}")
        pi.quantity_received = received
        pi.total_cost = pi.unit_cost * received

        if pi.sku:
            part = db.query(PartsInventory).filter(
                PartsInventory.sku == pi.sku, PartsInventory.org_id == org_id
            ).first()
            if part:
                part.current_stock_qty += recv.qty
                landed = recv.qty * pi.unit_cost
                old_value = (part.current_stock_qty - recv.qty) * part.moving_average_cost
                part.moving_average_cost = (old_value + landed) / part.current_stock_qty if part.current_stock_qty > 0 else pi.unit_cost

    all_items = db.query(POItem).filter(POItem.po_id == po_id).all()
    total_received = sum(i.quantity_received for i in all_items)
    total_ordered = sum(i.quantity_ordered for i in all_items)
    if total_received >= total_ordered:
        po.status = "Received"
        po.received_date = datetime.utcnow()
    elif total_received > 0:
        po.status = "Partially_Received"

    db.commit()
    db.refresh(po)
    supplier = db.query(Supplier).filter(Supplier.id == po.supplier_id).first()
    return {
        **po.__dict__,
        "supplier_name": supplier.name if supplier else "",
        "items": all_items,
        "received_count": total_received,
        "total_count": total_ordered,
    }


@router.post("/{po_id}/cancel")
def cancel_po(
    po_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    org_id = getattr(current_user, 'current_org_id', None)
    po = db.query(PurchaseOrder).filter(
        PurchaseOrder.id == po_id, PurchaseOrder.org_id == org_id
    ).first()
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")
    if po.status == "Received":
        raise HTTPException(status_code=400, detail="Cannot cancel a fully received PO")
    po.status = "Cancelled"
    db.commit()
    return {"status": "cancelled", "po_id": po_id}
