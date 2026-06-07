from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import DeviceInventory, DeviceCatalog, DeviceCostLedger, User, PhoneModel, DeviceHistoryLog
from schemas import DeviceImportRequest, ExcelPreviewRequest, ExcelPreviewResponse, ExcelImportRequest, ExcelImportResponse, PreviewRowResult, PreviewSummary
from auth import get_current_user, require_role
from datetime import datetime
import re

router = APIRouter(prefix="/api/import", tags=["Import"])

# ── helpers ──────────────────────────────────────────────────────────────────

def parse_storage_gb(raw: str) -> int:
    """Parse storage string like '128GB', '256', '1TB' into integer GB."""
    raw = str(raw).strip().upper().replace(" ", "")
    if raw.endswith("TB"):
        try:
            return int(float(raw[:-2]) * 1024)
        except ValueError:
            return 0
    if raw.endswith("GB"):
        raw = raw[:-2]
    try:
        return int(float(raw))
    except ValueError:
        return 0


def generate_model_number(display_name: str, storage_gb: int) -> str:
    """Generate human-readable model_number. No storage suffix for devices with 0 GB."""
    if storage_gb > 0:
        return f"{display_name} - {storage_gb}GB"
    return display_name

KNOWN_BRANDS = ["Apple", "Samsung", "Motorola", "Google", "OnePlus", "Nokia", "Xiaomi", "Oppo", "Huawei", "LG", "Sony"]

def detect_brand_and_name(raw_name: str) -> tuple:
    """Detect brand from model name. Returns (brand, display_name)."""
    name = raw_name.strip()
    for brand in KNOWN_BRANDS:
        prefix = brand + " "
        if name.lower().startswith(prefix.lower()):
            return brand, name[len(prefix):].strip()
    parts = name.split(" ", 1)
    if len(parts) == 2:
        return parts[0], parts[1]
    return name, name

def detect_device_type(model_name: str) -> str:
    """Detect device type from model name. Returns DeviceType value string."""
    mn = model_name.lower()
    for keyword in ["watch", "airpods", "airtag", "homepod", "pencil", "magic keyboard",
                    "magic mouse", "trackpad", "airpods max", "beats"]:
        if keyword in mn:
            return "Watch" if "watch" in keyword else "Accessory"
    for keyword in ["ipad", "tab ", "tablet", "galaxy tab"]:
        if keyword in mn:
            return "Tablet"
    for keyword in ["macbook", "mac book", "imac", "mac mini", "mac pro"]:
        if keyword in mn:
            return "Laptop"
    for keyword in ["ps5", "playstation", "xbox", "nintendo", "switch", "steam deck"]:
        if keyword in mn:
            return "Console"
    for keyword in ["case", "screen protector", "charger", "cable", "adapter", "dock", "stand"]:
        if keyword in mn:
            return "Accessory"
    for keyword in ["pixel", "iphone", "galaxy", "oneplus", "xiaomi", "motorola", "nokia", "phone"]:
        if keyword in mn:
            return "Phone"
    return "Other"

def is_imei_valid(identifier: str, device_type: str) -> bool:
    """Validate identifier based on device type. IMEI must be 15 digits for phones."""
    if not identifier or not identifier.strip():
        return False
    if device_type == "Phone":
        return bool(re.match(r'^\d{15}$', identifier.strip()))
    return len(identifier.strip()) >= 4

# ── endpoints ────────────────────────────────────────────────────────────────

@router.post("/auction-devices")
def import_auction_devices(req: DeviceImportRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    success_count = 0
    failed_count = 0
    errors = []

    catalog = {c.model_number: c for c in db.query(DeviceCatalog).all()}
    existing_imeis = {d.imei for d in db.query(DeviceInventory.imei).all()}

    new_devices = []
    ledger_entries = []

    for row in req.devices:
        if row.imei in existing_imeis:
            failed_count += 1
            errors.append(f"IMEI {row.imei} already exists")
            continue

        spec = catalog.get(row.model_number)

        device = DeviceInventory(
            imei=row.imei,
            model_number=row.model_number,
            device_status="In_QC",
            location_id="warehouse",
            cost_basis=row.cost,
            org_id=getattr(current_user, 'current_org_id', None)
        )

        if not spec:
            errors.append(f"Model {row.model_number} not found in catalog - manual review required")

        new_devices.append(device)

        ledger_entry = DeviceCostLedger(
            imei=row.imei,
            cost_type="Base_Acquisition",
            amount=row.cost,
            org_id=getattr(current_user, 'current_org_id', None)
        )
        ledger_entries.append(ledger_entry)

        success_count += 1
        existing_imeis.add(row.imei)

    if new_devices:
        db.bulk_save_objects(new_devices)
        db.bulk_save_objects(ledger_entries)
        db.commit()

    return {
        "success_count": success_count,
        "failed_count": failed_count,
        "errors": errors
    }


@router.post("/excel-preview", response_model=ExcelPreviewResponse)
def excel_preview(req: ExcelPreviewRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Validate Excel rows and show what will be imported. Read-only, no side effects."""
    # Bulk fetch existing identifiers for fast validation
    all_identifiers = [r.imei.strip() for r in req.rows if r.imei and r.imei.strip()]
    existing_identifiers = set()
    if all_identifiers:
        all_rows = db.query(DeviceInventory.imei).filter(DeviceInventory.imei.in_(all_identifiers)).all()
        existing_identifiers = {d[0] for d in all_rows}

    results: List[PreviewRowResult] = []
    seen_in_batch = set()
    duplicate_count = 0
    new_models_set = set()

    # Pre-compute model numbers
    row_model_numbers = []
    for row in req.rows:
        storage_gb = parse_storage_gb(row.storage)
        _, display_name = detect_brand_and_name(row.model_name)
        mn = generate_model_number(display_name, storage_gb)
        row_model_numbers.append(mn)

    existing_models = set()
    if row_model_numbers:
        existing_models = {m[0] for m in db.query(PhoneModel.model_number).filter(PhoneModel.model_number.in_(row_model_numbers)).all()}

    for i, row in enumerate(req.rows):
        identifier = (row.imei or "").strip()
        storage_gb = parse_storage_gb(row.storage)
        mn = row_model_numbers[i]
        errors = []
        device_type = row.device_type or detect_device_type(row.model_name)

        if not identifier:
            errors.append("IMEI or Serial number is required")
        elif not is_imei_valid(identifier, device_type):
            if device_type == "Phone":
                errors.append("IMEI must be exactly 15 digits")
            else:
                errors.append("Serial number must be at least 4 characters")
        elif identifier in existing_identifiers or identifier in seen_in_batch:
            errors.append("Duplicate identifier")
            duplicate_count += 1

        # Storage is optional for Watches and Accessories
        no_storage_types = ("Watch", "Accessory")
        if device_type not in no_storage_types and storage_gb == 0:
            errors.append("Could not parse storage")

        is_valid = len(errors) == 0
        model_exists = mn in existing_models

        if is_valid and not model_exists:
            new_models_set.add(mn)

        if identifier:
            seen_in_batch.add(identifier)

        results.append(PreviewRowResult(
            row_number=i + 1,
            model_name=row.model_name,
            storage_gb=storage_gb,
            imei=identifier,
            is_valid=is_valid,
            error="; ".join(errors) if errors else None,
            model_exists=model_exists,
            generated_model_number=mn,
            detected_device_type=device_type,
        ))

    summary = PreviewSummary(
        total=len(req.rows),
        valid=sum(1 for r in results if r.is_valid),
        duplicate_imeis=duplicate_count,
        new_models=len(new_models_set),
    )

    return ExcelPreviewResponse(rows=results, summary=summary)


@router.post("/excel-import", response_model=ExcelImportResponse)
def excel_import(
    req: ExcelImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "store"]))
):
    """Import validated rows: create PhoneModels + DeviceInventory + history logs in one transaction."""
    org_id = getattr(current_user, 'current_org_id', None) or getattr(current_user, 'org_id', None)
    employee_id = current_user.email
    device_type_value = getattr(req, 'device_type', 'Phone') or 'Phone'
    # Admin can import anywhere; non-admin are locked to their assigned store
    if current_user.role.value == "admin":
        effective_location_id = req.location_id or current_user.store_id or "warehouse"
    else:
        effective_location_id = current_user.store_id or req.location_id

    # Detect device type per row + double-check for duplicate identifiers
    all_identifiers = [r.imei.strip() for r in req.rows]
    row_device_types = [detect_device_type(r.model_name) for r in req.rows]
    existing_ids = set()
    if all_identifiers:
        existing_ids = {d[0] for d in db.query(DeviceInventory.imei).filter(DeviceInventory.imei.in_(all_identifiers)).all()}
    if existing_ids:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Identifiers already exist: {', '.join(sorted(existing_ids)[:5])}"
        )

    # Collect unique models to create
    models_to_create: dict[str, dict] = {}
    for row in req.rows:
        storage_gb = parse_storage_gb(row.storage)
        brand, display_name = detect_brand_and_name(row.model_name)
        mn = generate_model_number(display_name, storage_gb)
        if mn not in models_to_create:
            models_to_create[mn] = {"brand": brand, "name": display_name, "storage_gb": storage_gb}

    # Check which models already exist (idempotent)
    from_db = db.query(PhoneModel.model_number).filter(PhoneModel.model_number.in_(list(models_to_create.keys()))).all()
    existing_model_numbers = {m[0] for m in from_db}

    new_models_count = 0
    new_phone_models = []
    for mn, data in models_to_create.items():
        if mn not in existing_model_numbers:
            pm = PhoneModel(
                model_number=mn,
                brand=data["brand"],
                name=data["name"],
                color=None,
                storage_gb=data["storage_gb"],
                org_id=org_id,
            )
            new_phone_models.append(pm)
            new_models_count += 1

    if new_phone_models:
        db.add_all(new_phone_models)
        db.flush()

    # Create device inventory entries
    now = datetime.utcnow()
    devices = []
    history_logs = []
    for i, row in enumerate(req.rows):
        storage_gb = parse_storage_gb(row.storage)
        _, display_name = detect_brand_and_name(row.model_name)
        mn = generate_model_number(display_name, storage_gb)
        dt = row_device_types[i]

        devices.append(DeviceInventory(
            imei=row.imei.strip(),
            serial_number=row.imei.strip() if dt != "Phone" else None,
            model_number=mn,
            location_id=effective_location_id,
            device_status=req.device_status,
            store_id=effective_location_id,
            device_type=dt,
            cost_basis=0.0,
            is_hydrated=True,
            received_date=now,
            org_id=org_id,
        ))

        history_logs.append(DeviceHistoryLog(
            imei=row.imei.strip(),
            timestamp=now,
            action_type="Excel Import",
            employee_id=employee_id,
            previous_status=None,
            new_status=req.device_status,
            notes=f"Imported as {row.model_name} ({storage_gb}GB) [{dt}]",
            org_id=org_id,
        ))

    if devices:
        db.add_all(devices)
        db.flush()

    if history_logs:
        db.add_all(history_logs)

    db.commit()

    return ExcelImportResponse(
        devices_imported=len(devices),
        new_models_created=new_models_count,
    )


@router.post("/seed-catalog")
def seed_catalog(db: Session = Depends(get_db)):
    seeds = [
        DeviceCatalog(model_number="A2848", brand="Apple", name="iPhone 15", storage="128GB", color="Black"),
        DeviceCatalog(model_number="A2651", brand="Apple", name="iPhone 14 Pro", storage="256GB", color="Deep Purple"),
        DeviceCatalog(model_number="A2633", brand="Apple", name="iPhone 13", storage="128GB", color="Blue"),
        DeviceCatalog(model_number="A2482", brand="Apple", name="iPhone 13 Pro", storage="128GB", color="Sierra Blue"),
        DeviceCatalog(model_number="A2341", brand="Apple", name="iPhone 12 Pro", storage="128GB", color="Pacific Blue"),
    ]

    for s in seeds:
        if not db.query(DeviceCatalog).filter(DeviceCatalog.model_number == s.model_number).first():
            db.add(s)

    db.commit()
    return {"status": "success", "message": "Catalog seeded"}
