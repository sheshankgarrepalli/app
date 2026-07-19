from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from datetime import datetime, timedelta
from collections import defaultdict
import models, auth
from database import get_db
import io, csv
from typing import Optional

router = APIRouter(prefix="/api/reports", tags=["reports"])

DATE_PRESETS = {
    "Today": lambda now: now.replace(hour=0, minute=0, second=0, microsecond=0),
    "This Week": lambda now: (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0),
    "This Month": lambda now: now.replace(day=1, hour=0, minute=0, second=0, microsecond=0),
    "3 Months": lambda now: now - timedelta(days=90),
    "6 Months": lambda now: now - timedelta(days=180),
    "All Time": lambda now: datetime(2000, 1, 1),
}


def _resolve_start(date_range: str) -> datetime:
    now = datetime.utcnow()
    fn = DATE_PRESETS.get(date_range, DATE_PRESETS["Today"])
    return fn(now)


@router.get("/dashboard")
def get_dashboard(
        date_range: str = Query("Today"),
        store_id: Optional[str] = Query(None),
        db: Session = Depends(get_db),
        current_user: models.User = Depends(auth.require_role(["admin"]))
):
    import traceback, sys
    try:
        org_id = getattr(current_user, 'current_org_id', None)
        start = _resolve_start(date_range)
        
        # Build a reusable invoice filter
        def inv_filter(stmt):
            stmt = stmt.filter(models.Invoice.created_at >= start, models.Invoice.org_id == org_id)
            if store_id:
                stmt = stmt.filter(models.Invoice.store_id == store_id)
            return stmt

        # 1. Total sold
        total_sold = inv_filter(db.query(models.InvoiceItem).join(models.Invoice)).count()

        # 2. Sales by location
        loc_q = db.query(
            models.Invoice.store_id, func.count(models.InvoiceItem.id)
        ).join(models.InvoiceItem).filter(
            models.Invoice.created_at >= start, models.Invoice.org_id == org_id
        )
        if store_id:
            loc_q = loc_q.filter(models.Invoice.store_id == store_id)
        loc_rows = loc_q.group_by(models.Invoice.store_id).all()
        sales_by_location = defaultdict(int)
        for sid, cnt in loc_rows:
            sales_by_location[sid] = cnt

        # 3. Warehouse outflow
        transfer_q = db.query(models.TransferOrder).filter(
            models.TransferOrder.created_at >= start, models.TransferOrder.org_id == org_id
        )
        if store_id:
            transfer_q = transfer_q.filter(models.TransferOrder.source_location_id == store_id)
        warehouse_outflow = transfer_q.count()

        # 4. Top models
        top_q = db.query(
            models.InvoiceItem.model_number, func.count(models.InvoiceItem.id)
        ).join(models.Invoice).filter(
            models.Invoice.created_at >= start, models.Invoice.org_id == org_id
        )
        if store_id:
            top_q = top_q.filter(models.Invoice.store_id == store_id)
        top = top_q.group_by(models.InvoiceItem.model_number).order_by(func.count(models.InvoiceItem.id).desc()).limit(5).all()
        top_models = [{"model_number": m[0], "count": m[1]} for m in top]

        # 5. Gross margin
        cost_q = db.query(func.sum(models.DeviceInventory.cost_basis)).filter(
            models.DeviceInventory.device_status == models.DeviceStatus.Sold,
            models.DeviceInventory.org_id == org_id
        )
        revenue_q = db.query(func.sum(models.Invoice.total)).filter(
            models.Invoice.org_id == org_id
        )
        if store_id:
            cost_q = cost_q.filter(models.DeviceInventory.store_id == store_id)
            revenue_q = revenue_q.filter(models.Invoice.store_id == store_id)
        total_cost = cost_q.scalar() or 0
        total_revenue = revenue_q.scalar() or 0
        margin = total_revenue - total_cost
        margin_pct = (margin / total_revenue * 100) if total_revenue > 0 else 0

        # 6. Inventory velocity
        velocity_cutoff = datetime.utcnow() - timedelta(days=90)
        sold_recent_rows = db.query(
            models.DeviceInventory.received_date,
            func.min(models.Invoice.created_at).label('sold_date')
        ).join(
            models.InvoiceItem, models.InvoiceItem.imei == models.DeviceInventory.imei
        ).join(
            models.Invoice, models.Invoice.id == models.InvoiceItem.invoice_id
        ).filter(
            models.Invoice.created_at >= velocity_cutoff,
            models.DeviceInventory.org_id == org_id,
            models.DeviceInventory.device_status == models.DeviceStatus.Sold
        ).group_by(models.DeviceInventory.imei, models.DeviceInventory.received_date).all()
        if sold_recent_rows:
            avg_days = sum(
                (sold_date - received_date).days
                for received_date, sold_date in sold_recent_rows
                if received_date and sold_date
            ) / len(sold_recent_rows)
        else:
            avg_days = 0

        # 7. Shrinkage
        total_devices = db.query(models.DeviceInventory).filter(
            models.DeviceInventory.org_id == org_id
        ).count()
        sellable_devices = db.query(func.count(models.DeviceInventory.imei)).filter(
            models.DeviceInventory.org_id == org_id,
            models.DeviceInventory.device_status == models.DeviceStatus.Sellable
        ).scalar() or 0
        scrapped = 0
        try:
            scrapped = db.query(models.DeviceInventory).filter(
                models.DeviceInventory.device_status == models.DeviceStatus.Scrapped,
                models.DeviceInventory.org_id == org_id
            ).count()
        except Exception:
            scrapped = 0
        shrinkage_pct = (scrapped / total_devices * 100) if total_devices > 0 else 0

        # 8. Parts consumption
        parts_cost = db.query(func.sum(models.DeviceCostLedger.amount)).filter(
            models.DeviceCostLedger.cost_type.like("Part:%"),
            models.DeviceCostLedger.created_at >= start,
            models.DeviceCostLedger.org_id == org_id
        ).scalar() or 0

        # 9. Active repairs
        active_repairs = db.query(models.RepairTicket).filter(
            models.RepairTicket.status.in_([
                models.RepairStatus.Pending_Triage,
                models.RepairStatus.In_Repair,
                models.RepairStatus.Awaiting_Parts
            ]),
            models.RepairTicket.org_id == org_id
        ).count()

        # 10. Low stock parts
        low_stock = db.query(models.PartsInventory).filter(
            models.PartsInventory.current_stock_qty <= models.PartsInventory.low_stock_threshold,
            models.PartsInventory.org_id == org_id
        ).count()

        return {
            "total_sold": total_sold,
            "sales_by_location": dict(sales_by_location),
            "warehouse_outflow": warehouse_outflow,
            "top_selling_models": top_models,
            "gross_margin": round(margin, 2),
            "gross_margin_pct": round(margin_pct, 1),
            "total_revenue": round(total_revenue, 2),
            "total_cost": round(total_cost, 2),
            "inventory_velocity_days": round(avg_days, 1),
            "shrinkage_pct": round(shrinkage_pct, 2),
            "parts_cost_consumed": round(parts_cost, 2),
            "active_repairs": active_repairs,
            "low_stock_parts": low_stock,
            "total_devices": total_devices,
            "sellable_devices": sellable_devices,
        }
    except Exception:
        tb = traceback.format_exc()
        print(tb, file=sys.stderr)
        raise HTTPException(status_code=500, detail=tb[-500:])


@router.get("/tax-summary")
def get_tax_summary(
        date_range: str = Query("This Month"),
        store_id: Optional[str] = Query(None),
        db: Session = Depends(get_db),
        current_user: models.User = Depends(auth.require_role(["admin"]))
):
    org_id = getattr(current_user, 'current_org_id', None)
    start = _resolve_start(date_range)

    invoices = db.query(models.Invoice).filter(
        models.Invoice.created_at >= start,
        models.Invoice.org_id == org_id,
        *([models.Invoice.store_id == store_id] if store_id else []),
        models.Invoice.status.in_([
            models.InvoiceStatus.Paid,
            models.InvoiceStatus.Partially_Paid,
            models.InvoiceStatus.Unpaid,
            models.InvoiceStatus.Overdue,
        ]),
    ).all()

    by_store = defaultdict(lambda: {
        "store_name": "",
        "total_sales": 0.0,
        "taxable_sales": 0.0,
        "exempt_sales": 0.0,
        "tax_collected": 0.0,
        "tax_rate": 0.0,
        "invoice_count": 0,
    })

    for inv in invoices:
        sid = inv.store_id or "unknown"
        entry = by_store[sid]
        entry["store_name"] = inv.store_id or "Unknown"
        entry["total_sales"] += inv.subtotal or 0
        if inv.tax_amount and inv.tax_amount > 0:
            entry["taxable_sales"] += inv.subtotal or 0
            entry["tax_collected"] += inv.tax_amount or 0
            entry["tax_rate"] = inv.tax_percent or 0
        else:
            entry["exempt_sales"] += inv.subtotal or 0
        entry["invoice_count"] += 1

    store_list = []
    for sid, e in by_store.items():
        store = db.query(models.StoreLocation).filter(
            models.StoreLocation.id == sid, models.StoreLocation.org_id == org_id
        ).first()
        e["store_name"] = store.name if store else sid
        e["total_sales"] = round(e["total_sales"], 2)
        e["taxable_sales"] = round(e["taxable_sales"], 2)
        e["exempt_sales"] = round(e["exempt_sales"], 2)
        e["tax_collected"] = round(e["tax_collected"], 2)
        store_list.append(dict(e))

    totals = {
        "total_sales": round(sum(e["total_sales"] for e in store_list), 2),
        "taxable_sales": round(sum(e["taxable_sales"] for e in store_list), 2),
        "exempt_sales": round(sum(e["exempt_sales"] for e in store_list), 2),
        "tax_collected": round(sum(e["tax_collected"] for e in store_list), 2),
        "total_invoices": sum(e["invoice_count"] for e in store_list),
    }

    return {
        "stores": store_list,
        "totals": totals,
        "date_range": date_range,
    }


@router.get("/profit-loss")
def get_profit_loss(
        date_range: str = Query("This Month"),
        store_id: Optional[str] = Query(None),
        db: Session = Depends(get_db),
        current_user: models.User = Depends(auth.require_role(["admin"]))
):
    try:
        org_id = getattr(current_user, 'current_org_id', None)
        start = _resolve_start(date_range)
        
        def inv_filter(q):
            q = q.filter(models.Invoice.org_id == org_id)
            if store_id: q = q.filter(models.Invoice.store_id == store_id)
            return q

        # Revenue: sum of all non-voided/non-draft invoice totals
        revenue = inv_filter(db.query(func.sum(models.Invoice.total))).filter(
            models.Invoice.status.in_([
                models.InvoiceStatus.Paid,
                models.InvoiceStatus.Partially_Paid,
                models.InvoiceStatus.Unpaid,
                models.InvoiceStatus.Overdue,
            ])
        ).scalar() or 0

        # COGS: sum cost_basis for devices sold in period
        sold_cost = db.query(func.sum(models.DeviceInventory.cost_basis)).join(
            models.InvoiceItem, models.InvoiceItem.imei == models.DeviceInventory.imei
        ).join(
            models.Invoice, models.Invoice.id == models.InvoiceItem.invoice_id
        ).filter(
            models.Invoice.created_at >= start,
            models.Invoice.org_id == org_id,
            models.DeviceInventory.org_id == org_id,
            *([models.Invoice.store_id == store_id] if store_id else [])
        ).scalar() or 0

        # Parts sold (non-device SKUs) — estimate cost from parts_inventory
        parts_sold = inv_filter(db.query(
            models.InvoiceItem.sku, func.sum(models.InvoiceItem.quantity)
        ).join(
            models.Invoice, models.Invoice.id == models.InvoiceItem.invoice_id
        )).filter(
            models.InvoiceItem.sku != None,
            models.InvoiceItem.imei == None,
        ).group_by(models.InvoiceItem.sku).all()

        parts_cost = 0.0
        parts_revenue = 0.0
        for sku, qty in parts_sold:
            part = db.query(models.PartsInventory).filter(
                models.PartsInventory.sku == sku, models.PartsInventory.org_id == org_id
            ).first()
            if part:
                parts_cost += (part.moving_average_cost or 0) * (qty or 0)

        # Parts revenue from non-device items
        parts_revenue = inv_filter(db.query(func.sum(models.InvoiceItem.amount))).join(
            models.Invoice, models.Invoice.id == models.InvoiceItem.invoice_id
        ).filter(
            models.InvoiceItem.imei == None,
        ).scalar() or 0

        # Repair labor costs consumed
        repair_labor = db.query(func.sum(models.DeviceCostLedger.amount)).filter(
            models.DeviceCostLedger.cost_type.like("Labor:%"),
            models.DeviceCostLedger.created_at >= start,
            models.DeviceCostLedger.org_id == org_id
        ).scalar() or 0

        # Total COGS = devices + parts
        total_cogs = float(sold_cost) + parts_cost

        # Gross profit
        gross_profit = float(revenue) - total_cogs

        gross_margin_pct = (gross_profit / float(revenue) * 100) if revenue > 0 else 0

        return {
            "revenue": round(float(revenue), 2),
            "device_revenue": round(float(revenue) - parts_revenue, 2),
            "parts_revenue": round(parts_revenue, 2),
            "cost_of_goods_sold": round(total_cogs, 2),
            "device_cogs": round(float(sold_cost), 2),
            "parts_cogs": round(parts_cost, 2),
            "gross_profit": round(gross_profit, 2),
            "gross_margin_pct": round(gross_margin_pct, 1),
            "repair_labor_cost": round(repair_labor, 2),
            "operating_expenses": {
                "repair_labor": round(repair_labor, 2),
            },
            "net_profit": round(gross_profit - repair_labor, 2),
            "date_range": date_range,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Profit & Loss error: {str(e)}")


@router.get("/customer-statement/{crm_id}")
def get_customer_statement(
        crm_id: str,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(auth.require_role(["admin", "store"]))
):
    org_id = getattr(current_user, 'current_org_id', None)
    customer = db.query(models.UnifiedCustomer).filter(
        models.UnifiedCustomer.crm_id == crm_id,
        models.UnifiedCustomer.org_id == org_id
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    invoices = db.query(models.Invoice).filter(
        models.Invoice.customer_id == crm_id,
        models.Invoice.org_id == org_id,
        models.Invoice.status.in_([
            models.InvoiceStatus.Paid,
            models.InvoiceStatus.Partially_Paid,
            models.InvoiceStatus.Unpaid,
            models.InvoiceStatus.Overdue,
        ])
    ).order_by(models.Invoice.created_at.desc()).limit(50).all()

    name = ""
    if customer.company_name:
        name = customer.company_name
    elif customer.first_name or customer.last_name:
        name = f"{customer.first_name or ''} {customer.last_name or ''}".strip()
    else:
        name = crm_id

    statement = {
        "customer_name": name,
        "crm_id": crm_id,
        "customer_type": customer.customer_type.value if customer.customer_type else "Retail",
        "email": customer.email or "",
        "phone": customer.phone or "",
        "current_balance": customer.current_balance or 0,
        "credit_limit": customer.credit_limit or 0,
        "invoices": [],
        "total_outstanding": 0.0,
        "total_paid": 0.0,
    }

    for inv in invoices:
        paid = inv.paid_amount or 0
        balance = inv.total - paid
        statement["total_outstanding"] += balance
        statement["total_paid"] += paid
        statement["invoices"].append({
            "invoice_number": inv.invoice_number,
            "created_at": inv.created_at.isoformat() if inv.created_at else None,
            "due_date": inv.due_date.isoformat() if inv.due_date else None,
            "total": round(inv.total, 2),
            "paid": round(paid, 2),
            "balance": round(balance, 2),
            "status": inv.status.value if hasattr(inv.status, 'value') else str(inv.status),
        })

    return statement


@router.get("/daily-close")
def daily_close(
        date: str = Query("today"),
        db: Session = Depends(get_db),
        current_user: models.User = Depends(auth.require_role(["admin"]))
):
    org_id = getattr(current_user, 'current_org_id', None)
    if date == "today":
        target = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        target = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    invoices = db.query(models.Invoice).filter(
        models.Invoice.created_at >= target,
        models.Invoice.org_id == org_id,
        models.Invoice.status.in_([
            models.InvoiceStatus.Paid, models.InvoiceStatus.Partially_Paid,
            models.InvoiceStatus.Unpaid, models.InvoiceStatus.Overdue,
        ])
    ).all()

    payments = db.query(models.PaymentTransaction).filter(
        models.PaymentTransaction.timestamp >= target,
        models.PaymentTransaction.org_id == org_id,
    ).all()

    by_payment_method = defaultdict(lambda: 0.0)
    for p in payments:
        by_payment_method[p.payment_method.value if hasattr(p.payment_method, 'value') else str(p.payment_method)] += p.amount

    total_invoices = len(invoices)
    total_revenue = sum(inv.total for inv in invoices)
    total_paid = sum(inv.paid_amount for inv in invoices)
    total_outstanding = total_revenue - total_paid
    total_tax = sum(inv.tax_amount or 0 for inv in invoices)
    total_discounts = sum(inv.discount_total or 0 for inv in invoices)

    return {
        "date": target.isoformat(),
        "total_invoices": total_invoices,
        "total_revenue": round(total_revenue, 2),
        "total_paid": round(total_paid, 2),
        "total_outstanding": round(total_outstanding, 2),
        "total_tax": round(total_tax, 2),
        "total_discounts": round(total_discounts, 2),
        "by_payment_method": {k: round(v, 2) for k, v in by_payment_method.items()},
    }


@router.get("/employee-sales")
def employee_sales(
        date_range: str = Query("Today"),
        db: Session = Depends(get_db),
        current_user: models.User = Depends(auth.require_role(["admin"]))
):
    org_id = getattr(current_user, 'current_org_id', None)
    start = _resolve_start(date_range)

    invoices = db.query(models.Invoice).filter(
        models.Invoice.created_at >= start,
        models.Invoice.org_id == org_id,
        models.Invoice.status.in_([
            models.InvoiceStatus.Paid, models.InvoiceStatus.Partially_Paid,
            models.InvoiceStatus.Unpaid, models.InvoiceStatus.Overdue,
        ])
    ).all()

    by_employee = defaultdict(lambda: {"email": "", "invoices": 0, "sales": 0.0, "items": 0})
    for inv in invoices:
        email = getattr(inv, 'created_by_email', None) or "unattributed"
        by_employee[email]["email"] = email
        by_employee[email]["invoices"] += 1
        by_employee[email]["sales"] += inv.total or 0
        by_employee[email]["items"] += len(inv.items or [])

    result = sorted(by_employee.values(), key=lambda x: x["sales"], reverse=True)
    for r in result:
        r["sales"] = round(r["sales"], 2)

    return {
        "employees": result,
        "date_range": date_range,
        "total_sales": round(sum(r["sales"] for r in result), 2),
    }


@router.get("/low-stock")
def low_stock_alerts(
        db: Session = Depends(get_db),
        current_user: models.User = Depends(auth.require_role(["admin", "warehouse"]))
):
    org_id = getattr(current_user, 'current_org_id', None)
    parts = db.query(models.PartsInventory).filter(
        models.PartsInventory.org_id == org_id,
        models.PartsInventory.current_stock_qty <= models.PartsInventory.low_stock_threshold,
        models.PartsInventory.current_stock_qty > 0,
    ).all()

    out_of_stock = db.query(models.PartsInventory).filter(
        models.PartsInventory.org_id == org_id,
        models.PartsInventory.current_stock_qty <= 0,
    ).all()

    return {
        "low_stock": [{
            "sku": p.sku, "part_name": p.part_name,
            "current_stock_qty": p.current_stock_qty,
            "low_stock_threshold": p.low_stock_threshold,
        } for p in parts],
        "out_of_stock": [{"sku": p.sku, "part_name": p.part_name} for p in out_of_stock],
        "low_stock_count": len(parts),
        "out_of_stock_count": len(out_of_stock),
    }
def export_dashboard_csv(
        date_range: str = Query("This Month"),
        db: Session = Depends(get_db),
        current_user: models.User = Depends(auth.require_role(["admin"]))
):
    data = get_dashboard(date_range, db, current_user)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Metric", "Value"])
    for k, v in data.items():
        w.writerow([k, v])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=dashboard_export.csv"}
    )


def _granularity(date_range: str) -> str:
    """Derive grouping granularity from date_range preset."""
    if date_range == "Today":
        return "hour"
    elif date_range in ("This Week", "This Month"):
        return "day"
    elif date_range in ("3 Months", "6 Months"):
        return "week"
    else:
        return "month"


def _date_trunc(granularity: str, col):
    """Return a SQLAlchemy expression for date truncation."""
    if granularity == "hour":
        return func.date_trunc("hour", col)
    elif granularity == "day":
        return func.date(col)
    elif granularity == "week":
        return func.date_trunc("week", col)
    else:
        return func.date_trunc("month", col)


@router.get("/dashboard/timeseries")
def get_timeseries(
        date_range: str = Query("This Month"),
        store_id: Optional[str] = Query(None),
        db: Session = Depends(get_db),
        current_user: models.User = Depends(auth.require_role(["admin"]))
):
    org_id = getattr(current_user, 'current_org_id', None)
    start = _resolve_start(date_range)
    gran = _granularity(date_range)

    # Sales time-series — invoice items grouped by period
    sales_group = _date_trunc(gran, models.Invoice.created_at)
    sales_rows = db.query(
        sales_group.label("period"), func.count(models.InvoiceItem.id)
    ).join(models.InvoiceItem).filter(
        models.Invoice.created_at >= start,
        models.Invoice.org_id == org_id
    ).group_by(sales_group).order_by(sales_group).all()

    sales_series = [
        {"date": str(r[0])[:10], "count": r[1]}
        for r in sales_rows
    ]

    # Revenue time-series — invoice totals grouped by period
    rev_group = _date_trunc(gran, models.Invoice.created_at)
    rev_rows = db.query(
        rev_group.label("period"), func.sum(models.Invoice.total)
    ).filter(
        models.Invoice.created_at >= start,
        models.Invoice.org_id == org_id
    ).group_by(rev_group).order_by(rev_group).all()

    revenue_series = [
        {"date": str(r[0])[:10], "amount": round(float(r[1] or 0), 2)}
        for r in rev_rows
    ]

    # Inventory levels — starting count + net change per period
    devices_before = db.query(func.count(models.DeviceInventory.imei)).filter(
        models.DeviceInventory.received_date < start,
        models.DeviceInventory.org_id == org_id
    ).scalar() or 0

    received_group = _date_trunc(gran, models.DeviceInventory.received_date)
    received_rows = db.query(
        received_group.label("period"), func.count(models.DeviceInventory.imei)
    ).filter(
        models.DeviceInventory.received_date >= start,
        models.DeviceInventory.org_id == org_id
    ).group_by(received_group).order_by(received_group).all()

    sold_group = _date_trunc(gran, models.Invoice.created_at)
    sold_rows = db.query(
        sold_group.label("period"), func.count(models.InvoiceItem.id)
    ).join(models.InvoiceItem).filter(
        models.Invoice.created_at >= start,
        models.Invoice.org_id == org_id
    ).group_by(sold_group).order_by(sold_group).all()

    received_map = {str(r[0])[:10]: r[1] for r in received_rows}
    sold_map = {str(r[0])[:10]: r[1] for r in sold_rows}

    # Collect all period keys for inventory series
    all_periods = sorted(set(
        str(r[0])[:10] for r in received_rows + sold_rows
    ))

    running = devices_before
    inventory_series = []
    for period in all_periods:
        received_in = received_map.get(period, 0)
        sold_in = sold_map.get(period, 0)
        running = running + received_in - sold_in
        inventory_series.append({"date": period, "count": running})

    return {
        "sales": sales_series,
        "revenue": revenue_series,
        "inventory_levels": inventory_series,
    }


@router.get("/ar-aging")
def get_ar_aging(
        store_id: Optional[str] = Query(None),
        db: Session = Depends(get_db),
        current_user: models.User = Depends(auth.require_role(["admin"]))
):
    org_id = getattr(current_user, 'current_org_id', None)
    now = datetime.utcnow()

    invoices = db.query(models.Invoice).filter(
        models.Invoice.org_id == org_id,
        models.Invoice.status.in_([
            models.InvoiceStatus.Unpaid,
            models.InvoiceStatus.Partially_Paid,
            models.InvoiceStatus.Overdue,
        ])
    ).all()

    customer_aging = defaultdict(lambda: {
        "crm_id": "",
        "customer_name": "",
        "customer_type": "",
        "total_outstanding": 0.0,
        "current": 0.0,
        "1_30": 0.0,
        "31_60": 0.0,
        "61_90": 0.0,
        "90_plus": 0.0,
        "invoices": [],
    })

    for inv in invoices:
        cid = inv.customer_id or "unassigned"
        entry = customer_aging[cid]
        entry["crm_id"] = cid
        if inv.customer:
            if inv.customer.customer_type and inv.customer.customer_type != models.CustomerType.Retail:
                entry["customer_name"] = inv.customer.company_name or ""
                entry["customer_type"] = inv.customer.customer_type.value if hasattr(inv.customer.customer_type, 'value') else str(inv.customer.customer_type)
            else:
                first = inv.customer.first_name or ""
                last = inv.customer.last_name or ""
                entry["customer_name"] = f"{first} {last}".strip() or "Walk-in"
                entry["customer_type"] = "Retail"
        else:
            entry["customer_name"] = "Walk-in"
            entry["customer_type"] = "Retail"

        balance = inv.total - (inv.paid_amount or 0)
        if balance <= 0:
            continue

        entry["total_outstanding"] += balance

        if inv.due_date and now > inv.due_date:
            days_overdue = (now - inv.due_date).days
            if days_overdue <= 30:
                entry["1_30"] += balance
            elif days_overdue <= 60:
                entry["31_60"] += balance
            elif days_overdue <= 90:
                entry["61_90"] += balance
            else:
                entry["90_plus"] += balance
        else:
            entry["current"] += balance

        entry["invoices"].append({
            "invoice_number": inv.invoice_number,
            "total": inv.total,
            "paid": round(inv.paid_amount, 2),
            "balance": round(balance, 2),
            "due_date": inv.due_date.isoformat() if inv.due_date else None,
            "created_at": inv.created_at.isoformat() if inv.created_at else None,
            "status": inv.status.value if hasattr(inv.status, 'value') else str(inv.status),
        })

    result = sorted(customer_aging.values(), key=lambda x: x["total_outstanding"], reverse=True)
    totals = {
        "current": sum(r["current"] for r in result),
        "1_30": sum(r["1_30"] for r in result),
        "31_60": sum(r["31_60"] for r in result),
        "61_90": sum(r["61_90"] for r in result),
        "90_plus": sum(r["90_plus"] for r in result),
        "total_outstanding": sum(r["total_outstanding"] for r in result),
    }

    return {
        "customers": result,
        "totals": totals,
        "customer_count": len(result),
    }


# ── CSV Export ──────────────────────────────────────────────────────────────

@router.get("/export")
def export_report(
    report_type: str = Query(...),
    date_range: str = Query("All Time"),
    store_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin", "store"])),
):
    """Export any report as CSV. Returns a downloadable file."""
    from sqlalchemy import cast, Date

    org_id = getattr(current_user, 'current_org_id', None)
    user_store = current_user.store_id if current_user.role != "admin" else None
    effective_store = user_store or store_id
    start = _resolve_start(date_range)
    now = datetime.utcnow()

    def store_filter(q, col):
        if effective_store:
            return q.filter(col == effective_store)
        return q

    output = io.StringIO()
    writer = csv.writer(output)

    if report_type == "inventory":
        writer.writerow(["Model Number", "Brand", "Name", "Storage (GB)", "Status", "Store", "IMEI", "Notes", "Received Date"])
        rows = db.query(
            models.DeviceInventory.model_number,
            models.PhoneModel.brand,
            models.PhoneModel.name,
            models.PhoneModel.storage_gb,
            models.DeviceInventory.device_status,
            models.DeviceInventory.location_id,
            models.DeviceInventory.imei,
            models.DeviceInventory.notes,
            models.DeviceInventory.received_date,
        ).outerjoin(
            models.PhoneModel, models.PhoneModel.model_number == models.DeviceInventory.model_number
        ).filter(
            models.DeviceInventory.org_id == org_id,
        )
        rows = store_filter(rows, models.DeviceInventory.store_id)
        for r in rows.order_by(models.DeviceInventory.received_date.desc()).all():
            writer.writerow([
                r[0] or "", r[1] or "", r[2] or "", r[3] or 0,
                r[4].value if r[4] else "", r[5] or "", r[6] or "",
                r[7] or "", r[8].isoformat() if r[8] else "",
            ])

    elif report_type == "sales":
        writer.writerow(["Invoice #", "Date", "Customer", "Items", "Subtotal", "Tax", "Total", "Paid", "Balance", "Status", "Store"])
        q = db.query(
            models.Invoice.invoice_number, models.Invoice.created_at,
            models.UnifiedCustomer.company_name, models.UnifiedCustomer.first_name,
            models.UnifiedCustomer.last_name,
            models.Invoice.subtotal, models.Invoice.tax_amount, models.Invoice.total,
            models.Invoice.paid_amount, models.Invoice.status, models.Invoice.store_id,
        ).outerjoin(
            models.UnifiedCustomer, models.Invoice.customer_id == models.UnifiedCustomer.crm_id
        ).filter(
            models.Invoice.org_id == org_id,
            models.Invoice.created_at >= start,
            models.Invoice.status.in_([models.InvoiceStatus.Paid, models.InvoiceStatus.Partially_Paid, models.InvoiceStatus.Unpaid, models.InvoiceStatus.Overdue]),
        )
        q = store_filter(q, models.Invoice.store_id)
        for r in q.order_by(models.Invoice.created_at.desc()).all():
            cust = r[2] or f"{r[3] or ''} {r[4] or ''}".strip() or "Walk-in"
            balance = (r[7] or 0) - (r[8] or 0)
            writer.writerow([
                r[0], r[1].isoformat() if r[1] else "", cust, "",
                round(r[5] or 0, 2), round(r[6] or 0, 2), round(r[7] or 0, 2),
                round(r[8] or 0, 2), round(balance, 2),
                r[9].value if r[9] else "", r[10] or "",
            ])

    elif report_type == "profit-loss":
        writer.writerow(["Metric", "Value"])
        revenue = db.query(func.sum(models.Invoice.total)).filter(
            models.Invoice.org_id == org_id, models.Invoice.created_at >= start,
            models.Invoice.status.in_([models.InvoiceStatus.Paid, models.InvoiceStatus.Partially_Paid]),
        )
        revenue = store_filter(revenue, models.Invoice.store_id).scalar() or 0

        cogs = db.query(func.sum(models.DeviceInventory.cost_basis)).join(
            models.InvoiceItem, models.InvoiceItem.imei == models.DeviceInventory.imei
        ).join(
            models.Invoice, models.Invoice.id == models.InvoiceItem.invoice_id
        ).filter(
            models.DeviceInventory.org_id == org_id,
            models.Invoice.created_at >= start,
        )
        cogs = store_filter(cogs, models.Invoice.store_id).scalar() or 0

        gross = revenue - cogs
        margin_pct = round((gross / revenue * 100), 1) if revenue > 0 else 0
        writer.writerow(["Revenue", round(revenue, 2)])
        writer.writerow(["Cost of Goods Sold", round(cogs, 2)])
        writer.writerow(["Gross Profit", round(gross, 2)])
        writer.writerow(["Gross Margin %", margin_pct])

    elif report_type == "tax-summary":
        writer.writerow(["Store", "Total Sales", "Taxable Sales", "Exempt Sales", "Tax Collected", "Invoices"])
        q = db.query(
            models.Invoice.store_id,
            func.count(models.Invoice.id),
            func.sum(models.Invoice.total),
            func.sum(models.Invoice.tax_amount),
        ).filter(
            models.Invoice.org_id == org_id,
            models.Invoice.created_at >= start,
            models.Invoice.status.in_([models.InvoiceStatus.Paid, models.InvoiceStatus.Partially_Paid]),
        )
        q = store_filter(q, models.Invoice.store_id)
        for sid, cnt, total, tax in q.group_by(models.Invoice.store_id).all():
            taxable = total or 0
            exempt = 0
            writer.writerow([sid or "", cnt or 0, round(taxable, 2), round(exempt, 2), round(tax or 0, 2), cnt or 0])

    elif report_type == "ar-aging":
        writer.writerow(["Customer", "Total Outstanding", "Current", "1-30 Days", "31-60 Days", "61-90 Days", "90+ Days"])
        customers = db.query(models.UnifiedCustomer).filter(
            models.UnifiedCustomer.org_id == org_id,
        ).all()
        for c in customers:
            invs = db.query(models.Invoice).filter(
                models.Invoice.customer_id == c.crm_id,
                models.Invoice.org_id == org_id,
                models.Invoice.status.in_([models.InvoiceStatus.Unpaid, models.InvoiceStatus.Overdue, models.InvoiceStatus.Partially_Paid]),
            )
            invs = store_filter(invs, models.Invoice.store_id)
            invs = invs.all()
            if not invs:
                continue
            total_bal = 0
            current = overdue_1_30 = overdue_31_60 = overdue_61_90 = overdue_90plus = 0
            for inv in invs:
                bal = (inv.total or 0) - (inv.paid_amount or 0)
                if bal <= 0:
                    continue
                total_bal += bal
                if inv.due_date and now > inv.due_date:
                    days = (now - inv.due_date).days
                    if days <= 30: overdue_1_30 += bal
                    elif days <= 60: overdue_31_60 += bal
                    elif days <= 90: overdue_61_90 += bal
                    else: overdue_90plus += bal
                else:
                    current += bal
            if total_bal > 0:
                name = c.company_name or f"{c.first_name or ''} {c.last_name or ''}".strip() or c.crm_id
                writer.writerow([name, round(total_bal, 2), round(current, 2), round(overdue_1_30, 2), round(overdue_31_60, 2), round(overdue_61_90, 2), round(overdue_90plus, 2)])

    elif report_type == "employee-sales":
        writer.writerow(["Employee", "Invoice Count", "Total Sales", "Date Range"])
        q = db.query(
            models.Invoice.created_by_email,
            func.count(models.Invoice.id),
            func.sum(models.Invoice.total),
        ).filter(
            models.Invoice.org_id == org_id,
            models.Invoice.created_at >= start,
            models.Invoice.status.in_([models.InvoiceStatus.Paid, models.InvoiceStatus.Partially_Paid]),
        )
        q = store_filter(q, models.Invoice.store_id)
        for email, cnt, total in q.group_by(models.Invoice.created_by_email).all():
            writer.writerow([email or "Unknown", cnt or 0, round(total or 0, 2), date_range])

    elif report_type == "transfers":
        writer.writerow(["Transfer ID", "Date", "From", "To", "Status", "Device Count"])
        q = db.query(
            models.TransferOrder.id, models.TransferOrder.created_at,
            models.TransferOrder.source_location_id, models.TransferOrder.destination_location_id,
            models.TransferOrder.status,
        ).filter(models.TransferOrder.org_id == org_id)
        if effective_store:
            from sqlalchemy import or_
            q = q.filter(or_(
                models.TransferOrder.source_location_id == effective_store,
                models.TransferOrder.destination_location_id == effective_store,
            ))
        for to_id, created_at, src, dst, status in q.order_by(models.TransferOrder.created_at.desc()).all():
            cnt = db.query(func.count(models.DeviceInventory.imei)).filter(
                models.DeviceInventory.assigned_transfer_order_id == to_id,
            ).scalar() or 0
            writer.writerow([to_id, created_at.isoformat() if created_at else "", src or "", dst or "", status or "", cnt])

    elif report_type == "customers":
        writer.writerow(["CRM ID", "Name", "Company", "Phone", "Email", "Type", "Balance", "Credit Limit"])
        for c in db.query(models.UnifiedCustomer).filter(models.UnifiedCustomer.org_id == org_id).order_by(models.UnifiedCustomer.name).all():
            name = f"{c.first_name or ''} {c.last_name or ''}".strip()
            writer.writerow([c.crm_id, name, c.company_name or "", c.phone or "", c.email or "", c.customer_type.value if c.customer_type else "", round(c.current_balance or 0, 2), round(c.credit_limit or 0, 2)])

    elif report_type == "low-stock":
        writer.writerow(["Model Number", "Brand", "Name", "Storage (GB)", "In Stock"])
        inv_q = db.query(
            models.DeviceInventory.model_number,
            models.PhoneModel.brand,
            models.PhoneModel.name,
            models.PhoneModel.storage_gb,
            func.count(models.DeviceInventory.imei),
        ).join(
            models.PhoneModel, models.PhoneModel.model_number == models.DeviceInventory.model_number
        ).filter(
            models.DeviceInventory.org_id == org_id,
            models.DeviceInventory.device_status.in_([models.DeviceStatus.Sellable, models.DeviceStatus.In_QC]),
        )
        inv_q = store_filter(inv_q, models.DeviceInventory.store_id)
        for mn, brand, name, storage, cnt in inv_q.group_by(
            models.DeviceInventory.model_number, models.PhoneModel.brand,
            models.PhoneModel.name, models.PhoneModel.storage_gb,
        ).having(func.count(models.DeviceInventory.imei) <= 5).order_by(func.count(models.DeviceInventory.imei)).all():
            writer.writerow([mn or "", brand or "", name or "", storage or 0, cnt])

    else:
        raise HTTPException(status_code=400, detail=f"Unknown report type: {report_type}")

    csv_content = output.getvalue()
    output.close()

    filename = f"{report_type}_{date_range.replace(' ', '_')}_{datetime.utcnow().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
