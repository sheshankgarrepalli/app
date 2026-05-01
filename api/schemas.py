from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, date
from models import RoleEnum, DeviceStatus, TransferType, CustomerType, InvoiceStatus, RepairStatus, ManifestStatus, PaymentMethodEnum, PaymentStatus, RecurringFrequency, RecurringTemplateStatus

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
    model_config = {"extra": "ignore"}
    imei: str
    symptoms: Optional[str] = None
    notes: Optional[str] = None

class RepairTicketCreate(RepairTicketBase):
    pass

class RepairTicketUpdate(BaseModel):
    model_config = {"extra": "ignore"}
    status: Optional[RepairStatus] = None
    assigned_tech_id: Optional[str] = None
    symptoms: Optional[str] = None
    notes: Optional[str] = None

class RepairTicketOut(RepairTicketBase):
    id: int
    status: RepairStatus
    assigned_tech_id: Optional[str]
    device_model: Optional[str] = None
    device_status: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime]
    consumed_parts: List[dict] = []
    class Config: from_attributes = True

class RepairConsumePartRequest(BaseModel):
    part_sku: str
    qty: int = 1

class RepairCompleteRequest(BaseModel):
    imei: str
    work_completed: List[str] = []

class RepairScrapRequest(BaseModel):
    reason: str = ""

class RepairAssignRequest(BaseModel):
    technician_id: str

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

class PartCreateRequest(BaseModel):
    model_number: str
    category: str
    quality: str
    supplier_id: int
    qty: int
    total_price: float = 0.0
    shipping_fees: float = 0.0

class PartUpdateRequest(BaseModel):
    part_name: Optional[str] = None
    low_stock_threshold: Optional[int] = None

class PartIntakeRequest(BaseModel):
    qty: int
    supplier_id: int
    total_price: float
    shipping_fees: float = 0.0

class PartReturnRequest(BaseModel):
    qty: int
    reason: str = ""

class StockAdjustRequest(BaseModel):
    new_qty: int
    reason: str = ""

class PartDetailOut(PartsInventoryBase):
    created_at: datetime
    intakes: List[PartIntakeOut] = []
    total_valuation: float = 0.0
    class Config: from_attributes = True

class LaborRateConfigBase(BaseModel):
    action_name: str
    fee_amount: float

class LaborRateConfigCreate(LaborRateConfigBase): pass

class LaborRateConfigUpdate(BaseModel):
    fee_amount: float

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

class DeviceBulkCreate(BaseModel):
    imei: str
    model_number: Optional[str] = None
    serial_number: Optional[str] = None
    cost_basis: Optional[float] = 0.0
    is_hydrated: bool = False

class UserCreate(BaseModel):
    email: EmailStr
    role: RoleEnum
    store_id: Optional[str] = None

class UserOut(BaseModel):
    id: int
    email: str
    role: str
    store_id: Optional[str] = None
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
    model_number: Optional[str] = None
    cost_basis: Optional[float] = 0.0

class FastReceiveRequest(BaseModel):
    inventory: InventoryCreateItem
    phone_model: Optional[PhoneModelCreate] = None
    location_id: str = "Warehouse_Alpha"

class ManualDeviceIntakeRow(BaseModel):
    imei: str
    serial_number: Optional[str] = None
    model_number: Optional[str] = None
    condition: Optional[str] = None
    acquisition_cost: Optional[float] = 0.0

class BatchManualIntakeRequest(BaseModel):
    devices: List[ManualDeviceIntakeRow]

class DeviceInventoryOut(BaseModel):
    imei: str
    serial_number: Optional[str]
    model_number: Optional[str]
    location_id: str
    sub_location_bin: Optional[str]
    device_status: Optional[DeviceStatus]
    assigned_technician_id: Optional[str]
    cost_basis: float
    received_date: datetime
    model: Optional[PhoneModelOut]
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

class TransferDispatchRequest(BaseModel):
    imeis: List[str]
    destination: str
    courier_name: Optional[str] = None
    origin: Optional[str] = "Store_A" # Default or can be dynamic from context

class ManifestItemOut(BaseModel):
    imei: str
    class Config: from_attributes = True

class TransferManifestOut(BaseModel):
    manifest_id: str
    origin_id: str
    destination_id: str
    courier_name: Optional[str]
    status: ManifestStatus
    created_at: datetime
    updated_at: datetime
    items: List[ManifestItemOut]
    class Config: from_attributes = True

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
    tax_exempt_expiry: Optional[date] = None
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

class PaymentSchema(BaseModel):
    amount: float
    payment_method: PaymentMethodEnum
    reference_id: Optional[str] = None

class PaymentTransactionOut(PaymentSchema):
    id: str
    invoice_id: int
    timestamp: datetime
    class Config: from_attributes = True

class InvoiceItemCreate(BaseModel):
    imei: str
    unit_price: float

class RetailCheckoutRequest(BaseModel):
    customer_id: Optional[str] = None
    customer: Optional[UnifiedCustomerCreate] = None
    items: List[InvoiceItemCreate]
    tax_percent: float = 8.5
    fulfillment_method: Optional[str] = "Walk-in"
    shipping_address: Optional[str] = None
    payments: List[PaymentSchema]

class InvoiceCreate(BaseModel):
    customer_id: Optional[str] = None
    customer: Optional[UnifiedCustomerCreate] = None
    items: List[InvoiceItemCreate]
    tax_percent: float = 8.5
    fulfillment_method: Optional[str] = "Walk-in"
    shipping_address: Optional[str] = None
    status: Optional[InvoiceStatus] = InvoiceStatus.Unpaid
    payment_status: Optional[PaymentStatus] = PaymentStatus.Unpaid
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
    payment_status: PaymentStatus
    is_estimate: int
    due_date: Optional[datetime]
    sent_at: Optional[datetime] = None
    viewed_at: Optional[datetime] = None
    emailed_at: Optional[datetime] = None
    message_on_invoice: Optional[str] = None
    statement_memo: Optional[str] = None
    discount_percent: float = 0.0
    discount_amount: float = 0.0
    created_at: datetime
    items: List[InvoiceItemCreate]
    customer: Optional[UnifiedCustomerOut]
    payments: List[PaymentTransactionOut] = []
    invoice_terms: Optional[str] = None
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

class PricingConfigBase(BaseModel):
    pricing_tier: float = 0.0
    applies_to: str = "Both"
    default_markup_percent: float = 20.0

class PricingConfigCreate(PricingConfigBase): pass

class PricingConfigUpdate(BaseModel):
    pricing_tier: Optional[float] = None
    applies_to: Optional[str] = None
    default_markup_percent: Optional[float] = None

class PricingConfigOut(PricingConfigBase):
    id: int
    org_id: Optional[str] = None
    class Config: from_attributes = True

class StoreLocationBase(BaseModel):
    id: str
    name: str
    address: Optional[str] = None

class StoreLocationCreate(StoreLocationBase): pass

class StoreLocationOut(StoreLocationBase):
    class Config: from_attributes = True

class DeviceUpdateRequest(BaseModel):
    device_status: Optional[str] = None
    location_id: Optional[str] = None
    sub_location_bin: Optional[str] = None
    notes: Optional[str] = None

class DeviceTransitionRequest(BaseModel):
    target: str
    location_id: Optional[str] = None
    sub_location_bin: Optional[str] = None
    notes: Optional[str] = None
    technician_id: Optional[str] = None
    transfer_id: Optional[str] = None
    defects: Optional[List[str]] = None

class DeviceTransitionOut(BaseModel):
    success: bool
    new_status: str
    ticket_id: Optional[int] = None
    transfer_id: Optional[str] = None
    errors: List[str] = []

class OrgSettingsRequest(BaseModel):
    default_tax_rate: Optional[float] = None
    currency: Optional[str] = None
    timezone: Optional[str] = None
    invoice_terms: Optional[str] = None
    logo_url: Optional[str] = None
    invoice_template: Optional[str] = None
    primary_color: Optional[str] = None
    email_template_body: Optional[str] = None
    reminder_template_body: Optional[str] = None

class OrgSettingsOut(BaseModel):
    org_id: str
    default_tax_rate: float
    currency: str
    timezone: str
    invoice_terms: str
    logo_url: Optional[str] = None
    invoice_template: str = "modern"
    primary_color: str = "#e94560"
    email_template_body: Optional[str] = None
    reminder_template_body: Optional[str] = None
    class Config: from_attributes = True

# ── Phase 2: Invoice Form Schemas ──────────────────────────────────────────

class InvoiceFormItemCreate(BaseModel):
    """A single line item in the structured invoice form."""
    model_number: Optional[str] = None
    imei: Optional[str] = None
    description: Optional[str] = None
    qty: int = 1
    rate: float = 0.0
    taxable: bool = True

class InvoiceFormCreate(BaseModel):
    """Create an invoice from structured form data (not barcode scan)."""
    customer_id: Optional[str] = None
    customer: Optional[UnifiedCustomerCreate] = None
    items: List[InvoiceFormItemCreate]
    invoice_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    terms: Optional[str] = "Due on Receipt"
    message_on_invoice: Optional[str] = None
    statement_memo: Optional[str] = None
    discount_percent: Optional[float] = 0.0
    discount_amount: Optional[float] = 0.0
    tax_percent: Optional[float] = 8.5
    fulfillment_method: Optional[str] = "Walk-in"
    shipping_address: Optional[str] = None
    payments: List[PaymentSchema] = []

class InvoiceUpdate(BaseModel):
    """Update mutable invoice fields (only Draft/Unpaid)."""
    customer_id: Optional[str] = None
    invoice_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    terms: Optional[str] = None
    message_on_invoice: Optional[str] = None
    statement_memo: Optional[str] = None
    discount_percent: Optional[float] = None
    discount_amount: Optional[float] = None
    fulfillment_method: Optional[str] = None
    shipping_address: Optional[str] = None

class BatchInvoiceCreate(BaseModel):
    """Create up to 50 invoices at once."""
    invoices: List[InvoiceFormCreate]

class BatchActionRequest(BaseModel):
    """List of invoice IDs for batch operations."""
    invoice_ids: List[int]

class EstimateStatusRequest(BaseModel):
    """Mark estimate as sent/accepted/declined."""
    notes: Optional[str] = None

class ProgressInvoiceRequest(BaseModel):
    """Create a partial invoice against an estimate."""
    items: List[InvoiceFormItemCreate]
    payments: List[PaymentSchema] = []
    notes: Optional[str] = None

# ── Recurring Invoice Schemas ──────────────────────────────────────────────

class RecurringInvoiceTemplateCreate(BaseModel):
    customer_id: str
    frequency: RecurringFrequency
    interval_value: int = 1
    next_run_date: datetime
    end_date: Optional[datetime] = None
    auto_send: bool = False
    line_items: str  # JSON array string
    terms: str = "Due on Receipt"
    message_on_invoice: Optional[str] = None

class RecurringInvoiceTemplateUpdate(BaseModel):
    customer_id: Optional[str] = None
    frequency: Optional[RecurringFrequency] = None
    interval_value: Optional[int] = None
    next_run_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    auto_send: Optional[bool] = None
    line_items: Optional[str] = None
    terms: Optional[str] = None
    message_on_invoice: Optional[str] = None

class RecurringInvoiceTemplateOut(BaseModel):
    id: int
    org_id: Optional[str] = None
    customer_id: str
    frequency: RecurringFrequency
    interval_value: int
    next_run_date: datetime
    end_date: Optional[datetime] = None
    auto_send: bool
    status: RecurringTemplateStatus
    line_items: str
    terms: str
    message_on_invoice: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    class Config: from_attributes = True

class RecurringInvoiceLogOut(BaseModel):
    id: int
    org_id: Optional[str] = None
    template_id: int
    executed_at: datetime
    resulting_invoice_id: Optional[int] = None
    status: str
    error_message: Optional[str] = None
    class Config: from_attributes = True

class SchedulerRunResult(BaseModel):
    templates_checked: int
    invoices_created: int
    errors: List[str] = []
