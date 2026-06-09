from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import models, schemas, auth
from database import get_db

router = APIRouter(prefix="/api/services", tags=["services"])


@router.get("/", response_model=List[schemas.ServiceCatalogOut])
def list_services(
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    q = db.query(models.ServiceCatalog).filter(
        models.ServiceCatalog.org_id == getattr(current_user, 'current_org_id', None),
        models.ServiceCatalog.is_active == True,
    )
    if category:
        q = q.filter(models.ServiceCatalog.category == category)
    return q.order_by(models.ServiceCatalog.category, models.ServiceCatalog.name).all()


@router.get("/categories", response_model=List[str])
def list_categories(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    rows = db.query(models.ServiceCatalog.category).filter(
        models.ServiceCatalog.org_id == getattr(current_user, 'current_org_id', None),
        models.ServiceCatalog.is_active == True,
    ).distinct().order_by(models.ServiceCatalog.category).all()
    return [r[0] for r in rows if r[0]]


@router.post("/", response_model=schemas.ServiceCatalogOut)
def create_service(
    req: schemas.ServiceCatalogCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin"])),
):
    svc = models.ServiceCatalog(
        name=req.name,
        category=req.category,
        default_price=req.default_price,
        org_id=getattr(current_user, 'current_org_id', None),
    )
    db.add(svc)
    db.commit()
    db.refresh(svc)
    return svc


@router.put("/{service_id}", response_model=schemas.ServiceCatalogOut)
def update_service(
    service_id: int,
    req: schemas.ServiceCatalogUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin"])),
):
    svc = db.query(models.ServiceCatalog).filter(
        models.ServiceCatalog.id == service_id,
        models.ServiceCatalog.org_id == getattr(current_user, 'current_org_id', None),
    ).first()
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")
    if req.name is not None:
        svc.name = req.name
    if req.category is not None:
        svc.category = req.category
    if req.default_price is not None:
        svc.default_price = req.default_price
    if req.is_active is not None:
        svc.is_active = req.is_active
    db.commit()
    db.refresh(svc)
    return svc


@router.delete("/{service_id}")
def delete_service(
    service_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin"])),
):
    svc = db.query(models.ServiceCatalog).filter(
        models.ServiceCatalog.id == service_id,
        models.ServiceCatalog.org_id == getattr(current_user, 'current_org_id', None),
    ).first()
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")
    db.delete(svc)
    db.commit()
    return {"status": "deleted"}
