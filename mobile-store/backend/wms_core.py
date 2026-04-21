import uuid
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from models import DeviceInventory, UnifiedCustomer, TransferOrder, DeviceStatus, TransferType, DeviceHistoryLog, CustomerType, Invoice, InvoiceItem, InvoiceStatus, PaymentRecord

def _log_history(db: Session, imei: str, action_type: str, employee_id: str, new_status: str, previous_status: str = None, notes: str = None):
    log = DeviceHistoryLog(
        imei=imei,
        action_type=action_type,
        employee_id=employee_id,
        previous_status=previous_status,
        new_status=new_status,
        notes=notes
    )
    db.add(log)

def process_bulk_checkout(db: Session, imei_list: List[str], crm_id: str, employee_id: str, fulfillment_method: str = "Walk-in", shipping_address: str = None, payment_method: str = "Cash", is_estimate: bool = False, upfront_payment: float = 0.0) -> Dict[str, Any]:
    try:
        customer = db.query(UnifiedCustomer).filter(UnifiedCustomer.crm_id == crm_id).first()
        if not customer:
            raise ValueError(f"Customer with ID {crm_id} not found.")

        devices = db.query(DeviceInventory).filter(DeviceInventory.imei.in_(imei_list)).all()
        if len(devices) != len(imei_list):
            found_imeis = {d.imei for d in devices}
            missing = set(imei_list) - found_imeis
            raise ValueError(f"Devices not found in inventory: {missing}")

        invoice_lines = []
        subtotal = 0.0

        for device in devices:
            if device.device_status != DeviceStatus.Sellable:
                raise ValueError(f"Device {device.imei} cannot be sold because its status is {device.device_status.value}.")

            base_price = device.cost_basis * 1.2 
            discount_amount = base_price * customer.pricing_tier
            final_price = base_price - discount_amount
            
            subtotal += final_price
            
            invoice_lines.append({
                "imei": device.imei,
                "model": device.model_number,
                "base_price": round(base_price, 2),
                "discount_applied": round(discount_amount, 2),
                "final_price": round(final_price, 2)
            })

        tax_percent = 0.0 if customer.tax_exempt_id else 8.5
        tax_amount = subtotal * (tax_percent / 100)
        total_due = subtotal + tax_amount

        # Credit Ledger Enforcement (only for actual invoices)
        unpaid_balance = total_due - upfront_payment
        if not is_estimate and payment_method == "On Terms":
            if customer.current_balance + unpaid_balance > customer.credit_limit:
                raise ValueError(f"Credit limit exceeded. Current Balance: ${customer.current_balance:.2f}, Unpaid Balance: ${unpaid_balance:.2f}, Limit: ${customer.credit_limit:.2f}. Manager override required.")
            customer.current_balance += unpaid_balance

        # Create Invoice Record
        last_invoice = db.query(Invoice).order_by(Invoice.id.desc()).first()
        next_id = last_invoice.id + 1 if last_invoice else 1
        prefix = "EST" if is_estimate else "INV"
        invoice_number = f"{prefix}-{next_id:04d}"
        
        status = InvoiceStatus.Unpaid
        if is_estimate:
            status = InvoiceStatus.Draft
        elif upfront_payment >= total_due:
            status = InvoiceStatus.Paid
        elif upfront_payment > 0:
            status = InvoiceStatus.Partially_Paid

        due_date = datetime.utcnow() + timedelta(days=15) if not is_estimate else None
        
        db_invoice = Invoice(
            invoice_number=invoice_number,
            customer_id=crm_id,
            store_id="admin", # Wholesale usually admin/central
            subtotal=subtotal,
            tax_percent=tax_percent,
            tax_amount=tax_amount,
            total=total_due,
            fulfillment_method=fulfillment_method,
            shipping_address=shipping_address,
            payment_method=payment_method,
            status=status,
            is_estimate=1 if is_estimate else 0,
            due_date=due_date
        )
        db.add(db_invoice)
        db.flush() # Get ID

        # Create PaymentRecord if upfront payment exists
        if not is_estimate and upfront_payment > 0:
            payment_rec = PaymentRecord(
                invoice_id=db_invoice.id,
                amount_paid=upfront_payment,
                payment_method=payment_method
            )
            db.add(payment_rec)

        # Update devices and create items
        for device in devices:
            if not is_estimate:
                prev_status = device.device_status.value
                device.device_status = DeviceStatus.Sold
                device.sold_to_crm_id = crm_id
                _log_history(db, device.imei, "Wholesale_Bulk_Sold", employee_id, device.device_status.value, prev_status, f"Sold to {crm_id} via {payment_method}")
            else:
                _log_history(db, device.imei, "Estimate_Created", employee_id, device.device_status.value, device.device_status.value, f"Included in Estimate {invoice_number}")

            # Find the line for this device to get the final price
            line = next(l for l in invoice_lines if l["imei"] == device.imei)
            db_item = InvoiceItem(
                invoice_id=db_invoice.id,
                imei=device.imei,
                model_number=device.model_number,
                unit_price=line["final_price"]
            )
            db.add(db_item)

        invoice_payload = {
            "invoice_id": invoice_number,
            "db_id": db_invoice.id,
            "date": datetime.utcnow().isoformat(),
            "due_date": due_date.isoformat() if due_date else None,
            "customer": {
                "crm_id": customer.crm_id,
                "name": customer.company_name or f"{customer.first_name} {customer.last_name}".strip() or customer.name,
                "tax_exempt_id": customer.tax_exempt_id
            },
            "fulfillment": {
                "method": "Picked Up In-Store" if fulfillment_method == "Walk-in" else "Shipped",
                "shipping_address": shipping_address if fulfillment_method != "Walk-in" else None
            },
            "payment_method": payment_method,
            "lines": invoice_lines,
            "summary": {
                "total_items": len(invoice_lines),
                "subtotal": round(subtotal, 2),
                "tax_percent": tax_percent,
                "total_due": round(total_due, 2),
                "upfront_payment": round(upfront_payment, 2),
                "balance_due": round(unpaid_balance, 2)
            },
            "is_estimate": is_estimate
        }
        
        db.commit()
        return invoice_payload
    except Exception as e:
        db.rollback()
        raise e

def create_transfer_order(db: Session, imei_list: List[str], destination_location_id: str, transfer_type: str, employee_id: str) -> str:
    try:
        devices = db.query(DeviceInventory).filter(DeviceInventory.imei.in_(imei_list)).all()
        if len(devices) != len(imei_list):
            found_imeis = {d.imei for d in devices}
            missing = set(imei_list) - found_imeis
            raise ValueError(f"Devices not found in inventory: {missing}")

        transfer_order_id = f"TO-{uuid.uuid4().hex[:8].upper()}"
        try:
            t_type = TransferType(transfer_type)
        except ValueError:
            raise ValueError(f"Invalid transfer type '{transfer_type}'.")

        new_to = TransferOrder(
            id=transfer_order_id,
            transfer_type=t_type,
            destination_location_id=destination_location_id
        )
        db.add(new_to)
        
        for device in devices:
            if device.device_status in [DeviceStatus.Sold, DeviceStatus.In_Transit]:
                raise ValueError(f"Device {device.imei} cannot be transferred. Current status: {device.device_status.value}")
                
            prev_status = device.device_status.value
            device.device_status = DeviceStatus.In_Transit
            device.sub_location_bin = None
            device.assigned_transfer_order_id = transfer_order_id
            
            _log_history(db, device.imei, "Transferred_Out", employee_id, device.device_status.value, prev_status, f"Added to TO {transfer_order_id}")

        db.commit()
        return transfer_order_id
    except Exception as e:
        db.rollback()
        raise e

def receive_transfer_order(db: Session, transfer_order_id: str, employee_id: str) -> List[str]:
    try:
        transfer_order = db.query(TransferOrder).filter(TransferOrder.id == transfer_order_id).first()
        if not transfer_order:
            raise ValueError(f"Transfer Order {transfer_order_id} not found.")
            
        if transfer_order.status == "Received":
            raise ValueError(f"Transfer Order {transfer_order_id} has already been received.")

        devices = db.query(DeviceInventory).filter(DeviceInventory.assigned_transfer_order_id == transfer_order_id).all()
        received_imeis = []
        
        for device in devices:
            prev_status = device.device_status.value
            device.location_id = transfer_order.destination_location_id
            if transfer_order.transfer_type == TransferType.Restock:
                device.device_status = DeviceStatus.Sellable
            elif transfer_order.transfer_type == TransferType.Repair_Routing:
                device.device_status = DeviceStatus.In_Repair
                
            device.assigned_transfer_order_id = None
            device.sub_location_bin = "Receiving_Bay"
            
            _log_history(db, device.imei, "Transfer_Received", employee_id, device.device_status.value, prev_status, f"Received via TO {transfer_order_id}")
            
            received_imeis.append(device.imei)

        transfer_order.status = "Received"
        db.commit()
        return received_imeis
    except Exception as e:
        db.rollback()
        raise e

def update_device_internal_status(db: Session, imei: str, new_bin: str, new_status: str, employee_id: str) -> dict:
    try:
        device = db.query(DeviceInventory).filter(DeviceInventory.imei == imei).first()
        if not device:
            raise ValueError(f"Device with IMEI {imei} not found.")
            
        if device.device_status == DeviceStatus.Sold:
            raise ValueError(f"Cannot route IMEI {imei} internally because it is Sold.")
            
        if device.device_status == DeviceStatus.In_Transit:
            raise ValueError(f"Cannot route IMEI {imei} internally because it is In_Transit.")

        try:
            parsed_status = DeviceStatus(new_status)
        except ValueError:
            raise ValueError(f"Invalid new status '{new_status}'.")

        prev_status = device.device_status.value
        device.sub_location_bin = new_bin
        device.device_status = parsed_status
        
        _log_history(db, device.imei, "Internal_Routing", employee_id, device.device_status.value, prev_status, f"Moved to bin: {new_bin}")
        
        db.commit()
        db.refresh(device)
        
        return {
            "imei": device.imei,
            "location": device.location_id,
            "sub_location_bin": device.sub_location_bin,
            "device_status": device.device_status.value
        }
    except Exception as e:
        db.rollback()
        raise e

def assign_to_repair(db: Session, imei: str, technician_id: str, current_employee_id: str):
    try:
        device = db.query(DeviceInventory).filter(DeviceInventory.imei == imei).first()
        if not device:
            raise ValueError(f"Device with IMEI {imei} not found.")
            
        if device.device_status in [DeviceStatus.Sold, DeviceStatus.In_Transit]:
            raise ValueError(f"Cannot assign IMEI {imei} to repair. Current status: {device.device_status.value}")
            
        prev_status = device.device_status.value
        device.device_status = DeviceStatus.In_Repair
        device.assigned_technician_id = technician_id
        
        _log_history(db, device.imei, "Sent_To_Repair", current_employee_id, device.device_status.value, prev_status, f"Assigned to Technician {technician_id}")
        
        db.commit()
        db.refresh(device)
        return device
    except Exception as e:
        db.rollback()
        raise e

def complete_repair(db: Session, imei: str, current_employee_id: str):
    try:
        device = db.query(DeviceInventory).filter(DeviceInventory.imei == imei).first()
        if not device:
            raise ValueError(f"Device with IMEI {imei} not found.")
            
        if device.device_status != DeviceStatus.In_Repair:
            raise ValueError(f"Cannot complete repair. Device is not In_Repair.")
            
        prev_status = device.device_status.value
        device.device_status = DeviceStatus.Sellable
        device.assigned_technician_id = None
        device.sub_location_bin = "Main_Floor"
        
        _log_history(db, device.imei, "Repair_Completed", current_employee_id, device.device_status.value, prev_status, f"Repair completed by {current_employee_id}, routed to Main_Floor")
        
        db.commit()
        db.refresh(device)
        return device
    except Exception as e:
        db.rollback()
        raise e

def generate_audit_report(db: Session, location_id: str, scanned_imeis_list: List[str]) -> dict:
    try:
        expected_devices = db.query(DeviceInventory).filter(
            DeviceInventory.location_id == location_id,
            DeviceInventory.device_status.notin_([DeviceStatus.Sold, DeviceStatus.In_Transit])
        ).all()
        
        expected_set = {d.imei for d in expected_devices}
        scanned_set = set(scanned_imeis_list)
        
        matched_set = expected_set & scanned_set
        missing_set = expected_set - scanned_set
        unexpected_set = scanned_set - expected_set
        
        missing_payload = []
        for imei in missing_set:
            last_log = db.query(DeviceHistoryLog).filter(DeviceHistoryLog.imei == imei).order_by(DeviceHistoryLog.timestamp.desc()).first()
            if last_log:
                missing_payload.append({
                    "imei": imei,
                    "last_employee": last_log.employee_id,
                    "last_action": last_log.action_type,
                    "last_timestamp": last_log.timestamp
                })
            else:
                missing_payload.append({
                    "imei": imei,
                    "last_employee": "Unknown",
                    "last_action": "Unknown",
                    "last_timestamp": datetime.utcnow()
                })
                
        return {
            "matched": list(matched_set),
            "missing": missing_payload,
            "unexpected": list(unexpected_set)
        }
    except Exception as e:
        db.rollback()
        raise e

def finalize_audit(db: Session, location_id: str, current_employee_id: str, report: dict):
    try:
        audit_id = f"AUD-{uuid.uuid4().hex[:8].upper()}"
        
        matched_list = report.get("matched", [])
        missing_list = report.get("missing", [])
        unexpected_list = report.get("unexpected", [])
        
        import models
        new_audit = models.InventoryAudit(
            audit_id=audit_id,
            location_id=location_id,
            conducted_by_employee_id=current_employee_id,
            total_expected=len(matched_list) + len(missing_list),
            total_scanned=len(matched_list) + len(unexpected_list),
            total_missing=len(missing_list),
            total_unexpected=len(unexpected_list),
            status="Finalized"
        )
        db.add(new_audit)
        
        audit_items = []
        for imei in matched_list:
            audit_items.append(models.InventoryAuditItem(audit_id=audit_id, imei=imei, variance_status="Matched"))
        for item in missing_list:
            audit_items.append(models.InventoryAuditItem(audit_id=audit_id, imei=item.get("imei"), variance_status="Missing"))
        for imei in unexpected_list:
            audit_items.append(models.InventoryAuditItem(audit_id=audit_id, imei=imei, variance_status="Unexpected"))
            
        db.bulk_save_objects(audit_items)
        db.commit()
        return {"audit_id": audit_id, "status": "Finalized"}
    except Exception as e:
        db.rollback()
        raise e
