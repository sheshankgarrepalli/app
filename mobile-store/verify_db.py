import sqlite3
import os

DB_PATH = os.path.join("backend", "sql_app.db")

def verify():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("--- Invoices Table ---")
    cursor.execute("PRAGMA table_info(invoices);")
    for col in cursor.fetchall():
        print(col[1], col[2])
        
    print("\n--- New Tables ---")
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [t[0] for t in cursor.fetchall()]
    print("payment_records exists:", "payment_records" in tables)
    
    if "payment_records" in tables:
        print("\n--- PaymentRecords Table ---")
        cursor.execute("PRAGMA table_info(payment_records);")
        for col in cursor.fetchall():
            print(col[1], col[2])
    
    conn.close()

if __name__ == "__main__":
    verify()
