from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models

from sqlalchemy import text

def _safe_add_column(db: Session, table: str, column: str, col_type: str, default: str = None):
    """Add a column if it doesn't already exist. Works on PostgreSQL."""
    try:
        sql = f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"
        if default is not None:
            sql += f" DEFAULT {default}"
        db.execute(text(sql))
        db.commit()
        print(f"Added column {column} to {table}")
    except Exception:
        db.rollback()

def _safe_add_enum_value(db: Session, enum_type: str, value: str):
    """Add a value to a PostgreSQL enum type if it doesn't already exist."""
    try:
        db.execute(text(f"ALTER TYPE {enum_type} ADD VALUE '{value}'"))
        db.commit()
        print(f"Added value '{value}' to enum type {enum_type}")
    except Exception:
        db.rollback()

def db_sync():
    # Ensure tables exist
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # ── Missing columns on existing tables ──

        # store_locations: org_id
        _safe_add_column(db, "store_locations", "org_id", "TEXT")

        # users: org_id, clerk_id, password_hash, is_active, created_at, last_login_at
        _safe_add_column(db, "users", "org_id", "TEXT")
        _safe_add_column(db, "users", "clerk_id", "TEXT")
        _safe_add_column(db, "users", "store_id", "TEXT")
        _safe_add_column(db, "users", "password_hash", "TEXT")
        _safe_add_column(db, "users", "is_active", "BOOLEAN DEFAULT TRUE")
        _safe_add_column(db, "users", "created_at", "TIMESTAMP DEFAULT NOW()")
        _safe_add_column(db, "users", "last_login_at", "TIMESTAMP")

        # phone_models: org_id
        _safe_add_column(db, "phone_models", "org_id", "TEXT")

        # unified_customers: org_id
        _safe_add_column(db, "unified_customers", "org_id", "TEXT")

        # transfer_orders: org_id
        _safe_add_column(db, "transfer_orders", "org_id", "TEXT")
        _safe_add_column(db, "transfer_orders", "source_location_id", "TEXT")
        _safe_add_column(db, "transfer_orders", "notes", "TEXT")
        _safe_add_column(db, "transfer_orders", "created_by_email", "TEXT")

        # store_locations: location_type
        _safe_add_column(db, "store_locations", "location_type", "TEXT", "'retail'")

        # transfer_manifests: org_id (table may not exist yet after create_all)
        _safe_add_column(db, "transfer_manifests", "org_id", "TEXT")

        # device_inventory: org_id, store_id, is_hydrated
        _safe_add_column(db, "device_inventory", "org_id", "TEXT")
        _safe_add_column(db, "device_inventory", "store_id", "TEXT")
        _safe_add_column(db, "device_inventory", "is_hydrated", "BOOLEAN DEFAULT FALSE")

        # device_history_log: org_id
        _safe_add_column(db, "device_history_log", "org_id", "TEXT")

        # invoices: org_id, store_id, payment_status
        _safe_add_column(db, "invoices", "org_id", "TEXT")
        _safe_add_column(db, "invoices", "store_id", "TEXT")
        _safe_add_column(db, "invoices", "payment_status", "TEXT")
        _safe_add_column(db, "invoices", "discount_total", "FLOAT", "0.0")
        _safe_add_column(db, "invoices", "currency", "TEXT", "'USD'")

        # inventory_audits: org_id, store_id
        _safe_add_column(db, "inventory_audits", "org_id", "TEXT")
        _safe_add_column(db, "inventory_audits", "store_id", "TEXT")

        # parts_inventory: org_id
        _safe_add_column(db, "parts_inventory", "org_id", "TEXT")

        # device_cost_ledger: org_id
        _safe_add_column(db, "device_cost_ledger", "org_id", "TEXT")

        # repair_tickets: org_id
        _safe_add_column(db, "repair_tickets", "org_id", "TEXT")

        # part_intakes: org_id
        _safe_add_column(db, "part_intakes", "org_id", "TEXT")
        _safe_add_column(db, "purchase_orders", "org_id", "TEXT")
        _safe_add_column(db, "po_items", "org_id", "TEXT")
        _safe_add_column(db, "suppliers", "contact_email", "TEXT")
        _safe_add_column(db, "suppliers", "contact_phone", "TEXT")
        _safe_add_column(db, "suppliers", "payment_terms", "TEXT", "'Net 30'")
        _safe_add_column(db, "suppliers", "lead_time_days", "INTEGER", "7")
        _safe_add_column(db, "suppliers", "notes", "TEXT")
        _safe_add_column(db, "suppliers", "is_active", "INTEGER", "1")
        _safe_add_column(db, "invoice_items", "unit_cost", "FLOAT", "0.0")
        _safe_add_column(db, "device_inventory", "device_type", "TEXT")
        _safe_add_column(db, "invoices", "created_by_email", "TEXT")

        # labor_rate_config: org_id
        _safe_add_column(db, "labor_rate_config", "org_id", "TEXT")

        # payment_transactions: org_id
        _safe_add_column(db, "payment_transactions", "org_id", "TEXT")

        # ── Missing columns from CRM/consignment feature ──
        _safe_add_column(db, "unified_customers", "wholesale_subtype", "VARCHAR")
        _safe_add_column(db, "unified_customers", "default_consignment_days", "INTEGER", "15")

        _safe_add_column(db, "invoices", "sent_at", "TIMESTAMP")
        _safe_add_column(db, "invoices", "viewed_at", "TIMESTAMP")
        _safe_add_column(db, "invoices", "emailed_at", "TIMESTAMP")
        _safe_add_column(db, "invoices", "message_on_invoice", "TEXT")
        _safe_add_column(db, "invoices", "statement_memo", "TEXT")
        _safe_add_column(db, "invoices", "discount_percent", "FLOAT", "0.0")
        _safe_add_column(db, "invoices", "discount_amount", "FLOAT", "0.0")
        _safe_add_column(db, "invoices", "share_token", "TEXT")
        _safe_add_column(db, "invoices", "internal_notes", "TEXT")

        _safe_add_column(db, "organization_settings", "logo_url", "TEXT")
        _safe_add_column(db, "organization_settings", "invoice_template", "TEXT", "'modern'")
        _safe_add_column(db, "organization_settings", "primary_color", "TEXT", "'#e94560'")
        _safe_add_column(db, "organization_settings", "email_template_body", "TEXT")
        _safe_add_column(db, "organization_settings", "reminder_template_body", "TEXT")

        _safe_add_column(db, "invoice_items", "org_id", "TEXT")
        _safe_add_column(db, "invoice_items", "description", "TEXT")
        _safe_add_column(db, "invoice_items", "quantity", "INTEGER", "1")
        _safe_add_column(db, "invoice_items", "rate", "FLOAT", "0.0")
        _safe_add_column(db, "invoice_items", "amount", "FLOAT", "0.0")
        _safe_add_column(db, "invoice_items", "taxable", "BOOLEAN DEFAULT TRUE")
        _safe_add_column(db, "invoice_items", "product_source", "TEXT")
        _safe_add_column(db, "invoice_items", "sku", "TEXT")
        _safe_add_column(db, "invoice_items", "batch_serial", "TEXT")
        _safe_add_column(db, "invoice_items", "item_discount_amount", "FLOAT", "0.0")
        _safe_add_column(db, "invoice_items", "item_discount_percent", "FLOAT", "0.0")
        _safe_add_column(db, "store_locations", "invoice_prefix", "TEXT")
        _safe_add_column(db, "store_locations", "tax_rate", "FLOAT", "8.25")
        _safe_add_column(db, "store_locations", "manifest_items", "org_id", "TEXT")

        # ── Ensure PostgreSQL enum types have all values ──
        _safe_add_enum_value(db, "devicestatus", "Pending_Acknowledgment")
        _safe_add_enum_value(db, "devicestatus", "Reserved_Layaway")
        _safe_add_enum_value(db, "devicestatus", "Scrapped")
        _safe_add_enum_value(db, "devicestatus", "Awaiting_Parts")
        _safe_add_enum_value(db, "devicestatus", "On_Consignment")
        _safe_add_enum_value(db, "repairstatus", "Awaiting_Parts")
        _safe_add_enum_value(db, "roleenum", "warehouse")

        # ── Ensure Default Store exists ──
        default_store_id = "warehouse"
        default_org_id = "org_3Com6Msekl6q0o4KuRxiKybuhTU"
        default_store = db.query(models.StoreLocation).filter(
            models.StoreLocation.id == default_store_id
        ).first()
        if not default_store:
            print(f"Creating default store: {default_store_id}")
            default_store = models.StoreLocation(
                id=default_store_id,
                name="Warehouse",
                org_id=default_org_id,
                location_type=models.LocationType.warehouse
            )
            db.add(default_store)
            db.commit()
            db.refresh(default_store)

        # ── Location migration: remap old IDs → new IDs ──
        location_remap = {
            "Warehouse_Alpha": "warehouse",
            "Store_A": "grand-prairie",
            "Store_B": "foodland",
            "Store_C": "fiesta",
        }
        location_type_map = {
            "Warehouse_Alpha": "warehouse",
            "warehouse": "warehouse",
            "Store_A": "retail",
            "Store_B": "retail",
            "Store_C": "retail",
            "grand-prairie": "retail",
            "foodland": "retail",
            "fiesta": "retail",
        }

        # Update store_locations table
        for old_id, new_id in location_remap.items():
            existing = db.query(models.StoreLocation).filter(
                models.StoreLocation.id == old_id
            ).first()
            if existing:
                # Check if new_id already exists (from a previous partial migration)
                new_exists = db.query(models.StoreLocation).filter(
                    models.StoreLocation.id == new_id
                ).first()
                if new_exists and new_id != old_id:
                    # Merge: update referencing tables to point to new_id, then delete old
                    for table, col in [
                        ("users", "store_id"),
                        ("device_inventory", "store_id"),
                        ("device_inventory", "location_id"),
                        ("invoices", "store_id"),
                        ("inventory_audits", "store_id"),
                        ("transfer_orders", "destination_location_id"),
                        ("transfer_orders", "source_location_id"),
                        ("transfer_manifests", "origin_id"),
                        ("transfer_manifests", "destination_id"),
                    ]:
                        try:
                            db.execute(text(
                                f"UPDATE {table} SET {col} = :new WHERE {col} = :old"
                            ), {"new": new_id, "old": old_id})
                            db.commit()
                        except Exception:
                            db.rollback()
                    db.delete(existing)
                    db.commit()
                else:
                    # Rename the store location
                    existing.id = new_id
                    if existing.name in ("Main Warehouse", "Warehouse Alpha", "Warehouse"):
                        existing.name = "Warehouse"
                    elif existing.name in ("Store A", "Downtown Store", "Store A -- Downtown"):
                        existing.name = "Grand Prairie"
                    elif existing.name in ("Store B", "Eastside Store", "Store B -- Eastside"):
                        existing.name = "Foodland"
                    elif existing.name in ("Store C", "Westend Store", "Store C -- Westend"):
                        existing.name = "Fiesta"
                    lt_val = location_type_map.get(new_id, "retail")
                    if lt_val == "warehouse":
                        existing.location_type = models.LocationType.warehouse
                    else:
                        existing.location_type = models.LocationType.retail
                    db.commit()
                    print(f"Renamed store location {old_id} → {new_id}")

            # Also remap string values in non-FK columns (location_id on device_inventory is a string)
            for table, col in [
                ("device_inventory", "location_id"),
                ("device_inventory", "store_id"),
                ("users", "store_id"),
                ("invoices", "store_id"),
                ("inventory_audits", "store_id"),
                ("transfer_orders", "destination_location_id"),
                ("transfer_orders", "source_location_id"),
                ("transfer_manifests", "origin_id"),
                ("transfer_manifests", "destination_id"),
            ]:
                try:
                    result = db.execute(text(
                        f"UPDATE {table} SET {col} = :new WHERE {col} = :old"
                    ), {"new": new_id, "old": old_id})
                    if result.rowcount > 0:
                        print(f"  {table}.{col}: {old_id} → {new_id} ({result.rowcount} rows)")
                    db.commit()
                except Exception:
                    db.rollback()

        # ── Seed missing store locations ──
        seed_stores = [
            {"id": "warehouse", "name": "Warehouse", "type": models.LocationType.warehouse, "prefix": "WH"},
            {"id": "grand-prairie", "name": "Grand Prairie", "type": models.LocationType.retail, "prefix": "GP"},
            {"id": "foodland", "name": "Foodland", "type": models.LocationType.retail, "prefix": "FL"},
            {"id": "fiesta", "name": "Fiesta", "type": models.LocationType.retail, "prefix": "FS"},
        ]
        for store_def in seed_stores:
            existing = db.query(models.StoreLocation).filter(
                models.StoreLocation.id == store_def["id"]
            ).first()
            if not existing:
                print(f"Creating store: {store_def['id']} - {store_def['name']}")
                s = models.StoreLocation(
                    id=store_def["id"],
                    name=store_def["name"],
                    org_id=default_org_id,
                    location_type=store_def["type"],
                    invoice_prefix=store_def.get("prefix", "")
                )
                db.add(s)
                db.commit()

        # ── Backfill null org_id values ──
        org_backfill_tables = [
            "store_locations", "users", "phone_models", "unified_customers",
            "transfer_orders", "device_inventory", "device_history_log",
            "invoices", "inventory_audits", "parts_inventory",
            "device_cost_ledger", "repair_tickets", "part_intakes",
            "labor_rate_config", "payment_transactions", "admin_audit_log"
        ]
        for table_name in org_backfill_tables:
            try:
                result = db.execute(
                    text(f"UPDATE {table_name} SET org_id = :org WHERE org_id IS NULL"),
                    {"org": default_org_id}
                )
                if result.rowcount > 0:
                    print(f"Backfilled {result.rowcount} rows in {table_name} with org_id")
                db.commit()
            except Exception:
                db.rollback()

        # ── Backfill null store_id values ──
        fallback_store_id = "warehouse"
        devices_updated = db.query(models.DeviceInventory).filter(
            models.DeviceInventory.store_id == None
        ).update({models.DeviceInventory.store_id: fallback_store_id})
        print(f"Updated {devices_updated} devices to default store.")

        users_updated = db.query(models.User).filter(
            models.User.store_id == None
        ).update({models.User.store_id: fallback_store_id})
        print(f"Updated {users_updated} users to default store.")

        invoices_updated = db.query(models.Invoice).filter(
            models.Invoice.store_id == None
        ).update({models.Invoice.store_id: fallback_store_id})
        print(f"Updated {invoices_updated} invoices to default store.")

        db.commit()

        # ── Backfill discount_total from discount_amount ──
        try:
            result = db.execute(
                text("UPDATE invoices SET discount_total = discount_amount WHERE discount_total = 0 AND discount_amount != 0")
            )
            if result.rowcount > 0:
                print(f"Backfilled discount_total from discount_amount: {result.rowcount} rows")
            db.commit()
        except Exception:
            db.rollback()

        # ── Backfill invoice_prefix on existing stores ──
        prefix_map = {
            "warehouse": "WH",
            "grand-prairie": "GP",
            "foodland": "FL",
            "fiesta": "FS",
        }
        for sid, prefix in prefix_map.items():
            try:
                db.execute(
                    text("UPDATE store_locations SET invoice_prefix = :p WHERE id = :sid AND invoice_prefix IS NULL"),
                    {"p": prefix, "sid": sid}
                )
                db.commit()
            except Exception:
                db.rollback()

        print("Database sync complete.")
    except Exception as e:
        db.rollback()
        print(f"Database sync failed: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    db_sync()
