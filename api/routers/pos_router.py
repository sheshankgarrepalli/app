from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import models, schemas, auth, wms_core
from database import get_db
import io
import uuid
import json
from datetime import timedelta
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
    org_id = getattr(current_user, 'current_org_id', None)
    customer_id = req.customer_id
    if not customer_id and req.customer:
        db_customer = models.UnifiedCustomer(org_id=org_id, **req.customer.model_dump())
        db_customer.crm_id = f"CRM-{uuid.uuid4().hex[:8].upper()}"
        db.add(db_customer)
        db.flush()
        db.refresh(db_customer)
        customer_id = db_customer.crm_id
        
    if not customer_id:
        raise HTTPException(status_code=400, detail="Customer info required")
        
    customer_db_obj = db.query(models.UnifiedCustomer).filter(
        models.UnifiedCustomer.crm_id == customer_id,
        models.UnifiedCustomer.org_id == org_id
    ).first()

    subtotal = 0.0
    for item in req.items:
        db_store_inv = db.query(models.DeviceInventory).filter(
            models.DeviceInventory.imei == item.imei,
            models.DeviceInventory.location_id == current_user.role,
            models.DeviceInventory.org_id == org_id,
            models.DeviceInventory.device_status == models.DeviceStatus.Sellable
        ).with_for_update().first()
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

    # CVE-007: Enforce minimum 10% deposit for layaway reservations
    if total_payments < total - 0.01:
        min_deposit = total * 0.10
        if total_payments < min_deposit:
            raise HTTPException(status_code=400, detail=f"Minimum 10% deposit required for layaway (${min_deposit:.2f}). Current payments: ${total_payments:.2f}")
    
    last_invoice = db.query(models.Invoice).filter(models.Invoice.org_id == org_id).order_by(models.Invoice.id.desc()).first()
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
        org_id=org_id
    )
    db_invoice.org_id = org_id
    db.add(db_invoice)
    db.flush()
    
    from datetime import timedelta
    warranty_expiry = datetime.utcnow() + timedelta(days=15)
    
    for item in req.items:
        db_store_inv = db.query(models.DeviceInventory).filter(
            models.DeviceInventory.imei == item.imei,
            models.DeviceInventory.org_id == org_id
        ).with_for_update().first()
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
            org_id=org_id
        )
        db_payment.org_id = org_id
        db.add(db_payment)
        
    db.commit()
    db.refresh(db_invoice)
    org_settings = db.query(models.OrganizationSettings).filter(
        models.OrganizationSettings.org_id == org_id
    ).first()
    db_invoice.invoice_terms = org_settings.invoice_terms if org_settings else None
    return db_invoice

@router.post("/invoice", response_model=schemas.InvoiceOut)
def create_invoice(invoice: schemas.InvoiceCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role(["store_a", "store_b", "store_c"]))):
    org_id = getattr(current_user, 'current_org_id', None)
    customer_id = invoice.customer_id
    if not customer_id and invoice.customer:
        db_customer = models.UnifiedCustomer(org_id=org_id, **invoice.customer.model_dump())
        db_customer.crm_id = f"CRM-{uuid.uuid4().hex[:8].upper()}"
        db.add(db_customer)
        db.commit()
        db.refresh(db_customer)
        customer_id = db_customer.crm_id
        
    if not customer_id:
        raise HTTPException(status_code=400, detail="Customer info required")
        
    customer_db_obj = db.query(models.UnifiedCustomer).filter(
        models.UnifiedCustomer.crm_id == customer_id,
        models.UnifiedCustomer.org_id == org_id
    ).first()
    
    subtotal = 0.0
    for item in invoice.items:
        db_store_inv = db.query(models.DeviceInventory).filter(
            models.DeviceInventory.imei == item.imei,
            models.DeviceInventory.location_id == current_user.role,
            models.DeviceInventory.org_id == org_id,
            models.DeviceInventory.device_status == models.DeviceStatus.Sellable
        ).with_for_update().first()
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
    
    last_invoice = db.query(models.Invoice).filter(models.Invoice.org_id == org_id).order_by(models.Invoice.id.desc()).first()
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
        org_id=org_id
    )
    db_invoice.org_id = org_id
    db.add(db_invoice)
    db.commit()
    db.refresh(db_invoice)
    
    from datetime import timedelta
    warranty_expiry = db_invoice.created_at + timedelta(days=15)
    
    for item in invoice.items:
        db_store_inv = db.query(models.DeviceInventory).filter(
            models.DeviceInventory.imei == item.imei,
            models.DeviceInventory.org_id == org_id
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
    org_settings = db.query(models.OrganizationSettings).filter(
        models.OrganizationSettings.org_id == org_id
    ).first()
    db_invoice.invoice_terms = org_settings.invoice_terms if org_settings else None
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
    org_id = getattr(current_user, 'current_org_id', None)
    try:
        invoice_data = wms_core.process_bulk_checkout(
            db, 
            req.imei_list, 
            req.crm_id, 
            current_user.email,
            org_id=org_id,
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
    org_id = getattr(current_user, 'current_org_id', None)
    invoice = db.query(models.Invoice).filter(
        models.Invoice.invoice_number == invoice_id,
        models.Invoice.is_estimate == 1,
        models.Invoice.org_id == org_id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Estimate not found")

    # Check if devices are still sellable
    items = db.query(models.InvoiceItem).filter(models.InvoiceItem.invoice_id == invoice.id).all()
    imeis = [item.imei for item in items]
    devices = db.query(models.DeviceInventory).filter(
        models.DeviceInventory.imei.in_(imeis),
        models.DeviceInventory.org_id == org_id
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
        models.UnifiedCustomer.org_id == org_id
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
    org_id = getattr(current_user, 'current_org_id', None)
    invoice = db.query(models.Invoice).filter(
        models.Invoice.invoice_number == invoice_id,
        models.Invoice.org_id == org_id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    db_payment = models.PaymentTransaction(
        org_id=org_id,
        invoice_id=invoice.id,
        amount=payment.amount,
        payment_method=payment.payment_method,
        reference_id=payment.reference_id
    )
    db_payment.org_id = org_id
    db.add(db_payment)
    db.commit()
    db.refresh(invoice)
    
    # Layaway State Machine
    total_paid = sum(p.amount for p in invoice.payments)
    remaining_balance = invoice.total - total_paid

    if payment.payment_method != models.PaymentMethodEnum.On_Terms:
        if payment.amount > remaining_balance + 0.01:
            raise HTTPException(status_code=400, detail=f"Payment (${payment.amount:.2f}) exceeds remaining balance (${remaining_balance:.2f})")

    if total_paid < invoice.total:
        invoice.payment_status = models.PaymentStatus.Partial_Layaway
        invoice.status = models.InvoiceStatus.Partially_Paid
        for item in invoice.items:
            device = db.query(models.DeviceInventory).filter(
                models.DeviceInventory.imei == item.imei,
                models.DeviceInventory.org_id == org_id
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
                models.DeviceInventory.org_id == org_id
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
            models.UnifiedCustomer.org_id == org_id
        ).first()
        if customer:
            customer.current_balance += payment.amount
    else:
        customer = db.query(models.UnifiedCustomer).filter(
            models.UnifiedCustomer.crm_id == invoice.customer_id,
            models.UnifiedCustomer.org_id == org_id
        ).first()
        if customer:
            customer.current_balance -= payment.amount
            if customer.current_balance < 0:
                raise HTTPException(status_code=400, detail=f"Payment exceeds customer balance. Overpayment of ${abs(customer.current_balance):.2f}")
        
    db.commit()
    return {"status": "success", "total_paid": total_paid, "payment_status": invoice.payment_status}

@router.put("/invoices/{invoice_id}")
def update_invoice(
    invoice_id: str,
    req: schemas.InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))
):
    org_id = getattr(current_user, 'current_org_id', None)
    invoice = db.query(models.Invoice).filter(
        models.Invoice.invoice_number == invoice_id,
        models.Invoice.org_id == org_id
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
    org_id = getattr(current_user, 'current_org_id', None)
    results = []
    total_credit_applied = 0.0
    
    for imei in req.imei_list:
        # Find original sale
        item = db.query(models.InvoiceItem).filter(models.InvoiceItem.imei == imei).join(models.Invoice).filter(
            models.Invoice.org_id == org_id
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
            models.DeviceInventory.org_id == org_id
        ).first()
        prev_status = device.device_status.value
        device.device_status = models.DeviceStatus.In_QC
        device.location_id = "Warehouse_Alpha"
        device.sold_to_crm_id = None

        return_value = item.unit_price
        customer = db.query(models.UnifiedCustomer).filter(
            models.UnifiedCustomer.crm_id == invoice.customer_id,
            models.UnifiedCustomer.org_id == org_id
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
                if customer and customer.current_balance < return_value:
                    raise HTTPException(status_code=400, detail=f"RMA credit (${return_value:.2f}) exceeds customer balance (${customer.current_balance:.2f})")
                customer.current_balance -= return_value
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
        org_id = getattr(current_user, 'current_org_id', None)
        stmt = db.query(models.Invoice)
        if org_id:
            stmt = stmt.filter(models.Invoice.org_id == org_id)

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
                models.DeviceInventory.org_id == org_id
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
    org_id = getattr(current_user, 'current_org_id', None)
    customer = db.query(models.UnifiedCustomer).filter(
        models.UnifiedCustomer.crm_id == crm_id,
        models.UnifiedCustomer.org_id == org_id
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    query = db.query(models.Invoice).filter(
        models.Invoice.customer_id == crm_id,
        models.Invoice.is_estimate == 0,
        models.Invoice.org_id == org_id
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


# ── Returns, Corrections & Void (Module 5) ───────────────────────────────────

@router.post("/invoices/{invoice_id}/void")
def void_invoice(invoice_id: int, reason: str = "", db: Session = Depends(get_db),
                 current_user: models.User = Depends(auth.require_role(["admin"]))):
    org_id = getattr(current_user, 'current_org_id', None)
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id, models.Invoice.org_id == org_id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.status == models.InvoiceStatus.Voided:
        raise HTTPException(status_code=400, detail="Invoice already voided")

    invoice.status = models.InvoiceStatus.Voided
    invoice.payment_status = models.PaymentStatus.Voided

    # Restore devices to Sellable
    items = db.query(models.InvoiceItem).filter(
        models.InvoiceItem.invoice_id == invoice_id
    ).all()
    for item in items:
        device = db.query(models.DeviceInventory).filter(
            models.DeviceInventory.imei == item.imei,
            models.DeviceInventory.org_id == org_id
        ).first()
        if device and device.device_status == models.DeviceStatus.Sold:
            old_status = device.device_status
            device.device_status = models.DeviceStatus.Sellable
            db.add(models.DeviceHistoryLog(
                imei=device.imei, org_id=org_id,
                action_type="Invoice Voided", employee_id=current_user.email,
                previous_status=old_status, new_status=models.DeviceStatus.Sellable,
                notes=f"Invoice #{invoice_id} voided. Reason: {reason}"
            ))

    db.commit()
    return {"status": "voided", "invoice_id": invoice_id, "restored_devices": len(items)}


@router.put("/invoices/{invoice_id}/correct")
def correct_invoice(invoice_id: int, notes: str = "", db: Session = Depends(get_db),
                    current_user: models.User = Depends(auth.require_role(["admin"]))):
    org_id = getattr(current_user, 'current_org_id', None)
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id, models.Invoice.org_id == org_id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Re-derive model numbers from IMEIs
    items = db.query(models.InvoiceItem).filter(
        models.InvoiceItem.invoice_id == invoice_id
    ).all()
    corrections = []
    for item in items:
        device = db.query(models.DeviceInventory).filter(
            models.DeviceInventory.imei == item.imei,
            models.DeviceInventory.org_id == org_id
        ).first()
        if device and device.model_number and item.model_number != device.model_number:
            old_model = item.model_number
            item.model_number = device.model_number
            corrections.append({"imei": item.imei, "old": old_model, "new": device.model_number})

    if notes:
        invoice.notes = (invoice.notes or '') + f" [Corrected: {notes}]"

    db.add(models.DeviceHistoryLog(
        imei="SYSTEM", org_id=org_id,
        action_type="Invoice Corrected", employee_id=current_user.email,
        previous_status="", new_status="",
        notes=f"Invoice #{invoice_id} corrected. {len(corrections)} model(s) fixed. {notes}"
    ))

    db.commit()
    return {"status": "corrected", "invoice_id": invoice_id, "corrections": corrections}


@router.post("/invoices/{invoice_id}/refund")
def refund_invoice(invoice_id: int, reason: str = "", db: Session = Depends(get_db),
                   current_user: models.User = Depends(auth.require_role(["admin"]))):
    org_id = getattr(current_user, 'current_org_id', None)
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id, models.Invoice.org_id == org_id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Reverse sale on all devices
    items = db.query(models.InvoiceItem).filter(
        models.InvoiceItem.invoice_id == invoice_id
    ).all()
    for item in items:
        device = db.query(models.DeviceInventory).filter(
            models.DeviceInventory.imei == item.imei,
            models.DeviceInventory.org_id == org_id
        ).first()
        if device and device.device_status == models.DeviceStatus.Sold:
            old_status = device.device_status
            device.device_status = models.DeviceStatus.Sellable
            device.cost_basis = max(0, device.cost_basis - (item.unit_price * 0.1))
            db.add(models.DeviceHistoryLog(
                imei=device.imei, org_id=org_id,
                action_type="Refund", employee_id=current_user.email,
                previous_status=old_status, new_status=models.DeviceStatus.Sellable,
                notes=f"Invoice #{invoice_id} refunded. Reason: {reason}"
            ))

    invoice.status = models.InvoiceStatus.Refunded
    invoice.payment_status = models.PaymentStatus.Refunded

    db.commit()
    return {"status": "refunded", "invoice_id": invoice_id, "devices_restored": len(items)}


# ── Employee Error Dashboard ─────────────────────────────────────────────────

@router.get("/employee-errors")
def employee_error_report(db: Session = Depends(get_db),
                          current_user: models.User = Depends(auth.require_role(["admin"]))):
    org_id = getattr(current_user, 'current_org_id', None)
    logs = db.query(models.DeviceHistoryLog).filter(
        models.DeviceHistoryLog.org_id == org_id,
        models.DeviceHistoryLog.action_type.in_(["Invoice Voided", "Invoice Corrected", "Refund"])
    ).order_by(models.DeviceHistoryLog.timestamp.desc()).limit(200).all()

    by_employee = {}
    for log in logs:
        emp = log.employee_id
        if emp not in by_employee:
            by_employee[emp] = {"employee": emp, "voids": 0, "corrections": 0, "refunds": 0, "recent": []}
        if log.action_type == "Invoice Voided":
            by_employee[emp]["voids"] += 1
        elif log.action_type == "Invoice Corrected":
            by_employee[emp]["corrections"] += 1
        elif log.action_type == "Refund":
            by_employee[emp]["refunds"] += 1
        if len(by_employee[emp]["recent"]) < 5:
            by_employee[emp]["recent"].append({"action": log.action_type, "notes": log.notes, "date": str(log.timestamp)})

    return list(by_employee.values())


# ── Phase 2: Structured Invoice Form ──────────────────────────────────────

@router.post("/invoices", response_model=schemas.InvoiceOut)
def create_invoice_from_form(
    req: schemas.InvoiceFormCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))
):
    org_id = getattr(current_user, 'current_org_id', None)
    customer_id = req.customer_id
    if not customer_id and req.customer:
        db_customer = models.UnifiedCustomer(org_id=org_id, **req.customer.model_dump())
        db_customer.crm_id = f"CRM-{uuid.uuid4().hex[:8].upper()}"
        db.add(db_customer)
        db.flush()
        db.refresh(db_customer)
        customer_id = db_customer.crm_id

    if not customer_id:
        raise HTTPException(status_code=400, detail="Customer info required")

    customer_db_obj = db.query(models.UnifiedCustomer).filter(
        models.UnifiedCustomer.crm_id == customer_id,
        models.UnifiedCustomer.org_id == org_id
    ).first()

    subtotal = 0.0
    for item in req.items:
        if item.imei:
            db_store_inv = db.query(models.DeviceInventory).filter(
                models.DeviceInventory.imei == item.imei,
                models.DeviceInventory.location_id == current_user.role,
                models.DeviceInventory.org_id == org_id,
                models.DeviceInventory.device_status == models.DeviceStatus.Sellable
            ).with_for_update().first()
            if not db_store_inv:
                raise HTTPException(status_code=400, detail=f"IMEI {item.imei} not sellable at your store")
            db_store_inv.sold_to_crm_id = customer_id

        applied_rate = item.rate
        if customer_db_obj and customer_db_obj.pricing_tier > 0:
            applied_rate = applied_rate * (1.0 - customer_db_obj.pricing_tier)

        subtotal += applied_rate * item.qty

    final_tax_percent = req.tax_percent
    if customer_db_obj and customer_db_obj.tax_exempt_id:
        final_tax_percent = 0.0

    discount_amount = req.discount_amount or 0.0
    if req.discount_percent and req.discount_percent > 0:
        discount_amount = subtotal * (req.discount_percent / 100.0)

    discounted_subtotal = subtotal - discount_amount
    tax_amount = discounted_subtotal * (final_tax_percent / 100.0)
    total = discounted_subtotal + tax_amount

    total_payments = sum(p.amount for p in req.payments)
    if total_payments > total + 0.01:
        raise HTTPException(status_code=400, detail=f"Payment sum ({total_payments}) exceeds invoice total ({total})")

    if total_payments < total - 0.01:
        min_deposit = total * 0.10
        if total_payments < min_deposit:
            raise HTTPException(status_code=400, detail=f"Minimum 10% deposit required for layaway (${min_deposit:.2f})")

    last_invoice = db.query(models.Invoice).filter(models.Invoice.org_id == org_id).order_by(models.Invoice.id.desc()).first()
    next_id = last_invoice.id + 1 if last_invoice else 1
    invoice_number = f"INV-{next_id:04d}"

    is_paid_in_full = total_payments >= total - 0.01

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
        status=models.InvoiceStatus.Paid if is_paid_in_full else models.InvoiceStatus.Partially_Paid,
        payment_status=models.PaymentStatus.Paid_in_Full if is_paid_in_full else models.PaymentStatus.Partial_Layaway,
        message_on_invoice=req.message_on_invoice,
        statement_memo=req.statement_memo,
        discount_percent=req.discount_percent or 0.0,
        discount_amount=discount_amount,
        due_date=req.due_date,
        org_id=org_id
    )
    db.add(db_invoice)
    db.flush()

    warranty_expiry = datetime.utcnow() + timedelta(days=15)

    for item in req.items:
        if item.imei:
            db_store_inv = db.query(models.DeviceInventory).filter(
                models.DeviceInventory.imei == item.imei,
                models.DeviceInventory.org_id == org_id
            ).with_for_update().first()
            if is_paid_in_full:
                db_store_inv.device_status = models.DeviceStatus.Sold
            else:
                db_store_inv.device_status = models.DeviceStatus.Reserved_Layaway
            db_store_inv.warranty_expiry_date = warranty_expiry

        db_item = models.InvoiceItem(
            invoice_id=db_invoice.id,
            imei=item.imei or "",
            model_number=item.model_number,
            unit_price=item.rate
        )
        db.add(db_item)

    for p in req.payments:
        db_payment = models.PaymentTransaction(
            invoice_id=db_invoice.id,
            amount=p.amount,
            payment_method=p.payment_method,
            reference_id=p.reference_id,
            org_id=org_id
        )
        db.add(db_payment)

    db.commit()
    db.refresh(db_invoice)
    org_settings = db.query(models.OrganizationSettings).filter(
        models.OrganizationSettings.org_id == org_id
    ).first()
    db_invoice.invoice_terms = org_settings.invoice_terms if org_settings else None
    return db_invoice


@router.patch("/invoices/{invoice_id}")
def update_invoice_header(
    invoice_id: str,
    req: schemas.InvoiceUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))
):
    org_id = getattr(current_user, 'current_org_id', None)
    invoice = db.query(models.Invoice).filter(
        models.Invoice.invoice_number == invoice_id,
        models.Invoice.org_id == org_id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.status not in [models.InvoiceStatus.Draft, models.InvoiceStatus.Unpaid, models.InvoiceStatus.Partially_Paid]:
        raise HTTPException(status_code=400, detail=f"Cannot edit invoice with status {invoice.status.value}")

    update_data = req.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(invoice, key, value)

    db.commit()
    return {"status": "updated", "invoice_number": invoice.invoice_number}


@router.post("/invoices/batch")
def batch_create_invoices(
    req: schemas.BatchInvoiceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))
):
    if len(req.invoices) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 invoices per batch")

    org_id = getattr(current_user, 'current_org_id', None)
    results = []
    errors = []

    for i, inv in enumerate(req.invoices):
        try:
            created = create_invoice_from_form(inv, db, current_user)
            results.append(created.invoice_number)
        except HTTPException as e:
            errors.append({"index": i, "detail": e.detail})
        except Exception as e:
            errors.append({"index": i, "detail": str(e)})

    return {"created": results, "errors": errors}


@router.post("/invoices/batch-send")
def batch_send_invoices(
    req: schemas.BatchActionRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))
):
    org_id = getattr(current_user, 'current_org_id', None)
    results = []
    for inv_id in req.invoice_ids:
        invoice = db.query(models.Invoice).filter(
            models.Invoice.id == inv_id, models.Invoice.org_id == org_id
        ).first()
        if not invoice:
            results.append({"invoice_id": inv_id, "status": "error", "message": "Not found"})
            continue
        invoice.emailed_at = datetime.utcnow()
        invoice.sent_at = datetime.utcnow()
        results.append({"invoice_id": inv_id, "status": "sent", "invoice_number": invoice.invoice_number})

    db.commit()
    return {"results": results}


@router.post("/invoices/batch-print")
def batch_print_invoices(
    req: schemas.BatchActionRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))
):
    org_id = getattr(current_user, 'current_org_id', None)
    try:
        from PyPDF2 import PdfMerger
    except ImportError:
        from PyPDF2 import PdfMerger

    merger = PdfMerger()
    for inv_id in req.invoice_ids:
        invoice = db.query(models.Invoice).filter(
            models.Invoice.id == inv_id, models.Invoice.org_id == org_id
        ).first()
        if not invoice:
            continue
        try:
            customer_info = {}
            if invoice.customer:
                customer_info = {
                    "crm_id": invoice.customer_id,
                    "name": invoice.customer.company_name or f"{invoice.customer.first_name or ''} {invoice.customer.last_name or ''}".strip()
                }
            invoice_data = {
                "invoice_id": invoice.invoice_number,
                "date": invoice.created_at.isoformat(),
                "customer": customer_info,
                "lines": [{"imei": i.imei, "model": i.model_number, "final_price": i.unit_price} for i in invoice.items],
                "summary": {
                    "subtotal": invoice.subtotal,
                    "tax_percent": invoice.tax_percent,
                    "total_due": invoice.total
                }
            }
            pdf_bytes = generate_wholesale_invoice_pdf(invoice_data)
            from io import BytesIO
            merger.append(BytesIO(pdf_bytes))
        except Exception:
            pass

    buf = io.BytesIO()
    merger.write(buf)
    merger.close()
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": "attachment; filename=batch_invoices.pdf"})


# ── Estimate Workflow ─────────────────────────────────────────────────────

@router.post("/estimates/{invoice_id}/mark-sent")
def mark_estimate_sent(
    invoice_id: str,
    req: Optional[schemas.EstimateStatusRequest] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))
):
    org_id = getattr(current_user, 'current_org_id', None)
    invoice = db.query(models.Invoice).filter(
        models.Invoice.invoice_number == invoice_id,
        models.Invoice.is_estimate == 1,
        models.Invoice.org_id == org_id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Estimate not found")

    invoice.sent_at = datetime.utcnow()
    invoice.emailed_at = datetime.utcnow()
    db.commit()
    return {"status": "sent", "invoice_number": invoice.invoice_number}


@router.post("/estimates/{invoice_id}/accept")
def accept_estimate(
    invoice_id: str,
    db: Session = Depends(get_db)
):
    """Customer-facing: accept an estimate via shared link. No auth required."""
    invoice = db.query(models.Invoice).filter(
        models.Invoice.invoice_number == invoice_id,
        models.Invoice.is_estimate == 1
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Estimate not found")
    if invoice.status == models.InvoiceStatus.Voided:
        raise HTTPException(status_code=400, detail="Estimate is voided")

    invoice.status = models.InvoiceStatus.Unpaid
    db.commit()
    return {"status": "accepted", "invoice_number": invoice.invoice_number}


@router.post("/estimates/{invoice_id}/decline")
def decline_estimate(
    invoice_id: str,
    db: Session = Depends(get_db)
):
    """Customer-facing: decline an estimate via shared link. No auth required."""
    invoice = db.query(models.Invoice).filter(
        models.Invoice.invoice_number == invoice_id,
        models.Invoice.is_estimate == 1
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Estimate not found")

    invoice.status = models.InvoiceStatus.Voided
    invoice.payment_status = models.PaymentStatus.Voided
    db.commit()
    return {"status": "declined", "invoice_number": invoice.invoice_number}


@router.post("/estimates/{estimate_id}/progress-invoice")
def create_progress_invoice(
    estimate_id: str,
    req: schemas.ProgressInvoiceRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))
):
    org_id = getattr(current_user, 'current_org_id', None)
    estimate = db.query(models.Invoice).filter(
        models.Invoice.invoice_number == estimate_id,
        models.Invoice.is_estimate == 1,
        models.Invoice.org_id == org_id
    ).first()
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    if estimate.status == models.InvoiceStatus.Voided:
        raise HTTPException(status_code=400, detail="Estimate is voided")

    existing_progress = db.query(models.Invoice).filter(
        models.Invoice.org_id == org_id
    ).filter(
        models.Invoice.invoice_number.like(f"%PROG-{estimate_id}%")
    ).all()
    already_invoiced = sum(inv.total for inv in existing_progress if inv.status != models.InvoiceStatus.Voided)

    progress_subtotal = sum(item.rate * item.qty for item in req.items)
    new_total = already_invoiced + progress_subtotal

    if new_total > estimate.total + 0.01:
        raise HTTPException(status_code=400,
                            detail=f"Progress invoice (${progress_subtotal:.2f}) would exceed estimate total (${estimate.total:.2f}). Already invoiced: ${already_invoiced:.2f}")

    last_invoice = db.query(models.Invoice).filter(models.Invoice.org_id == org_id).order_by(models.Invoice.id.desc()).first()
    next_id = last_invoice.id + 1 if last_invoice else 1
    prog_number = f"PROG-{estimate_id}-{next_id:04d}"

    is_final = new_total >= estimate.total - 0.01

    db_invoice = models.Invoice(
        invoice_number=prog_number,
        customer_id=estimate.customer_id,
        store_id=current_user.store_id or current_user.role,
        subtotal=progress_subtotal,
        tax_percent=estimate.tax_percent,
        tax_amount=progress_subtotal * (estimate.tax_percent / 100.0),
        total=progress_subtotal + progress_subtotal * (estimate.tax_percent / 100.0),
        status=models.InvoiceStatus.Paid if is_final else models.InvoiceStatus.Unpaid,
        payment_status=models.PaymentStatus.Paid_in_Full if is_final else models.PaymentStatus.Unpaid,
        org_id=org_id
    )
    db.add(db_invoice)
    db.flush()

    for item in req.items:
        db_item = models.InvoiceItem(
            invoice_id=db_invoice.id,
            imei=item.imei or "",
            model_number=item.model_number,
            unit_price=item.rate
        )
        db.add(db_item)

    for p in req.payments:
        db_payment = models.PaymentTransaction(
            invoice_id=db_invoice.id,
            amount=p.amount,
            payment_method=p.payment_method,
            reference_id=p.reference_id,
            org_id=org_id
        )
        db.add(db_payment)

    if is_final:
        estimate.status = models.InvoiceStatus.Paid

    db.commit()
    db.refresh(db_invoice)
    return {
        "progress_invoice": db_invoice.invoice_number,
        "amount_invoiced": progress_subtotal,
        "total_invoiced": new_total,
        "estimate_total": estimate.total,
        "remaining": estimate.total - new_total,
        "is_final": is_final
    }


# ── Recurring Invoices ────────────────────────────────────────────────────

@router.post("/invoices/recurring", response_model=schemas.RecurringInvoiceTemplateOut)
def create_recurring_template(
    req: schemas.RecurringInvoiceTemplateCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))
):
    org_id = getattr(current_user, 'current_org_id', None)
    template = models.RecurringInvoiceTemplate(
        org_id=org_id,
        customer_id=req.customer_id,
        frequency=req.frequency,
        interval_value=req.interval_value,
        next_run_date=req.next_run_date,
        end_date=req.end_date,
        auto_send=1 if req.auto_send else 0,
        line_items=req.line_items,
        terms=req.terms,
        message_on_invoice=req.message_on_invoice
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.get("/invoices/recurring", response_model=List[schemas.RecurringInvoiceTemplateOut])
def list_recurring_templates(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))
):
    org_id = getattr(current_user, 'current_org_id', None)
    return db.query(models.RecurringInvoiceTemplate).filter(
        models.RecurringInvoiceTemplate.org_id == org_id
    ).order_by(models.RecurringInvoiceTemplate.created_at.desc()).all()


@router.put("/invoices/recurring/{template_id}", response_model=schemas.RecurringInvoiceTemplateOut)
def update_recurring_template(
    template_id: int,
    req: schemas.RecurringInvoiceTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))
):
    org_id = getattr(current_user, 'current_org_id', None)
    template = db.query(models.RecurringInvoiceTemplate).filter(
        models.RecurringInvoiceTemplate.id == template_id,
        models.RecurringInvoiceTemplate.org_id == org_id
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    update_data = req.model_dump(exclude_unset=True)
    if 'auto_send' in update_data:
        update_data['auto_send'] = 1 if update_data['auto_send'] else 0
    for key, value in update_data.items():
        setattr(template, key, value)

    db.commit()
    db.refresh(template)
    return template


@router.delete("/invoices/recurring/{template_id}")
def delete_recurring_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin"]))
):
    org_id = getattr(current_user, 'current_org_id', None)
    template = db.query(models.RecurringInvoiceTemplate).filter(
        models.RecurringInvoiceTemplate.id == template_id,
        models.RecurringInvoiceTemplate.org_id == org_id
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    db.delete(template)
    db.commit()
    return {"status": "deleted"}


@router.post("/invoices/recurring/{template_id}/pause")
def pause_recurring_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))
):
    org_id = getattr(current_user, 'current_org_id', None)
    template = db.query(models.RecurringInvoiceTemplate).filter(
        models.RecurringInvoiceTemplate.id == template_id,
        models.RecurringInvoiceTemplate.org_id == org_id
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    template.status = models.RecurringTemplateStatus.Paused
    db.commit()
    return {"status": "paused"}


@router.post("/invoices/recurring/{template_id}/resume")
def resume_recurring_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))
):
    org_id = getattr(current_user, 'current_org_id', None)
    template = db.query(models.RecurringInvoiceTemplate).filter(
        models.RecurringInvoiceTemplate.id == template_id,
        models.RecurringInvoiceTemplate.org_id == org_id
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    template.status = models.RecurringTemplateStatus.Active
    db.commit()
    return {"status": "active"}


@router.get("/invoices/recurring/{template_id}/log", response_model=List[schemas.RecurringInvoiceLogOut])
def get_recurring_template_log(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))
):
    org_id = getattr(current_user, 'current_org_id', None)
    return db.query(models.RecurringInvoiceLog).filter(
        models.RecurringInvoiceLog.template_id == template_id,
        models.RecurringInvoiceLog.org_id == org_id
    ).order_by(models.RecurringInvoiceLog.executed_at.desc()).all()


def _add_months(dt: datetime, months: int) -> datetime:
    """Add N months to a datetime, handling month-end clamping."""
    import calendar
    total_months = dt.month + months - 1
    year = dt.year + total_months // 12
    month = total_months % 12 + 1
    day = min(dt.day, calendar.monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)


# ── Scheduler Cron Endpoint ───────────────────────────────────────────────

@router.post("/scheduler/run")
def scheduler_run(db: Session = Depends(get_db)):
    """Called daily by Vercel Cron. Creates invoices from active recurring templates."""
    now = datetime.utcnow()
    templates = db.query(models.RecurringInvoiceTemplate).filter(
        models.RecurringInvoiceTemplate.status == models.RecurringTemplateStatus.Active,
        models.RecurringInvoiceTemplate.next_run_date <= now
    ).all()

    templates_checked = len(templates)
    invoices_created = 0
    errors = []

    for template in templates:
        org_id = template.org_id
        try:
            line_items = json.loads(template.line_items)
        except json.JSONDecodeError:
            errors.append(f"Template {template.id}: invalid line_items JSON")
            continue

        try:
            last_invoice = db.query(models.Invoice).filter(
                models.Invoice.org_id == org_id
            ).order_by(models.Invoice.id.desc()).first()
            next_id = last_invoice.id + 1 if last_invoice else 1
            invoice_number = f"INV-{next_id:04d}"

            subtotal = sum(li.get("rate", 0) * li.get("qty", 1) for li in line_items)
            org_settings = db.query(models.OrganizationSettings).filter(
                models.OrganizationSettings.org_id == org_id
            ).first()
            tax_rate = org_settings.default_tax_rate if org_settings else 8.5
            tax_amount = subtotal * (tax_rate / 100.0)
            total = subtotal + tax_amount

            db_invoice = models.Invoice(
                invoice_number=invoice_number,
                customer_id=template.customer_id,
                store_id="admin",
                subtotal=subtotal,
                tax_percent=tax_rate,
                tax_amount=tax_amount,
                total=total,
                status=models.InvoiceStatus.Unpaid,
                payment_status=models.PaymentStatus.Unpaid,
                message_on_invoice=template.message_on_invoice,
                due_date=datetime.utcnow() + timedelta(days=30),
                org_id=org_id
            )
            db.add(db_invoice)
            db.flush()

            for li in line_items:
                db_item = models.InvoiceItem(
                    invoice_id=db_invoice.id,
                    imei=li.get("imei", ""),
                    model_number=li.get("model_number", ""),
                    unit_price=li.get("rate", 0)
                )
                db.add(db_item)

            log_entry = models.RecurringInvoiceLog(
                org_id=org_id,
                template_id=template.id,
                resulting_invoice_id=db_invoice.id,
                status="Success"
            )
            db.add(log_entry)

            if template.frequency == models.RecurringFrequency.Weekly:
                template.next_run_date = template.next_run_date + timedelta(days=7 * template.interval_value)
            elif template.frequency == models.RecurringFrequency.Monthly:
                template.next_run_date = _add_months(template.next_run_date, template.interval_value)
            elif template.frequency == models.RecurringFrequency.Quarterly:
                template.next_run_date = _add_months(template.next_run_date, 3 * template.interval_value)
            elif template.frequency == models.RecurringFrequency.Yearly:
                template.next_run_date = _add_months(template.next_run_date, 12 * template.interval_value)

            if template.end_date and template.next_run_date > template.end_date:
                template.status = models.RecurringTemplateStatus.Completed

            invoices_created += 1

        except Exception as e:
            log_entry = models.RecurringInvoiceLog(
                org_id=template.org_id,
                template_id=template.id,
                status="Error",
                error_message=str(e)
            )
            db.add(log_entry)
            errors.append(f"Template {template.id}: {str(e)}")

    db.commit()
    return schemas.SchedulerRunResult(
        templates_checked=templates_checked,
        invoices_created=invoices_created,
        errors=errors
    )
