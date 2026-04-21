from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import inventory_router, models_router, transfers_router, auth_router, track_router, pos_router, reports_router, crm_router, parts_router, repair_router, import_router, admin_router
from db_sync import db_sync

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Mobile Store API")

@app.on_event("startup")
def on_startup():
    db_sync()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
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

@app.get("/")
def read_root():
    return {"message": "Welcome to the Mobile Store POS API"}
