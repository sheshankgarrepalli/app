from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import models, schemas, auth
from database import get_db
import uuid

router = APIRouter(prefix="/api/crm", tags=["crm"])

@router.get("/", response_model=List[schemas.UnifiedCustomerOut])
def get_all_customers(
    search: str = None,
    include_inactive: bool = False, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))
):
    query = db.query(models.UnifiedCustomer).filter(models.UnifiedCustomer.org_id == getattr(current_user, 'current_org_id', None))
    if not include_inactive:
        query = query.filter(models.UnifiedCustomer.is_active == 1)
    
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (models.UnifiedCustomer.name.ilike(search_filter)) |
            (models.UnifiedCustomer.company_name.ilike(search_filter)) |
            (models.UnifiedCustomer.first_name.ilike(search_filter)) |
            (models.UnifiedCustomer.last_name.ilike(search_filter)) |
            (models.UnifiedCustomer.phone.ilike(search_filter))
        )
        
    return query.limit(20).all()

@router.post("/", response_model=schemas.UnifiedCustomerOut)
def create_customer(customer: schemas.UnifiedCustomerCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))):
    crm_id = f"CRM-{uuid.uuid4().hex[:8].upper()}"
    customer_data = customer.model_dump()
    
    if not customer_data.get("name"):
        if customer_data.get("customer_type") == models.CustomerType.Wholesale:
            customer_data["name"] = customer_data.get("company_name") or "Unknown Company"
        else:
            first = customer_data.get("first_name") or ""
            last = customer_data.get("last_name") or ""
            customer_data["name"] = f"{first} {last}".strip() or "Unknown Customer"
            
    new_customer = models.UnifiedCustomer(crm_id=crm_id, org_id=getattr(current_user, 'current_org_id', None), **customer_data)
    new_customer.org_id = getattr(current_user, 'current_org_id', None)
    db.add(new_customer)
    db.commit()
    db.refresh(new_customer)
    return new_customer

@router.get("/{crm_id}/history", response_model=schemas.UnifiedCustomerHistoryOut)
def get_customer_history(crm_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))):
    customer = db.query(models.UnifiedCustomer).filter(
        models.UnifiedCustomer.crm_id == crm_id,
        models.UnifiedCustomer.org_id == getattr(current_user, 'current_org_id', None)
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    devices = db.query(models.DeviceInventory).filter(
        models.DeviceInventory.sold_to_crm_id == crm_id,
        models.DeviceInventory.org_id == getattr(current_user, 'current_org_id', None)
    ).all()
    
    invoices = db.query(models.Invoice).filter(
        models.Invoice.customer_id == crm_id,
        models.Invoice.org_id == getattr(current_user, 'current_org_id', None)
    ).all()
    lifetime_spent = sum(inv.total for inv in invoices)
    
    # We can also fetch repair tickets if implemented in the future.
    
    return {
        "customer": customer,
        "purchased_devices": devices,
        "lifetime_total_spent": lifetime_spent
    }

@router.put("/{crm_id}", response_model=schemas.UnifiedCustomerOut)
def update_customer(crm_id: str, customer_update: schemas.UnifiedCustomerCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role(["admin", "store_a", "store_b", "store_c"]))):
    customer = db.query(models.UnifiedCustomer).filter(
        models.UnifiedCustomer.crm_id == crm_id,
        models.UnifiedCustomer.org_id == getattr(current_user, 'current_org_id', None)
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    customer_data = customer_update.model_dump()
    if not customer_data.get("name"):
        if customer_data.get("customer_type") == models.CustomerType.Wholesale:
            customer_data["name"] = customer_data.get("company_name") or "Unknown Company"
        else:
            first = customer_data.get("first_name") or ""
            last = customer_data.get("last_name") or ""
            customer_data["name"] = f"{first} {last}".strip() or "Unknown Customer"
            
    for key, value in customer_data.items():
        setattr(customer, key, value)
        
    db.commit()
    db.refresh(customer)
    return customer

@router.delete("/{crm_id}")
def delete_customer(crm_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_role(["admin"]))):
    customer = db.query(models.UnifiedCustomer).filter(
        models.UnifiedCustomer.crm_id == crm_id,
        models.UnifiedCustomer.org_id == getattr(current_user, 'current_org_id', None)
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    customer.is_active = 0
    db.commit()
    return {"status": "deactivated"}
