import sys
import os
import time

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine, Base
import models
from auth import get_password_hash

# Drop all tables first for a clean migration 
Base.metadata.drop_all(bind=engine)
# Recreate tables
Base.metadata.create_all(bind=engine)

def seed_db():
    db = SessionLocal()
    
    admin = models.User(email="admin@test.com", password_hash=get_password_hash("password"), role=models.RoleEnum.admin)
    store_a = models.User(email="store_a@test.com", password_hash=get_password_hash("password"), role=models.RoleEnum.store_a)
    store_b = models.User(email="store_b@test.com", password_hash=get_password_hash("password"), role=models.RoleEnum.store_b)
    store_c = models.User(email="store_c@test.com", password_hash=get_password_hash("password"), role=models.RoleEnum.store_c)
    
    # New Technician
    tech_1 = models.User(email="tech1@test.com", password_hash=get_password_hash("password"), role=models.RoleEnum.technician)
    tech_2 = models.User(email="tech2@test.com", password_hash=get_password_hash("password"), role=models.RoleEnum.technician)
    
    db.add_all([admin, store_a, store_b, store_c, tech_1, tech_2])
    
    m1 = models.PhoneModel(model_number="IPH14", brand="Apple", name="iPhone 14", color="Midnight", storage_gb=128)
    m2 = models.PhoneModel(model_number="IPH15", brand="Apple", name="iPhone 15", color="Blue", storage_gb=256)
    m3 = models.PhoneModel(model_number="SAM24", brand="Samsung", name="Galaxy S24", color="Black", storage_gb=256)
    
    db.add_all([m1, m2, m3])
    
    wholesale = models.UnifiedCustomer(
        crm_id="B2B-1001",
        customer_type=models.CustomerType.Wholesale,
        company_name="Acme Wholesale",
        tax_exempt_id="TX-12345",
        pricing_tier=0.15 # 15% discount
    )
    db.add(wholesale)
    
    db.commit()
    print("Database wiping and seeding completed.")
    
if __name__ == "__main__":
    seed_db()
