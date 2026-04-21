from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Enum, func
from sqlalchemy.orm import relationship
import enum
from database import Base

class DeviceStatus(str, enum.Enum):
    Sellable = "Sellable"
    In_QC = "In_QC"
    In_Repair = "In_Repair"
    In_Transit = "In_Transit"
    Sold = "Sold"

class TransferType(str, enum.Enum):
    Restock = "Restock"
    Repair_Routing = "Repair_Routing"

class WholesaleCustomer(Base):
    __tablename__ = "wholesale_customers"
    crm_id = Column(String, primary_key=True, index=True)
    company_name = Column(String, nullable=False)
    tax_exempt_id = Column(String, nullable=True)
    pricing_tier = Column(Float, default=0.0)  # e.g., 0.15 for 15% off

class TransferOrder(Base):
    __tablename__ = "transfer_orders"
    id = Column(String, primary_key=True, index=True) # E.g., TO-12345
    transfer_type = Column(Enum(TransferType), nullable=False)
    destination_location_id = Column(String, nullable=False)
    created_at = Column(DateTime, default=func.now())
    status = Column(String, default="In_Transit") # In_Transit, Received

class DeviceInventory(Base):
    """
    Unified Device Inventory model replacing separate central/store tables.
    """
    __tablename__ = "device_inventory"
    
    imei = Column(String, primary_key=True, index=True)
    serial_number = Column(String, nullable=True)
    model_number = Column(String, ForeignKey("phone_models.model_number"))
    
    # Separation of location and status
    location_id = Column(String, index=True, nullable=False)  # "Warehouse_Alpha", "Store_B"
    sub_location_bin = Column(String, nullable=True)          # "Receiving_Bay", "QC_Station", "Main_Floor"
    device_status = Column(Enum(DeviceStatus), default=DeviceStatus.Sellable)
    
    # Financial and CRM associations
    cost_basis = Column(Float, nullable=False, default=0.0)
    assigned_transfer_order_id = Column(String, ForeignKey("transfer_orders.id"), nullable=True)
    sold_to_crm_id = Column(String, ForeignKey("wholesale_customers.crm_id"), nullable=True)
    
    received_date = Column(DateTime, default=func.now())
    
    # Relationships
    model = relationship("PhoneModel")
    transfer_order = relationship("TransferOrder")
    wholesale_customer = relationship("WholesaleCustomer")

# Assuming PhoneModel is still defined in models.py and we've imported it or it's registered in metadata
