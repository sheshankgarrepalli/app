from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models

from sqlalchemy import text

def db_sync():
    # Ensure tables exist
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # 0. Raw SQL to add columns if they don't exist (SQLite safe-ish)
        tables_to_fix = [
            ("device_inventory", "store_id"),
            ("users", "store_id"),
            ("invoices", "store_id"),
            ("inventory_audits", "store_id")
        ]
        for table, column in tables_to_fix:
            try:
                db.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} TEXT"))
                db.commit()
                print(f"Added column {column} to table {table}")
            except Exception:
                db.rollback()
                # Column likely already exists

        # 1. Ensure Default Store exists
        default_store_id = "Warehouse_Alpha"
        default_store = db.query(models.StoreLocation).filter(models.StoreLocation.id == default_store_id).first()
        if not default_store:
            print(f"Creating default store: {default_store_id}")
            default_store = models.StoreLocation(id=default_store_id, name="Main Warehouse")
            db.add(default_store)
            db.commit()
            db.refresh(default_store)

        # 2. Reconcile Devices
        devices_updated = db.query(models.DeviceInventory).filter(models.DeviceInventory.store_id == None).update({models.DeviceInventory.store_id: default_store_id})
        print(f"Updated {devices_updated} devices to default store.")

        # 3. Reconcile Users
        users_updated = db.query(models.User).filter(models.User.store_id == None).update({models.User.store_id: default_store_id})
        print(f"Updated {users_updated} users to default store.")

        # 4. Reconcile Invoices
        invoices_updated = db.query(models.Invoice).filter(models.Invoice.store_id == None).update({models.Invoice.store_id: default_store_id})
        print(f"Updated {invoices_updated} invoices to default store.")

        db.commit()
        print("Database reconciliation complete.")
    except Exception as e:
        db.rollback()
        print(f"Database reconciliation failed: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    db_sync()
