import os
import sys

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

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Import routers one by one
failed = []
for mod_name in [
    "models_router","inventory_router","transfers_router","track_router",
    "pos_router","reports_router","crm_router","parts_router",
    "repair_router","import_router","admin_router","qc_router","consignment_router","po_router"
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
