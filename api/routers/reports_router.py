from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from datetime import datetime, timedelta
from collections import defaultdict
import models, auth
from database import get_db
import io, csv

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
        db: Session = Depends(get_db),
        current_user: models.User = Depends(auth.require_role(["admin"]))
):
    import traceback, sys
    try:
        org_id = getattr(current_user, 'current_org_id', None)
        start = _resolve_start(date_range)

        # 1. Total sold
        total_sold = db.query(models.InvoiceItem).join(models.Invoice).filter(
            models.Invoice.created_at >= start, models.Invoice.org_id == org_id
        ).count()

        # 2. Sales by location
        loc_rows = db.query(
            models.Invoice.store_id, func.count(models.InvoiceItem.id)
        ).join(models.InvoiceItem).filter(
            models.Invoice.created_at >= start, models.Invoice.org_id == org_id
        ).group_by(models.Invoice.store_id).all()
        sales_by_location = defaultdict(int)
        for sid, cnt in loc_rows:
            sales_by_location[sid] = cnt

        # 3. Warehouse outflow
        warehouse_outflow = db.query(models.TransferOrder).filter(
            models.TransferOrder.created_at >= start, models.TransferOrder.org_id == org_id
        ).count()

        # 4. Top models
        top = db.query(
            models.InvoiceItem.model_number, func.count(models.InvoiceItem.id)
        ).join(models.Invoice).filter(
            models.Invoice.created_at >= start, models.Invoice.org_id == org_id
        ).group_by(models.InvoiceItem.model_number).order_by(func.count(models.InvoiceItem.id).desc()).limit(5).all()
        top_models = [{"model_number": m[0], "count": m[1]} for m in top]

        # 5. Gross margin
        total_cost = db.query(func.sum(models.DeviceInventory.cost_basis)).filter(
            models.DeviceInventory.device_status == models.DeviceStatus.Sold,
            models.DeviceInventory.org_id == org_id
        ).scalar() or 0
        total_revenue = db.query(func.sum(models.Invoice.total)).filter(
            models.Invoice.org_id == org_id
        ).scalar() or 0
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


@router.get("/dashboard/export")
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
