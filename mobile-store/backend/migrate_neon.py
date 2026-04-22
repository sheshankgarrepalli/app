import os
from database import engine, Base
import models

print("Starting migration to Neon...")
try:
    Base.metadata.create_all(bind=engine)
    print("Migration successful! Tables created in Neon.")
except Exception as e:
    print(f"Migration failed: {str(e)}")
