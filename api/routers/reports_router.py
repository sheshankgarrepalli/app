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
        current_user: models.User = Depends(auth.require_role(["admin", "owner"]))
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
        sales_by_location = defaultdict(int, {s: 0 for s in ["store_a", "store_b", "store_c"]})
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
        }
    except Exception:
        tb = traceback.format_exc()
        print(tb, file=sys.stderr)
        raise HTTPException(status_code=500, detail=tb[-500:])


@router.get("/dashboard/export")
def export_dashboard_csv(
        date_range: str = Query("This Month"),
        db: Session = Depends(get_db),
        current_user: models.User = Depends(auth.require_role(["admin", "owner"]))
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
