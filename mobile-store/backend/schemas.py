from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from models import RoleEnum, DeviceStatus, TransferType, CustomerType, InvoiceStatus, RepairStatus

# --- ERP SCHEMAS ---

class PartsInventoryBase(BaseModel):
    sku: str
    part_name: str
    current_stock_qty: int = 0
    moving_average_cost: float = 0.0
    low_stock_threshold: int = 5

class PartsInventoryCreate(PartsInventoryBase): pass

class PartsInventoryOut(PartsInventoryBase):
    created_at: datetime
    class Config: from_attributes = True

class PartsIntakeRequest(BaseModel):
    sku: str
    part_name: Optional[str] = None
    qty_received: int
    total_price: float

class DeviceCostLedgerOut(BaseModel):
    id: int
    imei: str
    cost_type: str
    amount: float
    created_at: datetime
    class Config: from_attributes = True

class RepairMappingBase(BaseModel):
    device_model_number: str
    repair_category: str
    default_part_sku: str

class RepairMappingCreate(RepairMappingBase): pass

class RepairMappingOut(RepairMappingBase):
    id: int
    class Config: from_attributes = True

class RepairTicketBase(BaseModel):
    imei: str
    symptoms: Optional[str] = None
    notes: Optional[str] = None

class RepairTicketCreate(RepairTicketBase): pass

class RepairTicketOut(RepairTicketBase):
    id: int
    status: RepairStatus
    assigned_tech_id: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]
    class Config: from_attributes = True

class RepairCompleteRequest(BaseModel):
    imei: str
    work_completed: List[str] # List of repair categories

# --- NEW ERP SCHEMAS ---

class SupplierBase(BaseModel):
    name: str

class SupplierCreate(SupplierBase): pass

class SupplierOut(SupplierBase):
    id: int
    class Config: from_attributes = True

class PartIntakeBase(BaseModel):
    sku: str
    qty: int
    total_price: float = 0.0
    is_priced: int = 0
    supplier_id: int

class PartIntakeCreate(PartIntakeBase): pass

class PartIntakeOut(PartIntakeBase):
    id: int
    created_at: datetime
    class Config: from_attributes = True

class PartReceiveRequest(BaseModel):
    model_number: str
    category: str
    quality: str
    supplier_id: int
    qty: int

class PartPriceRequest(BaseModel):
    intake_id: int
    total_price: float
    shipping_fees: float = 0.0

class LaborRateConfigBase(BaseModel):
    action_name: str
    fee_amount: float

class LaborRateConfigCreate(LaborRateConfigBase): pass

class LaborRateConfigOut(LaborRateConfigBase):
    id: int
    class Config: from_attributes = True

class DeviceImportRow(BaseModel):
    imei: str
    model_number: str
    cost: float
    grade: str

class DeviceImportRequest(BaseModel):
    devices: List[DeviceImportRow]

class BulkRouteRequest(BaseModel):
    imeis: List[str]
    destination: str # Transit_to_Repair, Transit_to_Main_Bin, Transit_to_QC
    notes: str = ""
    defects: List[str] = []

class BulkReceiveRequest(BaseModel):
    imeis: List[str]
    notes: str = ""

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: RoleEnum

class UserOut(BaseModel):
    id: int
    email: EmailStr
    role: RoleEnum
    class Config: from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    store_id: Optional[str] = None

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[RoleEnum] = None
    store_id: Optional[str] = None

class PhoneModelBase(BaseModel):
    model_number: str
    brand: str
    name: str
    color: str
    storage_gb: int

class PhoneModelCreate(PhoneModelBase): pass

class PhoneModelOut(PhoneModelBase):
    class Config: from_attributes = True

class InventoryCreateItem(BaseModel):
    imei: str
    serial_number: Optional[str] = None
    model_number: str
    cost_basis: Optional[float] = 0.0

class FastReceiveRequest(BaseModel):
    inventory: InventoryCreateItem
    phone_model: Optional[PhoneModelCreate] = None
    location_id: str = "Warehouse_Alpha"

class ManualDeviceIntakeRow(BaseModel):
    imei: str
    serial_number: Optional[str] = None
    model_number: str
    condition: str
    acquisition_cost: float

class BatchManualIntakeRequest(BaseModel):
    devices: List[ManualDeviceIntakeRow]

class DeviceInventoryOut(BaseModel):
    imei: str
    serial_number: Optional[str]
    model_number: str
    location_id: str
    sub_location_bin: Optional[str]
    device_status: DeviceStatus
    assigned_technician_id: Optional[str]
    cost_basis: float
    received_date: datetime
    model: PhoneModelOut
    class Config: from_attributes = True

class DeviceHistoryLogOut(BaseModel):
    log_id: int
    imei: str
    timestamp: datetime
    action_type: str
    employee_id: str
    previous_status: Optional[str]
    new_status: str
    notes: Optional[str]
    class Config: from_attributes = True

class DeviceJourneyOut(BaseModel):
    device: DeviceInventoryOut
    timeline: List[DeviceHistoryLogOut]
    cost_ledger: List[DeviceCostLedgerOut] = []

class TransferOrderCreate(BaseModel):
    imei_list: List[str]
    destination_location_id: str
    transfer_type: str

class InternalRoutingRequest(BaseModel):
    new_bin: str
    new_status: str

class RepairAssignmentRequest(BaseModel):
    imei: str
    technician_id: str

class CustomerContactBase(BaseModel):
    name: str
    phone: Optional[str] = None
    is_authorized_buyer: int = 0

class CustomerContactCreate(CustomerContactBase): pass

class CustomerContactOut(CustomerContactBase):
    id: int
    customer_id: str
    class Config: from_attributes = True

class CustomerDocumentBase(BaseModel):
    document_type: str
    file_url: str
    expiry_date: Optional[datetime] = None

class CustomerDocumentCreate(CustomerDocumentBase): pass

class CustomerDocumentOut(CustomerDocumentBase):
    id: int
    customer_id: str
    class Config: from_attributes = True

class UnifiedCustomerCreate(BaseModel):
    customer_type: CustomerType
    name: Optional[str] = None # Deprecated
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company_name: Optional[str] = None
    contact_person: Optional[str] = None
    shipping_address: Optional[str] = None
    phone: str # Required now per user instructions
    email: Optional[str] = None
    tax_exempt_id: Optional[str] = None
    tax_exempt_expiry: Optional[datetime] = None
    pricing_tier: float = 0.0
    credit_limit: float = 0.0
    current_balance: float = 0.0
    payment_terms_days: int = 0
    notes: Optional[str] = None

class UnifiedCustomerOut(BaseModel):
    crm_id: str
    customer_type: CustomerType
    name: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    company_name: Optional[str]
    contact_person: Optional[str]
    shipping_address: Optional[str]
    phone: str
    email: Optional[str]
    tax_exempt_id: Optional[str]
    tax_exempt_expiry: Optional[datetime]
    pricing_tier: float
    credit_limit: float
    current_balance: float
    payment_terms_days: int
    notes: Optional[str]
    is_active: int
    contacts: List[CustomerContactOut] = []
    documents: List[CustomerDocumentOut] = []
    class Config: from_attributes = True

class UnifiedCustomerHistoryOut(BaseModel):
    customer: UnifiedCustomerOut
    purchased_devices: List[DeviceInventoryOut]
    lifetime_total_spent: float

class BulkCheckoutRequest(BaseModel):
    imei_list: List[str]
    crm_id: str
    fulfillment_method: Optional[str] = "Walk-in"
    shipping_address: Optional[str] = None
    payment_method: Optional[str] = "Cash" # New field: "Cash", "Credit Card", "On Terms"
    is_estimate: Optional[bool] = False
    upfront_payment: Optional[float] = 0.0

class RMARequest(BaseModel):
    customer_id: str
    imei_list: List[str]
    override_policy: Optional[bool] = False

class PaymentRecordBase(BaseModel):
    amount_paid: float
    payment_method: str
    date: Optional[datetime] = None

class PaymentRecordCreate(PaymentRecordBase):
    invoice_id: int

class PaymentRecordOut(PaymentRecordBase):
    id: int
    invoice_id: int
    class Config: from_attributes = True

class InvoiceItemCreate(BaseModel):
    imei: str
    unit_price: float

class InvoiceCreate(BaseModel):
    customer_id: Optional[str] = None
    customer: Optional[UnifiedCustomerCreate] = None
    items: List[InvoiceItemCreate]
    tax_percent: float = 8.5
    fulfillment_method: Optional[str] = "Walk-in"
    shipping_address: Optional[str] = None
    status: Optional[InvoiceStatus] = InvoiceStatus.Unpaid
    is_estimate: Optional[int] = 0

class InvoiceOut(BaseModel):
    id: int
    invoice_number: str
    store_id: str
    customer_id: Optional[str]
    subtotal: float
    tax_percent: float
    tax_amount: float
    total: float
    fulfillment_method: Optional[str]
    shipping_address: Optional[str]
    status: InvoiceStatus
    is_estimate: int
    due_date: Optional[datetime]
    created_at: datetime
    items: List[InvoiceItemCreate]
    customer: Optional[UnifiedCustomerOut]
    payments: List[PaymentRecordOut] = []
    class Config: from_attributes = True

class AuditReconciliationRequest(BaseModel):
    location_id: str
    scanned_imeis_list: List[str]

class AuditMissingDevice(BaseModel):
    imei: str
    last_employee: str
    last_action: str
    last_timestamp: datetime

class AuditReportResponse(BaseModel):
    matched: List[str]
    missing: List[AuditMissingDevice]
    unexpected: List[str]
    
class AuditFinalizeRequest(BaseModel):
    report: AuditReportResponse
    location_id: str

class StoreLocationBase(BaseModel):
    id: str
    name: str
    address: Optional[str] = None

class StoreLocationCreate(StoreLocationBase): pass

class StoreLocationOut(StoreLocationBase):
    class Config: from_attributes = True
