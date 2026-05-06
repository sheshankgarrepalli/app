from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import uuid
from datetime import datetime, timedelta

import models
import schemas
import auth
from database import get_db
from state_machine import execute_transition

router = APIRouter(prefix="/api/consignment", tags=["consignment"])


def _batch_id() -> str:
    return f"CONS-{uuid.uuid4().hex[:8].upper()}"


def _invoice_number(db: Session, org_id: str) -> str:
    count = db.query(models.Invoice).filter(
        models.Invoice.org_id == org_id
    ).count()
    return f"INV-{count + 1:04d}"


# ── list consignee customers ───────────────────────────────────────────────

@router.get("/customers/consignees", response_model=List[schemas.UnifiedCustomerOut])
def list_consignees(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin", "warehouse", "store"]))
):
    org_id = getattr(current_user, 'current_org_id', None)
    query = db.query(models.UnifiedCustomer).filter(
        models.UnifiedCustomer.org_id == org_id,
        models.UnifiedCustomer.customer_type == models.CustomerType.Wholesale,
        models.UnifiedCustomer.wholesale_subtype == models.WholesaleSubtype.Consignee,
        models.UnifiedCustomer.is_active == 1
    )
    if search:
        sf = f"%{search}%"
        query = query.filter(
            (models.UnifiedCustomer.company_name.ilike(sf)) |
            (models.UnifiedCustomer.contact_person.ilike(sf)) |
            (models.UnifiedCustomer.phone.ilike(sf))
        )
    return query.order_by(models.UnifiedCustomer.company_name).limit(30).all()


# ── create batch (handoff) ─────────────────────────────────────────────────

@router.post("/batches", response_model=schemas.ConsignmentBatchOut)
def create_batch(
    payload: schemas.ConsignmentBatchCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin", "warehouse", "store"]))
):
    org_id = getattr(current_user, 'current_org_id', None)

    customer = db.query(models.UnifiedCustomer).filter(
        models.UnifiedCustomer.crm_id == payload.crm_id,
        models.UnifiedCustomer.org_id == org_id,
        models.UnifiedCustomer.is_active == 1
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    if customer.wholesale_subtype != models.WholesaleSubtype.Consignee:
        raise HTTPException(status_code=400, detail="Customer is not a consignee")

    consignment_days = customer.default_consignment_days or 15
    batch = models.ConsignmentBatch(
        id=_batch_id(),
        org_id=org_id,
        crm_id=payload.crm_id,
        status=models.ConsignmentBatchStatus.Active,
        handoff_date=datetime.utcnow(),
        due_date=datetime.utcnow() + timedelta(days=consignment_days),
        notes=payload.notes,
        created_by_email=current_user.email
    )
    db.add(batch)
    db.flush()

    for item_data in payload.items:
        item = models.ConsignmentItem(
            batch_id=batch.id,
            imei=item_data.imei,
            sku=item_data.sku,
            description=item_data.description,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            outcome=models.ConsignmentItemOutcome.Pending
        )
        db.add(item)

        if item_data.imei:
            device = db.query(models.DeviceInventory).filter(
                models.DeviceInventory.imei == item_data.imei,
                models.DeviceInventory.org_id == org_id
            ).first()
            if not device:
                raise HTTPException(status_code=404, detail=f"Device {item_data.imei} not found")
            if device.device_status != models.DeviceStatus.Sellable:
                raise HTTPException(
                    status_code=400,
                    detail=f"Device {item_data.imei} is not Sellable (currently {device.device_status.value})"
                )
            result = execute_transition(
                db, device, models.DeviceStatus.On_Consignment,
                employee_id=current_user.email,
                notes=f"Consigned to {customer.company_name or customer.contact_person} (Batch {batch.id})"
            )
            if not result.success:
                raise HTTPException(status_code=400, detail=f"Failed to consign {item_data.imei}: {result.errors}")

    db.commit()
    db.refresh(batch)

    return _load_batch(db, batch.id, org_id)


# ── list batches ───────────────────────────────────────────────────────────

@router.get("/batches", response_model=List[schemas.ConsignmentBatchOut])
def list_batches(
    crm_id: Optional[str] = None,
    status: Optional[models.ConsignmentBatchStatus] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin", "warehouse", "store"]))
):
    org_id = getattr(current_user, 'current_org_id', None)
    query = db.query(models.ConsignmentBatch).filter(
        models.ConsignmentBatch.org_id == org_id
    )
    if crm_id:
        query = query.filter(models.ConsignmentBatch.crm_id == crm_id)
    if status:
        query = query.filter(models.ConsignmentBatch.status == status)

    return query.options(
        joinedload(models.ConsignmentBatch.customer),
        joinedload(models.ConsignmentBatch.items)
        .joinedload(models.ConsignmentItem.device)
        .joinedload(models.DeviceInventory.model)
    ).order_by(models.ConsignmentBatch.created_at.desc()).limit(50).all()


# ── get single batch ───────────────────────────────────────────────────────

@router.get("/batches/{batch_id}", response_model=schemas.ConsignmentBatchOut)
def get_batch(
    batch_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin", "warehouse", "store"]))
):
    org_id = getattr(current_user, 'current_org_id', None)
    batch = _load_batch(db, batch_id, org_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


# ── settle batch ───────────────────────────────────────────────────────────

@router.post("/batches/{batch_id}/settle", response_model=schemas.ConsignmentBatchOut)
def settle_batch(
    batch_id: str,
    payload: schemas.ConsignmentSettleRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin", "warehouse", "store"]))
):
    org_id = getattr(current_user, 'current_org_id', None)
    batch = db.query(models.ConsignmentBatch).filter(
        models.ConsignmentBatch.id == batch_id,
        models.ConsignmentBatch.org_id == org_id
    ).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    if batch.status != models.ConsignmentBatchStatus.Active:
        raise HTTPException(status_code=400, detail="Batch is already settled")

    # Collect sold and returned items
    sold_items = []
    returned_items = []

    for settle_item in payload.items:
        db_item = db.query(models.ConsignmentItem).filter(
            models.ConsignmentItem.id == settle_item.item_id,
            models.ConsignmentItem.batch_id == batch_id
        ).first()
        if not db_item:
            raise HTTPException(status_code=404, detail=f"Item {settle_item.item_id} not found in batch")

        if settle_item.outcome == models.ConsignmentItemOutcome.Sold:
            sold_qty = settle_item.settled_qty or db_item.quantity
            db_item.outcome = models.ConsignmentItemOutcome.Sold
            db_item.settled_qty = sold_qty
            db_item.settled_date = datetime.utcnow()
            sold_items.append((db_item, sold_qty))

            if db_item.imei:
                device = db.query(models.DeviceInventory).filter(
                    models.DeviceInventory.imei == db_item.imei,
                    models.DeviceInventory.org_id == org_id
                ).first()
                if device and device.device_status == models.DeviceStatus.On_Consignment:
                    execute_transition(
                        db, device, models.DeviceStatus.Sold,
                        employee_id=current_user.email,
                        notes=f"Sold via consignment settlement (Batch {batch_id})"
                    )

        elif settle_item.outcome == models.ConsignmentItemOutcome.Returned:
            returned_qty = settle_item.returned_qty or db_item.quantity
            db_item.outcome = models.ConsignmentItemOutcome.Returned
            db_item.returned_qty = returned_qty
            db_item.settled_date = datetime.utcnow()
            returned_items.append(db_item)

            if db_item.imei:
                device = db.query(models.DeviceInventory).filter(
                    models.DeviceInventory.imei == db_item.imei,
                    models.DeviceInventory.org_id == org_id
                ).first()
                if device and device.device_status == models.DeviceStatus.On_Consignment:
                    target_status = models.DeviceStatus.Sellable if payload.skip_qc else models.DeviceStatus.In_QC
                    execute_transition(
                        db, device, target_status,
                        employee_id=current_user.email,
                        notes=f"Returned from consignment (Batch {batch_id}){' - QC skipped' if payload.skip_qc else ''}"
                    )

    # Create invoice for sold items
    if sold_items:
        customer = db.query(models.UnifiedCustomer).filter(
            models.UnifiedCustomer.crm_id == batch.crm_id
        ).first()

        is_tax_exempt = bool(customer and customer.tax_exempt_id)
        subtotal = sum(item.unit_price * qty for item, qty in sold_items)
        tax_percent = 0.0 if is_tax_exempt else 8.25
        tax_amount = round(subtotal * tax_percent / 100, 2)
        total = subtotal + tax_amount

        invoice = models.Invoice(
            org_id=org_id,
            invoice_number=_invoice_number(db, org_id),
            customer_id=batch.crm_id,
            store_id=getattr(current_user, 'store_id', None),
            subtotal=subtotal,
            tax_percent=tax_percent,
            tax_amount=tax_amount,
            total=total,
            status=models.InvoiceStatus.Unpaid,
            payment_status=models.PaymentStatus.Unpaid,
            due_date=datetime.utcnow() + timedelta(days=customer.payment_terms_days if customer else 30),
            message_on_invoice=f"Consignment settlement — Batch {batch_id}",
            statement_memo=payload.notes or "",
            created_at=datetime.utcnow()
        )
        db.add(invoice)
        db.flush()

        for db_item, sold_qty in sold_items:
            db_item.resulting_invoice_id = invoice.id
            inv_item = models.InvoiceItem(
                invoice_id=invoice.id,
                imei=db_item.imei or "",
                model_number=db_item.sku or db_item.description,
                unit_price=db_item.unit_price
            )
            db.add(inv_item)

        # Handle payment if provided
        if payload.payment_amount and payload.payment_amount > 0 and payload.payment_method:
            payment = models.PaymentTransaction(
                org_id=org_id,
                invoice_id=invoice.id,
                amount=payload.payment_amount,
                payment_method=payload.payment_method,
                reference_id=payload.payment_reference or None
            )
            db.add(payment)

            if payload.payment_amount >= total:
                invoice.payment_status = models.PaymentStatus.Paid_in_Full
                invoice.status = models.InvoiceStatus.Paid
            else:
                invoice.payment_status = models.PaymentStatus.Partial_Layaway
                invoice.status = models.InvoiceStatus.Partially_Paid

    # Update batch status
    batch.status = models.ConsignmentBatchStatus.Settled
    batch.settled_date = datetime.utcnow()
    batch.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(batch)

    return _load_batch(db, batch.id, org_id)


# ── helper ─────────────────────────────────────────────────────────────────

def _load_batch(db: Session, batch_id: str, org_id: str):
    return db.query(models.ConsignmentBatch).filter(
        models.ConsignmentBatch.id == batch_id,
        models.ConsignmentBatch.org_id == org_id
    ).options(
        joinedload(models.ConsignmentBatch.customer),
        joinedload(models.ConsignmentBatch.items)
        .joinedload(models.ConsignmentItem.device)
        .joinedload(models.DeviceInventory.model)
    ).first()
