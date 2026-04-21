import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "sql_app.db")

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # 1. Add assigned_technician_id if missing
        cursor.execute("PRAGMA table_info(device_inventory);")
        columns = [col[1] for col in cursor.fetchall()]
        if "assigned_technician_id" not in columns:
            cursor.execute("ALTER TABLE device_inventory ADD COLUMN assigned_technician_id VARCHAR;")
            
        # 2. Add new UnifiedCustomer fields dynamically
        cursor.execute("PRAGMA table_info(unified_customers);")
        u_columns = [col[1] for col in cursor.fetchall()]
        
        needed_columns = [
            ("first_name", "VARCHAR"),
            ("last_name", "VARCHAR"),
            ("company_name", "VARCHAR"),
            ("contact_person", "VARCHAR"),
            ("shipping_address", "VARCHAR"),
            ("is_active", "INTEGER DEFAULT 1"),
            ("tax_exempt_expiry", "DATETIME"),
            ("credit_limit", "FLOAT DEFAULT 0.0"),
            ("current_balance", "FLOAT DEFAULT 0.0"),
            ("payment_terms_days", "INTEGER DEFAULT 0")
        ]
        
        for p_name, p_type in needed_columns:
            if p_name not in u_columns:
                print(f"Adding {p_name} to unified_customers...")
                try:
                    cursor.execute(f"ALTER TABLE unified_customers ADD COLUMN {p_name} {p_type};")
                except Exception as e:
                    print(f"Issue adding {p_name}: {e}")

        # 3. Add warranty_expiry_date to device_inventory
        cursor.execute("PRAGMA table_info(device_inventory);")
        di_columns = [col[1] for col in cursor.fetchall()]
        if "warranty_expiry_date" not in di_columns:
            print("Adding warranty_expiry_date to device_inventory...")
            cursor.execute("ALTER TABLE device_inventory ADD COLUMN warranty_expiry_date DATETIME;")

        # 4. Add fulfillment to Invoices
        cursor.execute("PRAGMA table_info(invoices);")
        inv_columns = [col[1] for col in cursor.fetchall()]
        if "fulfillment_method" not in inv_columns:
            cursor.execute("ALTER TABLE invoices ADD COLUMN fulfillment_method VARCHAR DEFAULT 'Walk-in';")
        if "shipping_address" not in inv_columns:
            cursor.execute("ALTER TABLE invoices ADD COLUMN shipping_address VARCHAR;")
        if "status" not in inv_columns:
            cursor.execute("ALTER TABLE invoices ADD COLUMN status VARCHAR DEFAULT 'Unpaid';")
        if "is_estimate" not in inv_columns:
            cursor.execute("ALTER TABLE invoices ADD COLUMN is_estimate INTEGER DEFAULT 0;")
        if "due_date" not in inv_columns:
            cursor.execute("ALTER TABLE invoices ADD COLUMN due_date DATETIME;")

        # 5. Re-trigger creates for new tables safely
        from database import engine, Base
        import models
        Base.metadata.create_all(bind=engine)
        print("Ensured all newly generated tables exist via safe migration.")
        
        conn.commit()
    except Exception as e:
        print(f"Migration Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
