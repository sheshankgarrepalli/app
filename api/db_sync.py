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

def db_sync():
    # Ensure tables exist
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # ── Missing columns on existing tables ──

        # store_locations: org_id
        _safe_add_column(db, "store_locations", "org_id", "TEXT")

        # users: org_id, clerk_id
        _safe_add_column(db, "users", "org_id", "TEXT")
        _safe_add_column(db, "users", "clerk_id", "TEXT")
        _safe_add_column(db, "users", "store_id", "TEXT")

        # phone_models: org_id
        _safe_add_column(db, "phone_models", "org_id", "TEXT")

        # unified_customers: org_id
        _safe_add_column(db, "unified_customers", "org_id", "TEXT")

        # transfer_orders: org_id
        _safe_add_column(db, "transfer_orders", "org_id", "TEXT")

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

        # labor_rate_config: org_id
        _safe_add_column(db, "labor_rate_config", "org_id", "TEXT")

        # payment_transactions: org_id
        _safe_add_column(db, "payment_transactions", "org_id", "TEXT")

        # ── Ensure Default Store exists ──
        default_store_id = "Warehouse_Alpha"
        default_org_id = "org_3Com6Msekl6q0o4KuRxiKybuhTU"
        default_store = db.query(models.StoreLocation).filter(
            models.StoreLocation.id == default_store_id
        ).first()
        if not default_store:
            print(f"Creating default store: {default_store_id}")
            default_store = models.StoreLocation(
                id=default_store_id,
                name="Main Warehouse",
                org_id=default_org_id
            )
            db.add(default_store)
            db.commit()
            db.refresh(default_store)

        # ── Backfill null org_id values ──
        org_backfill_tables = [
            "store_locations", "users", "phone_models", "unified_customers",
            "transfer_orders", "device_inventory", "device_history_log",
            "invoices", "inventory_audits", "parts_inventory",
            "device_cost_ledger", "repair_tickets", "part_intakes",
            "labor_rate_config", "payment_transactions"
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
        devices_updated = db.query(models.DeviceInventory).filter(
            models.DeviceInventory.store_id == None
        ).update({models.DeviceInventory.store_id: default_store_id})
        print(f"Updated {devices_updated} devices to default store.")

        users_updated = db.query(models.User).filter(
            models.User.store_id == None
        ).update({models.User.store_id: default_store_id})
        print(f"Updated {users_updated} users to default store.")

        invoices_updated = db.query(models.Invoice).filter(
            models.Invoice.store_id == None
        ).update({models.Invoice.store_id: default_store_id})
        print(f"Updated {invoices_updated} invoices to default store.")

        db.commit()
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
