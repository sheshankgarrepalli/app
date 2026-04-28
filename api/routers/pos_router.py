from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import models, schemas, auth, wms_core
from database import get_db
import io
import uuid
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import pdf_worker
from wholesale_invoice_pdf import generate_wholesale_invoice_pdf

router = APIRouter(prefix="/api/pos", tags=["pos"])

@router.post("/checkout", response_model=schemas.InvoiceOut)
def retail_checkout(
    req: schemas.RetailCheckoutRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["store_a", "store_b", "store_c"]))
):
    customer_id = req.customer_id
    if not customer_id and req.customer:
        db_customer = models.UnifiedCustomer(org_id=current_user.current_org_id, **req.customer.model_dump())
        db_customer.crm_id = f"CRM-{uuid.uuid4().hex[:8].upper()}"
        db.add(db_customer)
        db.flush()
        db.refresh(db_customer)
        customer_id = db_customer.crm_id
        
    if not customer_id:
        raise HTTPException(status_code=400, detail="Customer info required")
        
    customer_db_obj = db.query(models.UnifiedCustomer).filter(
        models.UnifiedCustomer.crm_id == customer_id,
        models.UnifiedCustomer.org_id == current_user.current_org_id
    ).first()
    
    subtotal = 0.0
    for item in req.items:
        db_store_inv = db.query(models.DeviceInventory).filter(
            models.DeviceInventory.imei == item.imei,
            models.DeviceInventory.location_id == current_user.role,
            models.DeviceInventory.org_id == current_user.current_org_id,
            models.DeviceInventory.device_status == models.DeviceStatus.Sellable
        ).first()
        if not db_store_inv:
            raise HTTPException(status_code=400, detail=f"IMEI {item.imei} not sellable at your store")
        
        # device_status is set below based on total payments
        db_store_inv.sold_to_crm_id = customer_id
        
        applied_price = item.unit_price
        if customer_db_obj and customer_db_obj.pricing_tier > 0:
            applied_price = applied_price * (1.0 - customer_db_obj.pricing_tier)
            
        subtotal += applied_price

    final_tax_percent = req.tax_percent
    if customer_db_obj and customer_db_obj.tax_exempt_id:
        final_tax_percent = 0.0

    tax_amount = subtotal * (final_tax_percent / 100)
    total = subtotal + tax_amount
    
    # Strict Math Validation (Allow layaway)
    total_payments = sum(p.amount for p in req.payments)
    if total_payments > total + 0.01:
        raise HTTPException(status_code=400, detail=f"Payment sum ({total_payments}) exceeds invoice total ({total})")
    
    last_invoice = db.query(models.Invoice).filter(models.Invoice.org_id == current_user.current_org_id).order_by(models.Invoice.id.desc()).first()
    next_id = last_invoice.id + 1 if last_invoice else 1
    invoice_number = f"INV-{next_id:04d}"
    
    db_invoice = models.Invoice(
        invoice_number=invoice_number,
        customer_id=customer_id,
        store_id=current_user.store_id or current_user.role,
        subtotal=subtotal,
        tax_percent=final_tax_percent,
        tax_amount=tax_amount,
        total=total,
        fulfillment_method=req.fulfillment_method,
        shipping_address=req.shipping_address,
        status=models.InvoiceStatus.Paid if total_payments >= total - 0.01 else models.InvoiceStatus.Partially_Paid,
        payment_status=models.PaymentStatus.Paid_in_Full if total_payments >= total - 0.01 else models.PaymentStatus.Partial_Layaway,
        org_id=current_user.current_org_id
    )
    db_invoice.org_id = current_user.current_org_id
    db.add(db_invoice)
    db.flush()
    
    from datetime import timedelta
    warranty_expiry = datetime.utcnow() + timedelta(days=15)
    
    for item in req.items:
        db_store_inv = db.query(models.DeviceInventory).filter(
            models.DeviceInventory.imei == item.imei,
            models.DeviceInventory.org_id == current_user.current_org_id
        ).first()
        if total_payments >= total - 0.01:
            db_store_inv.device_status = models.DeviceStatus.Sold
        else:
            db_store_inv.device_status = models.DeviceStatus.Reserved_Layaway
            
        db_store_inv.warranty_expiry_date = warranty_expiry
        
        db_item = models.InvoiceItem(
            invoice_id=db_invoice.id,
            imei=item.imei,
            model_number=db_store_inv.model_number,
            unit_price=item.unit_price
        )
        db.add(db_item)
        
    for p in req.payments:
        db_payment = models.PaymentTransaction(
            invoice_id=db_invoice.id,
            amount=p.amount,
            payment_method=p.payment_method,
            reference_id=p.reference_id,
            org_id=current_user.current_org_id
        )
        db_payment.org_id = current_user.current_org_id
        db.add(db_payment)
        
    db.commit()
    db.refresh(db_invoice)
    return db_invoice

@router.post("/invoice", response_model=schemas.InvoiceOut)
def create_invoice(invoice: schemas.InvoiceCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role(["store_a", "store_b", "store_c"]))):
    customer_id = invoice.customer_id
    if not customer_id and invoice.customer:
        db_customer = models.UnifiedCustomer(org_id=current_user.current_org_id, **invoice.customer.model_dump())
        db_customer.crm_id = f"CRM-{uuid.uuid4().hex[:8].upper()}"
        db.add(db_customer)
        db.commit()
        db.refresh(db_customer)
        customer_id = db_customer.crm_id
        
    if not customer_id:
        raise HTTPException(status_code=400, detail="Customer info required")
        
    customer_db_obj = db.query(models.UnifiedCustomer).filter(
        models.UnifiedCustomer.crm_id == customer_id,
        models.UnifiedCustomer.org_id == current_user.current_org_id
    ).first()
    
    subtotal = 0.0
    for item in invoice.items:
        db_store_inv = db.query(models.DeviceInventory).filter(
            models.DeviceInventory.imei == item.imei,
            models.DeviceInventory.location_id == current_user.role,
            models.DeviceInventory.org_id == current_user.current_org_id,
            models.DeviceInventory.device_status == models.DeviceStatus.Sellable
        ).first()
        if not db_store_inv:
            raise HTTPException(status_code=400, detail=f"IMEI {item.imei} not sellable at your store")
        
        db_store_inv.device_status = models.DeviceStatus.Sold
        
        applied_price = item.unit_price
        if customer_db_obj and customer_db_obj.pricing_tier > 0:
            applied_price = applied_price * (1.0 - customer_db_obj.pricing_tier)
            
        subtotal += applied_price

    final_tax_percent = invoice.tax_percent
    if customer_db_obj and customer_db_obj.tax_exempt_id:
        final_tax_percent = 0.0

    tax_amount = subtotal * (final_tax_percent / 100)
    total = subtotal + tax_amount
    
    last_invoice = db.query(models.Invoice).filter(models.Invoice.org_id == current_user.current_org_id).order_by(models.Invoice.id.desc()).first()
    next_id = last_invoice.id + 1 if last_invoice else 1
    invoice_number = f"INV-{next_id:04d}"
    
    db_invoice = models.Invoice(
        invoice_number=invoice_number,
        customer_id=customer_id,
        store_id=current_user.store_id or current_user.role,
        subtotal=subtotal,
        tax_percent=final_tax_percent,
        tax_amount=tax_amount,
        total=total,
        fulfillment_method=invoice.fulfillment_method,
        shipping_address=invoice.shipping_address,
        org_id=current_user.current_org_id
    )
    db_invoice.org_id = current_user.current_org_id
    db.add(db_invoice)
    db.commit()
    db.refresh(db_invoice)
    
    from datetime import timedelta
    warranty_expiry = db_invoice.created_at + timedelta(days=15)
    
    for item in invoice.items:
        db_store_inv = db.query(models.DeviceInventory).filter(
            models.DeviceInventory.imei == item.imei,
            models.DeviceInventory.org_id == current_user.current_org_id
        ).first()
        db_store_inv.warranty_expiry_date = warranty_expiry
        
        db_item = models.InvoiceItem(
            invoice_id=db_invoice.id,
            imei=item.imei,
            model_number=db_store_inv.model_number,
            unit_price=item.unit_price
        )
        db.add(db_item)
        
    db.commit()
    db.refresh(db_invoice)
    return db_invoice

@router.post("/wholesale")
def wholesale_checkout(
    req: schemas.BulkCheckoutRequest, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))
):
    """
    Direct endpoint for Wholesale POS: Processes checkout and returns binary PDF.
    """
    try:
        invoice_data = wms_core.process_bulk_checkout(
            db, 
            req.imei_list, 
            req.crm_id, 
            current_user.email,
            org_id=current_user.current_org_id,
            fulfillment_method=req.fulfillment_method,
            shipping_address=req.shipping_address,
            payment_method=req.payment_method or "Cash",
            is_estimate=req.is_estimate or False,
            upfront_payment=req.upfront_payment or 0.0
        )
        pdf_bytes = pdf_worker.generate_wholesale_invoice_pdf(invoice_data) if hasattr(auth, 'pdf_worker') else generate_wholesale_invoice_pdf(invoice_data)
        
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={invoice_data['invoice_id']}.pdf"
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Wholesale checkout failed: {str(e)}")

@router.post("/estimates/{invoice_id}/convert")
def convert_estimate(
    invoice_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))
):
    invoice = db.query(models.Invoice).filter(
        models.Invoice.invoice_number == invoice_id,
        models.Invoice.is_estimate == 1,
        models.Invoice.org_id == current_user.current_org_id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Estimate not found")

    # Check if devices are still sellable
    items = db.query(models.InvoiceItem).filter(models.InvoiceItem.invoice_id == invoice.id).all()
    imeis = [item.imei for item in items]
    devices = db.query(models.DeviceInventory).filter(
        models.DeviceInventory.imei.in_(imeis),
        models.DeviceInventory.org_id == current_user.current_org_id
    ).all()
    
    for device in devices:
        if device.device_status != models.DeviceStatus.Sellable:
            raise HTTPException(status_code=400, detail=f"Device {device.imei} is no longer sellable (Status: {device.device_status.value})")
    
    # Update devices to Sold
    for device in devices:
        prev_status = device.device_status.value
        device.device_status = models.DeviceStatus.Sold
        device.sold_to_crm_id = invoice.customer_id
        wms_core._log_history(db, device.imei, "Estimate_Converted", current_user.email, device.device_status.value, prev_status, f"Converted from Estimate {invoice.invoice_number}")
    
    # Update B2B Credit Ledger if needed
    customer = db.query(models.UnifiedCustomer).filter(
        models.UnifiedCustomer.crm_id == invoice.customer_id,
        models.UnifiedCustomer.org_id == current_user.current_org_id
    ).first()
    if any(p.payment_method == models.PaymentMethodEnum.On_Terms for p in invoice.payments):
        if customer.current_balance + invoice.total > customer.credit_limit:
            raise HTTPException(status_code=400, detail="Credit limit exceeded")
        customer.current_balance += invoice.total
    
    # Convert to Invoice
    invoice.is_estimate = 0
    invoice.status = models.InvoiceStatus.Unpaid
    invoice.invoice_number = invoice.invoice_number.replace("EST-", "INV-")
    
    db.commit()
    
    # Generate PDF
    # Reconstruct invoice_data for PDF
    invoice_data = {
        "invoice_id": invoice.invoice_number,
        "date": invoice.created_at.isoformat(),
        "customer": {
            "crm_id": customer.crm_id,
            "name": customer.company_name or f"{customer.first_name} {customer.last_name}".strip() or customer.name,
            "tax_exempt_id": customer.tax_exempt_id
        },
        "fulfillment": {
            "method": invoice.fulfillment_method,
            "shipping_address": invoice.shipping_address
        },
        "payment_method": invoice.payment_method,
        "lines": [{"imei": i.imei, "model": i.model_number, "final_price": i.unit_price} for i in items],
        "summary": {
            "total_items": len(items),
            "subtotal": invoice.subtotal,
            "tax_percent": invoice.tax_percent,
            "total_due": invoice.total
        }
    }
    pdf_bytes = generate_wholesale_invoice_pdf(invoice_data)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={invoice.invoice_number}.pdf"}
    )

@router.post("/invoices/{invoice_id}/payments")
def process_payment(
    invoice_id: str,
    payment: schemas.PaymentSchema,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))
):
    invoice = db.query(models.Invoice).filter(
        models.Invoice.invoice_number == invoice_id,
        models.Invoice.org_id == current_user.current_org_id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    db_payment = models.PaymentTransaction(
        org_id=current_user.current_org_id,
        invoice_id=invoice.id,
        amount=payment.amount,
        payment_method=payment.payment_method,
        reference_id=payment.reference_id
    )
    db_payment.org_id = current_user.current_org_id
    db.add(db_payment)
    db.commit()
    db.refresh(invoice)
    
    # Layaway State Machine
    total_paid = sum(p.amount for p in invoice.payments)
    
    if total_paid < invoice.total:
        invoice.payment_status = models.PaymentStatus.Partial_Layaway
        invoice.status = models.InvoiceStatus.Partially_Paid
        for item in invoice.items:
            device = db.query(models.DeviceInventory).filter(
                models.DeviceInventory.imei == item.imei,
                models.DeviceInventory.org_id == current_user.current_org_id
            ).first()
            if device and device.device_status != models.DeviceStatus.Reserved_Layaway:
                prev_status = device.device_status.value if device.device_status else "Unknown"
                device.device_status = models.DeviceStatus.Reserved_Layaway
                wms_core._log_history(db, device.imei, "Layaway_Reserved", current_user.email, device.device_status.value, prev_status, f"Reserved for layaway on Invoice {invoice.invoice_number}")
    else:
        invoice.payment_status = models.PaymentStatus.Paid_in_Full
        invoice.status = models.InvoiceStatus.Paid
        for item in invoice.items:
            device = db.query(models.DeviceInventory).filter(
                models.DeviceInventory.imei == item.imei,
                models.DeviceInventory.org_id == current_user.current_org_id
            ).first()
            if device and device.device_status != models.DeviceStatus.Sold:
                prev_status = device.device_status.value if device.device_status else "Unknown"
                device.device_status = models.DeviceStatus.Sold
                wms_core._log_history(db, device.imei, "Invoice_Paid_Full", current_user.email, device.device_status.value, prev_status, f"Paid in full on Invoice {invoice.invoice_number}")
    
    # If it was "On Terms", increase customer balance (charging to account)
    # For other payment methods, decrease balance (paying down the tab)
    if payment.payment_method == models.PaymentMethodEnum.On_Terms:
        customer = db.query(models.UnifiedCustomer).filter(
            models.UnifiedCustomer.crm_id == invoice.customer_id,
            models.UnifiedCustomer.org_id == current_user.current_org_id
        ).first()
        if customer:
            customer.current_balance += payment.amount
    else:
        customer = db.query(models.UnifiedCustomer).filter(
            models.UnifiedCustomer.crm_id == invoice.customer_id,
            models.UnifiedCustomer.org_id == current_user.current_org_id
        ).first()
        if customer:
            customer.current_balance -= payment.amount
            if customer.current_balance < 0:
                customer.current_balance = 0
        
    db.commit()
    return {"status": "success", "total_paid": total_paid, "payment_status": invoice.payment_status}

@router.put("/invoices/{invoice_id}")
def update_invoice(
    invoice_id: str,
    req: schemas.InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))
):
    invoice = db.query(models.Invoice).filter(
        models.Invoice.invoice_number == invoice_id,
        models.Invoice.org_id == current_user.current_org_id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status not in [models.InvoiceStatus.Unpaid, models.InvoiceStatus.Draft]:
        raise HTTPException(status_code=400, detail=f"Cannot edit invoice with status {invoice.status.value}")

    # Identify removed IMEIs
    old_items = db.query(models.InvoiceItem).filter(models.InvoiceItem.invoice_id == invoice.id).all()
    old_imeis = {item.imei for item in old_items}
    new_imeis = {item.imei for item in req.items}
    removed_imeis = old_imeis - new_imeis
    added_imeis = new_imeis - old_imeis

    # Restore removed IMEIs to Sellable
    if removed_imeis:
        devices_to_restore = db.query(models.DeviceInventory).filter(models.DeviceInventory.imei.in_(list(removed_imeis))).all()
        for device in devices_to_restore:
            prev_status = device.device_status.value
            device.device_status = models.DeviceStatus.Sellable
            device.sold_to_crm_id = None
            wms_core._log_history(db, device.imei, "Invoice_Edited_Restored", current_user.email, device.device_status.value, prev_status, f"Removed from Invoice {invoice.invoice_number}")

    # Mark added IMEIs as Sold
    if added_imeis:
        devices_to_sell = db.query(models.DeviceInventory).filter(models.DeviceInventory.imei.in_(list(added_imeis))).all()
        for device in devices_to_sell:
            if device.device_status != models.DeviceStatus.Sellable:
                raise HTTPException(status_code=400, detail=f"Device {device.imei} is not sellable")
            prev_status = device.device_status.value
            device.device_status = models.DeviceStatus.Sold
            device.sold_to_crm_id = invoice.customer_id
            wms_core._log_history(db, device.imei, "Invoice_Edited_Sold", current_user.email, device.device_status.value, prev_status, f"Added to Invoice {invoice.invoice_number}")

    # Update Invoice Items
    db.query(models.InvoiceItem).filter(models.InvoiceItem.invoice_id == invoice.id).delete()
    subtotal = 0.0
    for item in req.items:
        db_item = models.InvoiceItem(
            invoice_id=invoice.id,
            imei=item.imei,
            model_number=db.query(models.DeviceInventory).filter(models.DeviceInventory.imei == item.imei).first().model_number,
            unit_price=item.unit_price
        )
        db.add(db_item)
        subtotal += item.unit_price

    # Update Invoice Totals
    customer = db.query(models.UnifiedCustomer).filter(models.UnifiedCustomer.crm_id == invoice.customer_id).first()
    tax_percent = 0.0 if customer.tax_exempt_id else 8.5
    tax_amount = subtotal * (tax_percent / 100)
    new_total = subtotal + tax_amount

    # Update Credit Ledger
    if any(p.payment_method == models.PaymentMethodEnum.On_Terms for p in invoice.payments):
        old_total = invoice.total
        total_paid = sum(p.amount for p in invoice.payments if p.payment_method != models.PaymentMethodEnum.On_Terms)
        old_unpaid = old_total - total_paid
        new_unpaid = new_total - total_paid
        
        customer.current_balance = customer.current_balance - old_unpaid + new_unpaid
        if customer.current_balance < 0: customer.current_balance = 0

    invoice.subtotal = subtotal
    invoice.tax_percent = tax_percent
    invoice.tax_amount = tax_amount
    invoice.total = new_total
    
    db.commit()
    return {"status": "success", "invoice_number": invoice.invoice_number}

@router.post("/returns")
def process_returns(
    req: schemas.RMARequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))
):
    results = []
    total_credit_applied = 0.0
    
    for imei in req.imei_list:
        # Find original sale
        item = db.query(models.InvoiceItem).filter(models.InvoiceItem.imei == imei).join(models.Invoice).filter(
            models.Invoice.org_id == current_user.current_org_id
        ).order_by(models.Invoice.created_at.desc()).first()
        if not item:
            results.append({"imei": imei, "status": "Error", "message": "No sale record found"})
            continue
            
        invoice = item.invoice
        days_since_sale = (datetime.utcnow() - invoice.created_at).days
        
        if days_since_sale > 15 and not req.override_policy:
            raise HTTPException(status_code=400, detail=f"Return Period Expired: Exceeds 15 Days (Sold {days_since_sale} days ago)")

        device = db.query(models.DeviceInventory).filter(
            models.DeviceInventory.imei == imei,
            models.DeviceInventory.org_id == current_user.current_org_id
        ).first()
        prev_status = device.device_status.value
        device.device_status = models.DeviceStatus.In_QC
        device.location_id = "Warehouse_Alpha"
        device.sold_to_crm_id = None

        return_value = item.unit_price
        customer = db.query(models.UnifiedCustomer).filter(
            models.UnifiedCustomer.crm_id == invoice.customer_id,
            models.UnifiedCustomer.org_id == current_user.current_org_id
        ).first()
        if customer and customer.pricing_tier > 0:
            return_value = return_value * (1.0 - customer.pricing_tier)
        
        # Add tax if applicable
        if invoice.tax_percent > 0:
            return_value += return_value * (invoice.tax_percent / 100)
            
        if invoice.status in [models.InvoiceStatus.Unpaid, models.InvoiceStatus.Partially_Paid]:
            # Apply credit to this specific invoice
            # We'll log it as a negative payment or just adjust the balance logic
            # For simplicity in this ERP, we'll deduct from customer balance if it was "On Terms"
            if any(p.payment_method == models.PaymentMethodEnum.On_Terms for p in invoice.payments):
                customer.current_balance -= return_value
                if customer.current_balance < 0: customer.current_balance = 0
                total_credit_applied += return_value
        
        wms_core._log_history(db, imei, "RMA_Return", current_user.email, device.device_status.value, prev_status, f"Returned from Invoice {invoice.invoice_number}")
        results.append({"imei": imei, "status": "Success", "days_since_sale": days_since_sale, "credit_applied": return_value})
        
    db.commit()
    return {"results": results, "total_credit_applied": total_credit_applied}

@router.get("/invoices", response_model=List[schemas.InvoiceOut])
def list_invoices(
    query: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    try:
        stmt = db.query(models.Invoice).filter(models.Invoice.org_id == current_user.current_org_id)

        # Admin bypasses the store filter
        if current_user.role != "admin":
            if not current_user.store_id:
                return []
            stmt = stmt.filter(models.Invoice.store_id == current_user.store_id)
            
        if query:
            # Search by Invoice Number, Customer Name, or Device Identifier (IMEI/Serial)
            stmt = stmt.join(models.UnifiedCustomer, isouter=True).join(models.InvoiceItem, isouter=True)
            from sqlalchemy import or_
            conditions = [
                models.Invoice.invoice_number.ilike(f"%{query}%"),
                models.UnifiedCustomer.name.ilike(f"%{query}%"),
                models.UnifiedCustomer.company_name.ilike(f"%{query}%"),
                models.InvoiceItem.imei == query
            ]
            # Also check serial number via DeviceInventory
            imei_from_serial = db.query(models.DeviceInventory.imei).filter(
                models.DeviceInventory.serial_number == query,
                models.DeviceInventory.org_id == current_user.current_org_id
            ).scalar()
            if imei_from_serial:
                conditions.append(models.InvoiceItem.imei == imei_from_serial)
            stmt = stmt.filter(or_(*conditions))

        return stmt.order_by(models.Invoice.created_at.desc()).all()
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500, 
            detail={"detail": "Database Error", "message": str(e)}
        )

@router.get("/crm/{crm_id}/statement")
def get_client_statement(
    crm_id: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))
):
    customer = db.query(models.UnifiedCustomer).filter(
        models.UnifiedCustomer.crm_id == crm_id,
        models.UnifiedCustomer.org_id == current_user.current_org_id
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    query = db.query(models.Invoice).filter(
        models.Invoice.customer_id == crm_id,
        models.Invoice.is_estimate == 0,
        models.Invoice.org_id == current_user.current_org_id
    )
    if start_date:
        query = query.filter(models.Invoice.created_at >= start_date)
    if end_date:
        query = query.filter(models.Invoice.created_at <= end_date)
    
    invoices = query.order_by(models.Invoice.created_at.asc()).all()
    
    # Generate Statement Data
    statement_data = {
        "customer": {
            "crm_id": customer.crm_id,
            "name": customer.company_name or f"{customer.first_name} {customer.last_name}".strip() or customer.name,
            "phone": customer.phone,
            "email": customer.email
        },
        "period": {
            "start": start_date.isoformat() if start_date else "Beginning",
            "end": end_date.isoformat() if end_date else "Present"
        },
        "invoices": [],
        "total_invoiced": 0.0,
        "total_paid": 0.0,
        "outstanding_balance": customer.current_balance
    }
    
    for inv in invoices:
        inv_paid = sum(p.amount for p in inv.payments)
        statement_data["invoices"].append({
            "number": inv.invoice_number,
            "date": inv.created_at.isoformat(),
            "total": inv.total,
            "paid": inv_paid,
            "balance": inv.total - inv_paid,
            "status": inv.status.value
        })
        statement_data["total_invoiced"] += inv.total
        statement_data["total_paid"] += inv_paid
        
    # For now, we'll reuse the invoice PDF generator or a simplified version
    # Since I don't have a specific statement PDF worker, I'll generate a simple one here
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, 750, f"CLIENT STATEMENT: {statement_data['customer']['name']}")
    c.setFont("Helvetica", 10)
    c.drawString(50, 735, f"CRM ID: {statement_data['customer']['crm_id']} | Period: {statement_data['period']['start']} to {statement_data['period']['end']}")
    
    y = 700
    c.setFont("Helvetica-Bold", 10)
    c.drawString(50, y, "Invoice #")
    c.drawString(150, y, "Date")
    c.drawString(250, y, "Total")
    c.drawString(350, y, "Paid")
    c.drawString(450, y, "Balance")
    y -= 20
    
    c.setFont("Helvetica", 10)
    for inv in statement_data["invoices"]:
        c.drawString(50, y, inv["number"])
        c.drawString(150, y, inv["date"][:10])
        c.drawString(250, y, f"${inv['total']:.2f}")
        c.drawString(350, y, f"${inv['paid']:.2f}")
        c.drawString(450, y, f"${inv['balance']:.2f}")
        y -= 15
        if y < 50:
            c.showPage()
            y = 750
            
    y -= 20
    c.setFont("Helvetica-Bold", 12)
    c.drawString(350, y, "Total Outstanding:")
    c.drawString(450, y, f"${statement_data['outstanding_balance']:.2f}")
    
    c.save()
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=statement_{crm_id}.pdf"})

@router.get("/next-number")
def get_next_number(type: str = Query("invoice"), db: Session = Depends(get_db)):
    prefix = "INV" if type.lower() == "invoice" else "TO"
    safe_default = f"{prefix}-1000"

    try:
        # Attempt to query the database for the latest record
        if type.lower() == "invoice":
            last_record = db.query(models.Invoice).order_by(models.Invoice.id.desc()).first()
            if last_record and last_record.invoice_number:
                parts = last_record.invoice_number.split("-")
                if len(parts) == 2 and parts[1].isdigit():
                    next_num = int(parts[1]) + 1
                    return {"next_number": f"{prefix}-{next_num}"}
        elif type.lower() == "transfer":
            last_record = db.query(models.TransferOrder).order_by(models.TransferOrder.id.desc()).first()
            if last_record and last_record.id: # id is the TO number in this model
                parts = last_record.id.split("-")
                if len(parts) == 2 and parts[1].isdigit():
                    next_num = int(parts[1]) + 1
                    return {"next_number": f"{prefix}-{next_num}"}

        return {"next_number": safe_default}

    except Exception as e:
        import sys
        print(f"CRITICAL ERROR in next-number generation: {e}", file=sys.stderr)
        return {"next_number": safe_default}

@router.get("/locations")
def get_locations(current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))):
    # Standard locations mapping from RoleEnum
    return [
        {"id": "Warehouse_Alpha", "name": "Main Warehouse"},
        {"id": "store_a", "name": "Store A (Downtown)"},
        {"id": "store_b", "name": "Store B (Uptown)"},
        {"id": "store_c", "name": "Store C (Plaza)"}
    ]
