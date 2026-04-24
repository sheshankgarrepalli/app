from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from collections import defaultdict
import models, auth
from database import get_db

router = APIRouter(prefix="/api/reports", tags=["reports"])

@router.get("/dashboard")
def get_dashboard(
    date_range: str = Query("Today"), 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.require_role(["admin", "owner"]))
):
    now = datetime.utcnow()
    start_date = now
    
    if date_range == "Today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif date_range == "This Week":
        start_date = now - timedelta(days=now.weekday())
        start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    elif date_range == "This Month":
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif date_range == "3 Months":
        start_date = now - timedelta(days=90)
    elif date_range == "6 Months":
        start_date = now - timedelta(days=180)
        
    # 1. Total Sold (Count of items, not invoices)
    # Joining with Invoice to filter by created_at
    total_sold = db.query(models.InvoiceItem).join(models.Invoice).filter(
        models.Invoice.created_at >= start_date
    ).count()
    
    # 2. Sales by Location (Count of items per store)
    # Robust handling of store IDs using defaultdict
    location_query = db.query(
        models.Invoice.store_id, 
        func.count(models.InvoiceItem.id)
    ).join(models.InvoiceItem).filter(
        models.Invoice.created_at >= start_date
    ).group_by(models.Invoice.store_id).all()
    
    sales_by_location = defaultdict(int)
    # Initialize default stores for UI consistency
    for s in ["store_a", "store_b", "store_c"]:
        sales_by_location[s] = 0
        
    for store_id, count in location_query:
        # Clean up key name for UI (e.g. Warehouse_Alpha -> Warehouse Alpha)
        clean_key = store_id.replace("_", " ").title() if store_id else "Unknown"
        sales_by_location[store_id] = count
        
    # 3. Warehouse Outflow (Count of items in Transfer Orders)
    # TransferOrder model has no items relationship in models.py? 
    # Let's check: models says TransferOrder id is String, DeviceInventory has assigned_transfer_order_id.
    warehouse_outflow = db.query(models.DeviceInventory).filter(
        models.DeviceInventory.assigned_transfer_order_id.isnot(None),
        models.DeviceInventory.received_date >= start_date # Approximate if created_at is missing on DeviceInventory
    ).count()
    # Actually models.TransferOrder has created_at
    warehouse_outflow = db.query(models.TransferOrder).filter(
        models.TransferOrder.created_at >= start_date
    ).count()
    
    # 4. Top Selling Models
    top_models = db.query(
        models.InvoiceItem.model_number, 
        func.count(models.InvoiceItem.id).label('count')
    ).join(models.Invoice, models.Invoice.id == models.InvoiceItem.invoice_id) \
     .filter(models.Invoice.created_at >= start_date) \
     .group_by(models.InvoiceItem.model_number) \
     .order_by(func.count(models.InvoiceItem.id).desc()) \
     .limit(5).all()
     
    top_models_list = [{"model_number": m[0], "count": m[1]} for m in top_models]
    
    return {
        "total_sold": total_sold,
        "sales_by_location": dict(sales_by_location),
        "warehouse_outflow": warehouse_outflow,
        "top_selling_models": top_models_list
    }
