from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import models, schemas, auth
from database import get_db
import re

router = APIRouter(prefix="/api/models", tags=["models"])


def infer_device_type(name: str) -> str:
    n = name.lower()
    for kw in ["iphone", "galaxy", "pixel", "oneplus", "xiaomi", "motorola", "nokia", "moto"]:
        if kw in n: return "Phone"
    for kw in ["ipad", "tablet", "tab"]:
        if kw in n: return "Tablet"
    for kw in ["macbook", "imac", "mac mini", "mac pro", "mac"]:
        if kw in n: return "Laptop"
    for kw in ["watch"]:
        if kw in n: return "Watch"
    for kw in ["nintendo", "playstation", "xbox", "ps5"]:
        if kw in n: return "Console"
    for kw in ["airpods", "pencil", "keyboard", "mouse", "trackpad", "homepod", "airtag", "beats", "case", "charger", "cable", "adapter"]:
        if kw in n: return "Accessory"
    return "Other"


@router.get("", include_in_schema=False)
@router.get("/", response_model=List[schemas.PhoneModelOut])
def get_models(
    search: Optional[str] = Query(None),
    brand: Optional[str] = Query(None),
    device_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    q = db.query(models.PhoneModel).filter(
        models.PhoneModel.org_id == getattr(current_user, 'current_org_id', None)
    )
    if search:
        q = q.filter(
            models.PhoneModel.name.ilike(f"%{search}%") |
            models.PhoneModel.brand.ilike(f"%{search}%") |
            models.PhoneModel.model_number.ilike(f"%{search}%")
        )
    if brand:
        q = q.filter(models.PhoneModel.brand.ilike(f"%{brand}%"))
    if device_type:
        # Filter by inferred device type from the model name
        name_conditions = []
        dt = device_type.lower()
        if dt == "phone":
            name_conditions.append(models.PhoneModel.name.ilike("%iphone%"))
            name_conditions.append(models.PhoneModel.name.ilike("%galaxy%"))
            name_conditions.append(models.PhoneModel.name.ilike("%pixel%"))
            name_conditions.append(models.PhoneModel.name.ilike("%moto%"))
            name_conditions.append(models.PhoneModel.name.ilike("%oneplus%"))
            name_conditions.append(models.PhoneModel.name.ilike("%nokia%"))
            name_conditions.append(models.PhoneModel.name.ilike("%xiaomi%"))
        elif dt == "tablet":
            name_conditions.append(models.PhoneModel.name.ilike("%ipad%"))
            name_conditions.append(models.PhoneModel.name.ilike("%tab%"))
        elif dt == "laptop":
            name_conditions.append(models.PhoneModel.name.ilike("%macbook%"))
            name_conditions.append(models.PhoneModel.name.ilike("%imac%"))
            name_conditions.append(models.PhoneModel.name.ilike("%mac%"))
        elif dt == "watch":
            name_conditions.append(models.PhoneModel.name.ilike("%watch%"))
        elif dt == "console":
            name_conditions.append(models.PhoneModel.name.ilike("%nintendo%"))
            name_conditions.append(models.PhoneModel.name.ilike("%playstation%"))
            name_conditions.append(models.PhoneModel.name.ilike("%xbox%"))
        elif dt == "accessory":
            name_conditions.append(models.PhoneModel.name.ilike("%airpods%"))
            name_conditions.append(models.PhoneModel.name.ilike("%pencil%"))
            name_conditions.append(models.PhoneModel.name.ilike("%keyboard%"))
            name_conditions.append(models.PhoneModel.name.ilike("%mouse%"))
            name_conditions.append(models.PhoneModel.name.ilike("%homepod%"))
            name_conditions.append(models.PhoneModel.name.ilike("%airtag%"))
            name_conditions.append(models.PhoneModel.name.ilike("%beats%"))
        if name_conditions:
            from sqlalchemy import or_
            q = q.filter(or_(*name_conditions))
    return q.order_by(models.PhoneModel.brand, models.PhoneModel.name).all()


@router.get("/brands", response_model=List[str])
def get_brands(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    rows = db.query(models.PhoneModel.brand).filter(
        models.PhoneModel.org_id == getattr(current_user, 'current_org_id', None)
    ).distinct().order_by(models.PhoneModel.brand).all()
    return [r[0] for r in rows if r[0]]


@router.get("/analytics", include_in_schema=False)
@router.get("/{model_number}/analytics")
def get_model_analytics(
    model_number: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Returns per-model inventory stats with aggregated timeline events."""
    from sqlalchemy import func, cast, Date

    org_id = getattr(current_user, 'current_org_id', None)

    # ── Status breakdown ──
    status_counts = {s.value: 0 for s in models.DeviceStatus}
    rows = db.query(
        models.DeviceInventory.device_status,
        func.count(models.DeviceInventory.imei)
    ).filter(
        models.DeviceInventory.model_number == model_number,
        models.DeviceInventory.org_id == org_id,
    ).group_by(models.DeviceInventory.device_status).all()
    for status_val, count in rows:
        if status_val:
            status_counts[status_val.value] = count

    total_in_stock = sum(c for s, c in status_counts.items() if s not in ("Sold", "Scrapped") and c > 0)
    available = status_counts.get("Sellable", 0)
    sold = status_counts.get("Sold", 0)
    scrapped = status_counts.get("Scrapped", 0)

    # ── Store breakdown ──
    store_breakdown = []
    store_rows = db.query(
        models.DeviceInventory.location_id,
        func.count(models.DeviceInventory.imei)
    ).filter(
        models.DeviceInventory.model_number == model_number,
        models.DeviceInventory.org_id == org_id,
        models.DeviceInventory.device_status.in_([
            models.DeviceStatus.Sellable,
            models.DeviceStatus.In_QC,
            models.DeviceStatus.In_Repair,
            models.DeviceStatus.In_Transit,
            models.DeviceStatus.Reserved_Layaway,
            models.DeviceStatus.Awaiting_Parts,
            models.DeviceStatus.On_Consignment,
        ])
    ).group_by(models.DeviceInventory.location_id).all()
    for loc_id, count in store_rows:
        loc_name = loc_id
        if loc_id:
            sl = db.query(models.StoreLocation).filter(models.StoreLocation.id == loc_id).first()
            if sl:
                loc_name = sl.name
        store_breakdown.append({"location_id": loc_id, "location_name": loc_name, "count": count})

    # ── Aggregated timeline ──
    timeline = []

    # --- Imports: group by date ---
    import_dates = db.query(
        cast(models.DeviceHistoryLog.timestamp, Date),
        func.count(func.distinct(models.DeviceHistoryLog.imei))
    ).join(
        models.DeviceInventory,
        models.DeviceHistoryLog.imei == models.DeviceInventory.imei
    ).filter(
        models.DeviceInventory.model_number == model_number,
        models.DeviceInventory.org_id == org_id,
        models.DeviceHistoryLog.action_type.in_(["Excel Import", "Blind Scan"])
    ).group_by(
        cast(models.DeviceHistoryLog.timestamp, Date)
    ).order_by(
        cast(models.DeviceHistoryLog.timestamp, Date).desc()
    ).all()
    for date_val, count in import_dates:
        timeline.append({
            "type": "import",
            "label": f"Imported {count} unit{'s' if count != 1 else ''}",
            "date": date_val.isoformat() if date_val else None,
            "count": count,
        })

    # --- Sales: get invoice items with customer info ---
    sales = db.query(
        models.Invoice.invoice_number,
        models.Invoice.created_at,
        models.UnifiedCustomer.company_name,
        models.UnifiedCustomer.first_name,
        models.UnifiedCustomer.last_name,
        func.count(models.InvoiceItem.id)
    ).join(
        models.InvoiceItem,
        models.Invoice.id == models.InvoiceItem.invoice_id
    ).join(
        models.DeviceInventory,
        models.DeviceInventory.imei == models.InvoiceItem.imei
    ).outerjoin(
        models.UnifiedCustomer,
        models.Invoice.customer_id == models.UnifiedCustomer.crm_id
    ).filter(
        models.DeviceInventory.model_number == model_number,
        models.DeviceInventory.org_id == org_id,
        models.Invoice.status.in_([
            models.InvoiceStatus.Paid,
            models.InvoiceStatus.Partially_Paid,
        ])
    ).group_by(
        models.Invoice.invoice_number,
        models.Invoice.created_at,
        models.UnifiedCustomer.company_name,
        models.UnifiedCustomer.first_name,
        models.UnifiedCustomer.last_name,
    ).order_by(models.Invoice.created_at.desc()).limit(20).all()

    for inv_num, created_at, company, fname, lname, count in sales:
        cust_name = company or f"{fname or ''} {lname or ''}".strip() or "Walk-in"
        timeline.append({
            "type": "sale",
            "label": f"Sold {count} unit{'s' if count != 1 else ''}",
            "date": created_at.isoformat() if created_at else None,
            "detail": f"Invoice {inv_num} — {cust_name}",
            "count": count,
        })

    # --- Transfers: aggregate by transfer order ---
    transfers = db.query(
        models.TransferOrder.id,
        models.TransferOrder.created_at,
        models.TransferOrder.source_location_id,
        models.TransferOrder.destination_location_id,
        models.TransferOrder.status,
        func.count(models.DeviceInventory.imei)
    ).join(
        models.DeviceInventory,
        models.DeviceInventory.assigned_transfer_order_id == models.TransferOrder.id
    ).filter(
        models.DeviceInventory.model_number == model_number,
        models.DeviceInventory.org_id == org_id,
        models.TransferOrder.status.in_(["In_Transit", "Received", "Draft"])
    ).group_by(
        models.TransferOrder.id,
        models.TransferOrder.created_at,
        models.TransferOrder.source_location_id,
        models.TransferOrder.destination_location_id,
        models.TransferOrder.status,
    ).order_by(models.TransferOrder.created_at.desc()).limit(15).all()

    src_names = {}
    dst_names = {}
    for to_id, created_at, src, dst, status, count in transfers:
        if src and src not in src_names:
            sl = db.query(models.StoreLocation).filter(models.StoreLocation.id == src).first()
            src_names[src] = sl.name if sl else src
        if dst and dst not in dst_names:
            sl = db.query(models.StoreLocation).filter(models.StoreLocation.id == dst).first()
            dst_names[dst] = sl.name if sl else dst
        from_name = src_names.get(src, src) if src else "—"
        to_name = dst_names.get(dst, dst) if dst else "—"
        status_label = status.replace("_", " ").title() if status else ""
        timeline.append({
            "type": "transfer",
            "label": f"Transfer {to_id}",
            "date": created_at.isoformat() if created_at else None,
            "detail": f"{from_name} → {to_name} · {count} unit{'s' if count != 1 else ''} · {status_label}",
            "count": count,
        })

    # --- Notes updates: aggregate by date ---
    notes_dates = db.query(
        cast(models.DeviceHistoryLog.timestamp, Date),
        func.count(func.distinct(models.DeviceHistoryLog.imei))
    ).join(
        models.DeviceInventory,
        models.DeviceHistoryLog.imei == models.DeviceInventory.imei
    ).filter(
        models.DeviceInventory.model_number == model_number,
        models.DeviceInventory.org_id == org_id,
        models.DeviceHistoryLog.action_type == "Notes Updated"
    ).group_by(
        cast(models.DeviceHistoryLog.timestamp, Date)
    ).order_by(
        cast(models.DeviceHistoryLog.timestamp, Date).desc()
    ).limit(5).all()
    for date_val, count in notes_dates:
        timeline.append({
            "type": "notes",
            "label": f"Notes updated on {count} device{'s' if count != 1 else ''}",
            "date": date_val.isoformat() if date_val else None,
            "count": count,
        })

    # Sort timeline by date descending
    timeline.sort(key=lambda e: e.get("date") or "", reverse=True)

    # Total ever registered
    total_ever = db.query(func.count(func.distinct(models.DeviceInventory.imei))).filter(
        models.DeviceInventory.model_number == model_number,
        models.DeviceInventory.org_id == org_id,
    ).scalar() or 0

    return {
        "model_number": model_number,
        "total_ever_registered": total_ever,
        "currently_in_stock": total_in_stock,
        "available_sellable": available,
        "sold": sold,
        "scrapped": scrapped,
        "status_breakdown": status_counts,
        "store_breakdown": store_breakdown,
        "timeline": timeline,
    }


@router.get("/{model_number}", response_model=schemas.PhoneModelOut)
def get_model(
    model_number: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    db_model = db.query(models.PhoneModel).filter(
        models.PhoneModel.model_number == model_number,
        models.PhoneModel.org_id == getattr(current_user, 'current_org_id', None),
    ).first()
    if not db_model:
        raise HTTPException(status_code=404, detail="Model not found")
    return db_model


@router.post("/", response_model=schemas.PhoneModelOut)
def create_model(
    model: schemas.PhoneModelCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin"])),
):
    existing = db.query(models.PhoneModel).filter(
        models.PhoneModel.model_number == model.model_number,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Model with that number already exists")
    db_model = models.PhoneModel(**model.model_dump())
    db_model.org_id = getattr(current_user, 'current_org_id', None)
    db.add(db_model)
    try:
        db.commit()
        db.refresh(db_model)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to create model")
    return db_model


@router.put("/{model_number}", response_model=schemas.PhoneModelOut)
def update_model(
    model_number: str,
    model: schemas.PhoneModelCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin"])),
):
    db_model = db.query(models.PhoneModel).filter(
        models.PhoneModel.model_number == model_number,
        models.PhoneModel.org_id == getattr(current_user, 'current_org_id', None),
    ).first()
    if not db_model:
        raise HTTPException(status_code=404, detail="Model not found")
    db_model.brand = model.brand
    db_model.name = model.name
    db_model.color = model.color
    db_model.storage_gb = model.storage_gb
    # If model_number changed, check uniqueness
    if model.model_number != model_number:
        existing = db.query(models.PhoneModel).filter(
            models.PhoneModel.model_number == model.model_number,
            models.PhoneModel.model_number != model_number,
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Target model number already exists")
        db_model.model_number = model.model_number
    db.commit()
    db.refresh(db_model)
    return db_model


@router.delete("/{model_number}")
def delete_model(
    model_number: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin"])),
):
    db_model = db.query(models.PhoneModel).filter(
        models.PhoneModel.model_number == model_number,
        models.PhoneModel.org_id == getattr(current_user, 'current_org_id', None),
    ).first()
    if not db_model:
        raise HTTPException(status_code=404, detail="Model not found")
    device_count = db.query(models.DeviceInventory).filter(
        models.DeviceInventory.model_number == model_number,
    ).count()
    if device_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete: {device_count} devices reference this model")
    db.delete(db_model)
    db.commit()
    return {"status": "deleted"}


# ── Helper: reconstruct model_number from device column ─────────────────────

KNOWN_BRANDS = ["Apple", "Samsung", "Motorola", "Google", "OnePlus", "Nokia", "Xiaomi", "Oppo", "Huawei", "LG", "Sony"]


def detect_brand_and_name(raw_name: str):
    name = raw_name.strip()
    for brand in KNOWN_BRANDS:
        prefix = brand + " "
        if name.lower().startswith(prefix.lower()):
            return brand, name
    parts = name.split(" ", 1)
    if len(parts) == 2 and parts[0] in KNOWN_BRANDS:
        return parts[0], name
    return name, name


def infer_brand_from_model_number(mn: str) -> str:
    mn_lower = mn.lower()
    brand_keywords = {
        "Apple": ["iphone", "ipad", "macbook", "imac", "mac mini", "mac pro", "watch", "airpods"],
        "Samsung": ["galaxy", "z flip", "z fold"],
        "Motorola": ["moto", "razr"],
        "Google": ["pixel"],
    }
    for brand, keywords in brand_keywords.items():
        for kw in keywords:
            if kw in mn_lower:
                return brand
    return ""


def generate_model_number(display_name: str, storage_gb: int) -> str:
    if storage_gb > 0:
        return f"{display_name} - {storage_gb}GB"
    return display_name


@router.post("/sync-from-inventory")
def sync_catalog_from_inventory(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin"])),
):
    """Rebuild the catalog from existing device_inventory entries — fill in ANY missing or inconsistent model records."""
    org_id = getattr(current_user, 'current_org_id', None)
    devices = db.query(models.DeviceInventory).all()
    created = 0
    updated = 0

    for device in devices:
        if not device.model_number:
            continue
        mn = device.model_number

        # Check if a model record exists
        existing = db.query(models.PhoneModel).filter(
            models.PhoneModel.model_number == mn,
        ).first()

        if existing:
            # Update if brand/name is empty or looks wrong
            needs_fix = False
            if not existing.brand or not existing.name or existing.name != existing.model_number:
                needs_fix = True
            if needs_fix:
                brand = infer_brand_from_model_number(mn) or existing.brand or "Unknown"
                name = mn.split(" - ")[0] if " - " in mn else mn
                existing.brand = brand
                existing.name = name
                existing.org_id = org_id
                updated += 1
        else:
            brand = infer_brand_from_model_number(mn) or "Unknown"
            name = mn.split(" - ")[0] if " - " in mn else mn
            pm = models.PhoneModel(
                model_number=mn,
                brand=brand,
                name=name,
                storage_gb=0,
                org_id=org_id,
            )
            db.add(pm)
            created += 1

    db.commit()
    return {"created": created, "updated": updated, "message": f"Catalog synced: {created} created, {updated} updated"}
