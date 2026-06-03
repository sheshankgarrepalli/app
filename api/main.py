import os
import sys
import traceback as _traceback

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

from routers import (
    inventory_router, models_router, transfers_router,
    track_router, pos_router, reports_router, crm_router,
    parts_router, repair_router, import_router, admin_router,
    qc_router, consignment_router
)
try:
    from routers import po_router as _po
except:
    _po = None

from db_sync import db_sync

app = FastAPI(title="Mobile Store API")


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    if isinstance(exc, HTTPException):
        raise exc
    _traceback.print_exc()
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.on_event("startup")
def on_startup():
    try:
        Base.metadata.create_all(bind=engine)
    except Exception:
        pass
    try:
        db_sync()
    except Exception:
        pass


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(models_router.router)
app.include_router(inventory_router.router)
app.include_router(transfers_router.router)
app.include_router(track_router.router)
app.include_router(pos_router.router)
app.include_router(reports_router.router)
app.include_router(crm_router.router)
app.include_router(parts_router.router)
app.include_router(repair_router.router)
app.include_router(admin_router.router)
app.include_router(qc_router.router)
app.include_router(consignment_router.router)
app.include_router(import_router.router)
if _po is not None:
    app.include_router(_po.router)


@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "online", "database": "connected"}
    except Exception as e:
        return {"status": "offline", "error": str(e)}


@app.get("/")
def read_root():
    return {"message": "Welcome to the Mobile Store POS API"}
