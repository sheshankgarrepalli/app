import os
import sys
import secrets

api_dir = os.path.dirname(os.path.abspath(__file__))
if api_dir not in sys.path:
    sys.path.append(api_dir)

from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from database import engine, Base, get_db
from db_sync import db_sync
import models
from auth import hash_password

app = FastAPI(title="Mobile Store API")

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    if isinstance(exc, HTTPException): raise exc
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

@app.on_event("startup")
def on_startup():
    try: Base.metadata.create_all(bind=engine)
    except Exception as e: sys.stderr.write(f"create_all: {e}\n")
    try: db_sync()
    except Exception as e: sys.stderr.write(f"db_sync: {e}\n")
    try: seed_initial_admin()
    except Exception as e: sys.stderr.write(f"seed_admin: {e}\n")

def seed_initial_admin():
    """Ensure one canonical admin (admin@amafahelectronics.com) exists with a known password.
    Migrates legacy Clerk-ID users and removes duplicates."""
    from database import SessionLocal
    db = SessionLocal()
    try:
        admin_email = os.getenv("INITIAL_ADMIN_EMAIL", "admin@amafahelectronics.com")
        admin_password = os.getenv("INITIAL_ADMIN_PASSWORD") or secrets.token_urlsafe(12)
        password_printed = bool(os.getenv("INITIAL_ADMIN_PASSWORD"))

        # Find all existing admins
        all_admins = db.query(models.User).filter(models.User.role == models.RoleEnum.admin).order_by(models.User.id).all()

        # Case 1: No admin at all
        if not all_admins:
            user = models.User(
                email=admin_email,
                role=models.RoleEnum.admin,
                store_id="warehouse",
                password_hash=hash_password(admin_password),
                is_active=True,
            )
            db.add(user)
            db.commit()
            sys.stderr.write(
                f"\n{'='*60}\n"
                f"INITIAL ADMIN CREATED\n"
                f"  Email: {admin_email}\n"
                f"  Password: {admin_password}\n"
                f"  (Set INITIAL_ADMIN_PASSWORD env var to override)\n"
                f"{'='*60}\n\n"
            )
            return

        # Case 2: Find the canonical admin (the one with admin_email, or the first admin)
        canonical = None
        for admin in all_admins:
            if admin.email == admin_email:
                canonical = admin
                break
        if not canonical:
            canonical = all_admins[0]

        # If canonical has a Clerk-ID email, rename it
        if canonical.email and "@" not in canonical.email:
            # Check if another user already has the target email
            other = db.query(models.User).filter(models.User.email == admin_email, models.User.id != canonical.id).first()
            if other:
                db.delete(other)
                db.flush()
            canonical.email = admin_email

        # Set password if none, or if INITIAL_ADMIN_PASSWORD is explicitly set
        if not canonical.password_hash or password_printed:
            canonical.password_hash = hash_password(admin_password)

        canonical.is_active = True
        canonical.store_id = canonical.store_id or "warehouse"
        db.commit()

        if not password_printed:
            sys.stderr.write(
                f"\n{'='*60}\n"
                f"ADMIN READY\n"
                f"  Email: {canonical.email}\n"
                f"  Password: {admin_password}\n"
                f"  (Set INITIAL_ADMIN_PASSWORD env var to override)\n"
                f"{'='*60}\n\n"
            )

        # Case 3: Delete duplicate admins (other than canonical)
        duplicate_count = 0
        for admin in all_admins:
            if admin.id != canonical.id:
                db.delete(admin)
                duplicate_count += 1
        if duplicate_count:
            db.commit()
            sys.stderr.write(f"Cleaned up {duplicate_count} duplicate admin users\n")

        # Case 4: Delete legacy Clerk-ID users (no @ in email, no password)
        clerk_users = db.query(models.User).filter(
            models.User.email.contains("user_"),
            models.User.id != canonical.id,
        ).all()
        if clerk_users:
            for u in clerk_users:
                db.delete(u)
            db.commit()
            sys.stderr.write(f"Cleaned up {len(clerk_users)} legacy Clerk-ID users\n")

    finally:
        db.close()

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Import routers one by one
failed = []
for mod_name in [
    "models_router","inventory_router","transfers_router","track_router",
    "pos_router","reports_router","crm_router","parts_router",
    "repair_router","import_router","admin_router","qc_router","consignment_router","po_router","auth_router","services_router"
]:
    try:
        mod = __import__(f"routers.{mod_name}", fromlist=[mod_name])
        app.include_router(mod.router)
    except Exception as e:
        failed.append(f"{mod_name}: {e}")
        sys.stderr.write(f"ROUTER FAIL: {mod_name}: {e}\n")

@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    try: db.execute(text("SELECT 1")); return {"status":"online","failed_routers":failed}
    except Exception as e: return {"status":"offline","error":str(e)}

@app.get("/")
def root():
    return {"message":"Ready","failed_routers":failed}
