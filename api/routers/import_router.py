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

def slugify_name(name: str) -> str:
    """Turn model name into a safe slug: 'iPhone 14 Pro' -> 'iPhone14Pro'."""
    cleaned = re.sub(r'[^A-Za-z0-9 ]', '', name)
    return cleaned.replace(' ', '')

def generate_model_number(name: str, storage_gb: int) -> str:
    """Generate deterministic synthetic model_number: AAP-iPhone14Pro-128."""
    slug = slugify_name(name)
    return f"AAP-{slug}-{storage_gb}"

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
            location_id="Warehouse",
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
    # Bulk fetch existing IMEIs and model_numbers for fast validation
    all_imeis = [r.imei.strip() for r in req.rows if r.imei and r.imei.strip()]
    existing_imeis = set()
    if all_imeis:
        existing_imeis = {d[0] for d in db.query(DeviceInventory.imei).filter(DeviceInventory.imei.in_(all_imeis)).all()}

    model_numbers = [generate_model_number(r.model_name, parse_storage_gb(r.storage)) for r in req.rows]
    existing_models = set()
    if model_numbers:
        existing_models = {m[0] for m in db.query(PhoneModel.model_number).filter(PhoneModel.model_number.in_(model_numbers)).all()}

    results: List[PreviewRowResult] = []
    seen_imeis_in_batch = set()
    duplicate_imeis = 0
    new_models_set = set()

    for i, row in enumerate(req.rows):
        imei = (row.imei or "").strip()
        storage_gb = parse_storage_gb(row.storage)
        mn = generate_model_number(row.model_name, storage_gb)
        errors = []

        if not imei:
            errors.append("IMEI is required")
        elif not re.match(r'^\d{15}$', imei):
            errors.append("IMEI must be exactly 15 digits")
        elif imei in existing_imeis or imei in seen_imeis_in_batch:
            errors.append("Duplicate IMEI")
            duplicate_imeis += 1

        if storage_gb == 0:
            errors.append("Could not parse storage")

        is_valid = len(errors) == 0
        model_exists = mn in existing_models

        if is_valid and not model_exists:
            new_models_set.add(mn)

        if imei:
            seen_imeis_in_batch.add(imei)

        results.append(PreviewRowResult(
            row_number=i + 1,
            model_name=row.model_name,
            storage_gb=storage_gb,
            imei=imei,
            is_valid=is_valid,
            error="; ".join(errors) if errors else None,
            model_exists=model_exists,
            generated_model_number=mn,
        ))

    summary = PreviewSummary(
        total=len(req.rows),
        valid=sum(1 for r in results if r.is_valid),
        duplicate_imeis=duplicate_imeis,
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
    # Admin can import anywhere; non-admin are locked to their assigned store
    if current_user.role.value == "admin":
        effective_location_id = req.location_id or current_user.store_id or "Warehouse A"
    else:
        effective_location_id = current_user.store_id or req.location_id

    # Double-check for duplicate IMEIs (race condition guard)
    all_imeis = [r.imei.strip() for r in req.rows]
    existing_imeis = set()
    if all_imeis:
        existing_imeis = {d[0] for d in db.query(DeviceInventory.imei).filter(DeviceInventory.imei.in_(all_imeis)).all()}
    if existing_imeis:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"IMEIs already exist: {', '.join(sorted(existing_imeis)[:5])}"
        )

    # Collect unique models to create
    models_to_create: dict[str, dict] = {}
    for row in req.rows:
        storage_gb = parse_storage_gb(row.storage)
        mn = generate_model_number(row.model_name, storage_gb)
        if mn not in models_to_create:
            models_to_create[mn] = {"name": row.model_name.strip(), "storage_gb": storage_gb}

    # Check which models already exist (idempotent)
    from_db = db.query(PhoneModel.model_number).filter(PhoneModel.model_number.in_(list(models_to_create.keys()))).all()
    existing_model_numbers = {m[0] for m in from_db}

    new_models_count = 0
    new_phone_models = []
    for mn, data in models_to_create.items():
        if mn not in existing_model_numbers:
            pm = PhoneModel(
                model_number=mn,
                brand="Apple",
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
    for row in req.rows:
        storage_gb = parse_storage_gb(row.storage)
        mn = generate_model_number(row.model_name, storage_gb)

        devices.append(DeviceInventory(
            imei=row.imei.strip(),
            model_number=mn,
            location_id=effective_location_id,
            device_status=req.device_status,
            store_id=effective_location_id,
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
            notes=f"Imported as {row.model_name} ({storage_gb}GB)",
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
