print("Importing database...")
from database import engine, Base
print("Importing models...")
import models
print("Running create_all...")
Base.metadata.create_all(bind=engine)
print("Importing routers...")
from routers import inventory_router, models_router, transfers_router, auth_router, track_router, pos_router, reports_router, crm_router, parts_router, repair_router, import_router, admin_router
print("Success!")
