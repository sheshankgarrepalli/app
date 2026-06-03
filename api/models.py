import enum
import uuid
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Enum, func, Boolean
from sqlalchemy.orm import relationship
from database import Base

class RoleEnum(str, enum.Enum):
    admin = "admin"
    warehouse = "warehouse"
    store = "store"
    technician = "technician"

class LocationType(str, enum.Enum):
    warehouse = "warehouse"
    retail = "retail"

class DeviceStatus(str, enum.Enum):
    Sellable = "Sellable"
    In_QC = "In_QC"
    In_Repair = "In_Repair"
    In_Transit = "In_Transit"
    Pending_Acknowledgment = "Pending_Acknowledgment"
    Sold = "Sold"
    Transit_to_Repair = "Transit_to_Repair"
    Transit_to_QC = "Transit_to_QC"
    Transit_to_Main_Bin = "Transit_to_Main_Bin"
    Reserved_Layaway = "Reserved_Layaway"
    Scrapped = "Scrapped"
    Awaiting_Parts = "Awaiting_Parts"
    On_Consignment = "On_Consignment"

class TransferType(str, enum.Enum):
    Restock = "Restock"
    Repair_Routing = "Repair_Routing"

class ManifestStatus(str, enum.Enum):
    Preparing = "Preparing"
    In_Transit = "In_Transit"
    Pending_Acknowledgment = "Pending_Acknowledgment"
    Completed = "Completed"

class CustomerType(str, enum.Enum):
    Retail = "Retail"
    Wholesale = "Wholesale"

class WholesaleSubtype(str, enum.Enum):
    Standard = "standard"
    Consignee = "consignee"

class ConsignmentBatchStatus(str, enum.Enum):
    Active = "active"
    Settled = "settled"

class ConsignmentItemOutcome(str, enum.Enum):
    Pending = "pending"
    Sold = "sold"
    Returned = "returned"

class StoreLocation(Base):
    __tablename__ = "store_locations"
    id = Column(String, primary_key=True, index=True) # e.g., "warehouse", "grand-prairie"
    org_id = Column(String, index=True, nullable=True)
    name = Column(String, nullable=False)
    address = Column(String, nullable=True)
    location_type = Column(Enum(LocationType), nullable=False, default=LocationType.retail)
    invoice_prefix = Column(String, nullable=True)  # e.g., "WH", "GP", "FL", "FS" for invoice numbering
    tax_rate = Column(Float, default=8.25)  # Texas base rate, override per store

class OrganizationSettings(Base):
    __tablename__ = "organization_settings"
    org_id = Column(String, primary_key=True, index=True)
    default_tax_rate = Column(Float, default=8.5)
    currency = Column(String, default="USD")
    timezone = Column(String, default="America/Chicago")
    invoice_terms = Column(String, default="All sales are final. 14-day warranty on defects. Layaway deposits are non-refundable.")
    logo_url = Column(String, nullable=True)
    invoice_template = Column(String, default="modern")
    primary_color = Column(String, default="#e94560")
    email_template_body = Column(String, nullable=True)
    reminder_template_body = Column(String, nullable=True)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    clerk_id = Column(String, unique=True, index=True, nullable=True)
    org_id = Column(String, index=True, nullable=True)
    email = Column(String, unique=True, index=True)
    role = Column(Enum(RoleEnum))
    store_id = Column(String, ForeignKey("store_locations.id"), nullable=True)
    
    store = relationship("StoreLocation")

class PhoneModel(Base):
    __tablename__ = "phone_models"
    model_number = Column(String, primary_key=True, index=True)
    org_id = Column(String, index=True, nullable=True)
    brand = Column(String)
    name = Column(String)
    color = Column(String)
    storage_gb = Column(Integer)

class UnifiedCustomer(Base):
    __tablename__ = "unified_customers"
    crm_id = Column(String, primary_key=True, index=True)
    org_id = Column(String, index=True, nullable=True)
    customer_type = Column(Enum(CustomerType), default=CustomerType.Retail)
    name = Column(String, nullable=True) # Deprecated legacy 
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    company_name = Column(String, nullable=True)
    contact_person = Column(String, nullable=True)
    shipping_address = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    tax_exempt_id = Column(String, nullable=True)
    tax_exempt_expiry = Column(DateTime, nullable=True)
    pricing_tier = Column(Float, default=0.0) 
    credit_limit = Column(Float, default=0.0)
    current_balance = Column(Float, default=0.0)
    payment_terms_days = Column(Integer, default=0)
    wholesale_subtype = Column(Enum(WholesaleSubtype), nullable=True)
    default_consignment_days = Column(Integer, default=15)
    notes = Column(String, nullable=True)
    is_active = Column(Integer, default=1) # Boolean logic handling inside SQLite

    contacts = relationship("CustomerContact", back_populates="customer")
    documents = relationship("CustomerDocument", back_populates="customer")
    consignment_batches = relationship("ConsignmentBatch", back_populates="customer")

class CustomerContact(Base):
    __tablename__ = "customer_contacts"
    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(String, ForeignKey("unified_customers.crm_id"))
    name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    is_authorized_buyer = Column(Integer, default=0) # 0=No, 1=Yes

    customer = relationship("UnifiedCustomer", back_populates="contacts")

class CustomerDocument(Base):
    __tablename__ = "customer_documents"
    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(String, ForeignKey("unified_customers.crm_id"))
    document_type = Column(String, nullable=False) # e.g., 'Resale_Certificate', 'Drivers_License'
    file_url = Column(String, nullable=False)
    expiry_date = Column(DateTime, nullable=True)

    customer = relationship("UnifiedCustomer", back_populates="documents")

class TransferOrder(Base):
    __tablename__ = "transfer_orders"
    id = Column(String, primary_key=True, index=True)
    org_id = Column(String, index=True, nullable=True)
    transfer_type = Column(Enum(TransferType), nullable=False)
    source_location_id = Column(String, nullable=True)
    destination_location_id = Column(String, nullable=False)
    notes = Column(String, nullable=True)
    created_by_email = Column(String, nullable=True)
    created_at = Column(DateTime, default=func.now())
    status = Column(String, default="Draft")

class TransferManifest(Base):
    __tablename__ = "transfer_manifests"
    manifest_id = Column(String, primary_key=True, index=True)
    org_id = Column(String, index=True, nullable=True)
    origin_id = Column(String, nullable=False)
    destination_id = Column(String, nullable=False)
    courier_name = Column(String, nullable=True)
    status = Column(Enum(ManifestStatus), default=ManifestStatus.Preparing)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    items = relationship("ManifestItem", back_populates="manifest")

class ManifestItem(Base):
    __tablename__ = "manifest_items"
    id = Column(Integer, primary_key=True, index=True)
    manifest_id = Column(String, ForeignKey("transfer_manifests.manifest_id"))
    imei = Column(String, ForeignKey("device_inventory.imei"), index=True)

    manifest = relationship("TransferManifest", back_populates="items")
    device = relationship("DeviceInventory")

class DeviceInventory(Base):
    __tablename__ = "device_inventory"
    imei = Column(String, primary_key=True, index=True)
    org_id = Column(String, index=True, nullable=True)
    serial_number = Column(String, nullable=True, index=True)
    model_number = Column(String, ForeignKey("phone_models.model_number"), nullable=True)
    is_hydrated = Column(Boolean, default=False, nullable=False)
    
    location_id = Column(String, index=True, nullable=False) 
    sub_location_bin = Column(String, nullable=True)          
    device_status = Column(Enum(DeviceStatus), default=DeviceStatus.Sellable, nullable=True)
    store_id = Column(String, ForeignKey("store_locations.id"), nullable=True)
    
    cost_basis = Column(Float, nullable=True, default=0.0)
    assigned_transfer_order_id = Column(String, ForeignKey("transfer_orders.id"), nullable=True, index=True)
    assigned_technician_id = Column(String, ForeignKey("users.email"), nullable=True)
    sold_to_crm_id = Column(String, ForeignKey("unified_customers.crm_id"), nullable=True, index=True)
    
    received_date = Column(DateTime, default=func.now())
    warranty_expiry_date = Column(DateTime, nullable=True)
    
    model = relationship("PhoneModel")
    transfer_order = relationship("TransferOrder")
    customer = relationship("UnifiedCustomer")

class DeviceHistoryLog(Base):
    __tablename__ = "device_history_log"
    log_id = Column(Integer, primary_key=True, index=True)
    org_id = Column(String, index=True, nullable=True)
    imei = Column(String, ForeignKey("device_inventory.imei"), nullable=False, index=True)
    timestamp = Column(DateTime, default=func.now(), index=True)
    action_type = Column(String, nullable=False)
    employee_id = Column(String, nullable=False) # Usually email
    previous_status = Column(String, nullable=True)
    new_status = Column(String, nullable=False)
    notes = Column(String, nullable=True)

class PaymentMethodEnum(str, enum.Enum):
    Cash = "Cash"
    Credit_Card = "Credit Card"
    Wire = "Wire"
    Store_Credit = "Store Credit"
    On_Terms = "On Terms"
    Zelle = "Zelle"

class PaymentStatus(str, enum.Enum):
    Unpaid = "Unpaid"
    Partial_Layaway = "Partial/Layaway"
    Paid_in_Full = "Paid_in_Full"
    Refunded = "Refunded"
    Voided = "Voided"


class InvoiceStatus(str, enum.Enum):
    Draft = "Draft"
    Unpaid = "Unpaid"
    Partially_Paid = "Partially_Paid"
    Paid = "Paid"
    Overdue = "Overdue"
    Voided = "Voided"
    Refunded = "Refunded"

class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(String, index=True, nullable=True)
    invoice_number = Column(String, unique=True, index=True)
    customer_id = Column(String, ForeignKey("unified_customers.crm_id"), nullable=True)
    store_id = Column(String, ForeignKey("store_locations.id"), nullable=True)
    subtotal = Column(Float)
    tax_percent = Column(Float)
    tax_amount = Column(Float)
    total = Column(Float)
    fulfillment_method = Column(String, default="Walk-in")
    shipping_address = Column(String, nullable=True)
    status = Column(Enum(InvoiceStatus), default=InvoiceStatus.Unpaid)
    payment_status = Column(Enum(PaymentStatus), default=PaymentStatus.Unpaid)
    is_estimate = Column(Integer, default=0) # 0=Invoice, 1=Estimate
    due_date = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    viewed_at = Column(DateTime, nullable=True)
    emailed_at = Column(DateTime, nullable=True)
    message_on_invoice = Column(String, nullable=True)
    statement_memo = Column(String, nullable=True)
    discount_percent = Column(Float, default=0.0)
    discount_total = Column(Float, default=0.0)
    currency = Column(String, default="USD")
    share_token = Column(String, unique=True, index=True, nullable=True)
    internal_notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=func.now())

    customer = relationship("UnifiedCustomer")
    items = relationship("InvoiceItem", back_populates="invoice")
    payments = relationship("PaymentTransaction", back_populates="invoice")

    @property
    def paid_amount(self) -> float:
        return sum(p.amount for p in (self.payments or []))

class RecurringFrequency(str, enum.Enum):
    Weekly = "Weekly"
    Monthly = "Monthly"
    Quarterly = "Quarterly"
    Yearly = "Yearly"

class RecurringTemplateStatus(str, enum.Enum):
    Active = "Active"
    Paused = "Paused"
    Completed = "Completed"

class RecurringInvoiceTemplate(Base):
    __tablename__ = "recurring_invoice_templates"
    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(String, index=True, nullable=True)
    customer_id = Column(String, ForeignKey("unified_customers.crm_id"), nullable=False)
    frequency = Column(Enum(RecurringFrequency), nullable=False)
    interval_value = Column(Integer, default=1)
    next_run_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=True)
    auto_send = Column(Integer, default=0)
    status = Column(Enum(RecurringTemplateStatus), default=RecurringTemplateStatus.Active)
    line_items = Column(String, nullable=False)  # JSON array
    terms = Column(String, default="Due on Receipt")
    message_on_invoice = Column(String, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    customer = relationship("UnifiedCustomer")

class RecurringInvoiceLog(Base):
    __tablename__ = "recurring_invoice_logs"
    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(String, index=True, nullable=True)
    template_id = Column(Integer, ForeignKey("recurring_invoice_templates.id"), nullable=False)
    executed_at = Column(DateTime, default=func.now())
    resulting_invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    status = Column(String, default="Success")  # "Success" or "Error"
    error_message = Column(String, nullable=True)

    template = relationship("RecurringInvoiceTemplate")
    resulting_invoice = relationship("Invoice")

class InvoiceItem(Base):
    __tablename__ = "invoice_items"
    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), index=True)
    imei = Column(String, index=True, nullable=True)
    model_number = Column(String, nullable=True)
    description = Column(String, nullable=True)
    quantity = Column(Integer, default=1)
    rate = Column(Float, default=0.0)
    amount = Column(Float, default=0.0)
    taxable = Column(Boolean, default=True)
    product_source = Column(String, nullable=True)  # "device_inventory", "device_catalog", "parts_inventory", "manual"
    sku = Column(String, nullable=True)
    batch_serial = Column(String, nullable=True)
    item_discount_amount = Column(Float, default=0.0)
    item_discount_percent = Column(Float, default=0.0)
    unit_price = Column(Float)  # deprecated, use rate

    invoice = relationship("Invoice", back_populates="items")

class PaymentTransaction(Base):
    __tablename__ = "payment_transactions"
    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    org_id = Column(String, index=True, nullable=False)
    invoice_id = Column(Integer, ForeignKey("invoices.id"))
    amount = Column(Float, nullable=False, default=0.0)
    payment_method = Column(Enum(PaymentMethodEnum), nullable=False)
    reference_id = Column(String, nullable=True)
    timestamp = Column(DateTime, default=func.now())
    
    invoice = relationship("Invoice", back_populates="payments")

class InventoryAudit(Base):
    __tablename__ = "inventory_audits"
    audit_id = Column(String, primary_key=True, index=True)
    org_id = Column(String, index=True, nullable=True)
    location_id = Column(String, nullable=False)
    store_id = Column(String, ForeignKey("store_locations.id"), nullable=True)
    conducted_by_employee_id = Column(String, nullable=False)
    timestamp = Column(DateTime, default=func.now())
    total_expected = Column(Integer, default=0)
    total_scanned = Column(Integer, default=0)
    total_missing = Column(Integer, default=0)
    total_unexpected = Column(Integer, default=0)
    status = Column(String, default="Draft") 
    
    items = relationship("InventoryAuditItem", back_populates="audit")

class InventoryAuditItem(Base):
    __tablename__ = "inventory_audit_items"
    id = Column(Integer, primary_key=True, index=True)
    audit_id = Column(String, ForeignKey("inventory_audits.audit_id"))
    imei = Column(String, index=True)
    variance_status = Column(String, nullable=False) 
    
    audit = relationship("InventoryAudit", back_populates="items")

class RepairStatus(enum.Enum):
    Pending_Triage = "Pending_Triage"
    In_Repair = "In_Repair"
    Awaiting_Parts = "Awaiting_Parts"
    Completed = "Completed"
    Cancelled = "Cancelled"

class PartsInventory(Base):
    __tablename__ = "parts_inventory"
    sku = Column(String, primary_key=True, index=True)
    org_id = Column(String, index=True, nullable=True)
    part_name = Column(String, nullable=False)
    current_stock_qty = Column(Integer, default=0)
    moving_average_cost = Column(Float, default=0.0)
    low_stock_threshold = Column(Integer, default=5)
    created_at = Column(DateTime, default=datetime.utcnow)

class DeviceCostLedger(Base):
    __tablename__ = "device_cost_ledger"
    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(String, index=True, nullable=True)
    imei = Column(String, ForeignKey("device_inventory.imei"), nullable=False, index=True)
    cost_type = Column(String, nullable=False) # e.g., "Purchase", "Part: Screen", "Labor"
    amount = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class RepairMapping(Base):
    __tablename__ = "repair_mapping"
    id = Column(Integer, primary_key=True, index=True)
    device_model_number = Column(String, nullable=False, index=True)
    repair_category = Column(String, nullable=False) # e.g., "Screen", "Battery"
    default_part_sku = Column(String, ForeignKey("parts_inventory.sku"), nullable=False)

class RepairTicket(Base):
    __tablename__ = "repair_tickets"
    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(String, index=True, nullable=True)
    imei = Column(String, ForeignKey("device_inventory.imei"), nullable=False, index=True)
    symptoms = Column(String) # JSON or comma-separated
    notes = Column(String)
    status = Column(Enum(RepairStatus), default=RepairStatus.Pending_Triage)
    assigned_tech_id = Column(String, ForeignKey("users.email"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

class Supplier(Base):
    __tablename__ = "suppliers"
    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(String, index=True, nullable=True)
    name = Column(String, nullable=False)
    contact_email = Column(String, nullable=True)
    contact_phone = Column(String, nullable=True)
    payment_terms = Column(String, default="Net 30")
    lead_time_days = Column(Integer, default=7)
    notes = Column(String, nullable=True)
    is_active = Column(Integer, default=1)


class SupplierPricing(Base):
    __tablename__ = "supplier_pricing"
    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(String, index=True, nullable=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    sku = Column(String, nullable=False)
    supplier_sku = Column(String, nullable=True)
    unit_cost = Column(Float, default=0.0)
    moq = Column(Integer, default=1)
    lead_time_days = Column(Integer, default=7)
    is_preferred = Column(Integer, default=0)
    last_updated = Column(DateTime, default=func.now(), onupdate=func.now())

    supplier = relationship("Supplier")


class PartIntake(Base):
    __tablename__ = "part_intakes"
    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(String, index=True, nullable=True)
    sku = Column(String, ForeignKey("parts_inventory.sku"), nullable=False, index=True)
    qty = Column(Integer, nullable=False)
    total_price = Column(Float, default=0.0)
    is_priced = Column(Integer, default=0) # 0 = Unpriced, 1 = Priced
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
class DeviceCatalog(Base):
    __tablename__ = "device_catalog"
    model_number = Column(String, primary_key=True, index=True)
    brand = Column(String, nullable=False)
    name = Column(String, nullable=False)
    storage = Column(String, nullable=False)
    color = Column(String, nullable=False)

class LaborRateConfig(Base):
    __tablename__ = "labor_rate_config"
    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(String, index=True, nullable=True)
    action_name = Column(String, unique=True, nullable=False) # e.g., 'QC_Standard', 'Repair_Screen'
    fee_amount = Column(Float, nullable=False, default=0.0)

class PricingConfig(Base):
    __tablename__ = "pricing_config"
    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(String, index=True, nullable=True)
    pricing_tier = Column(Float, default=0.0)
    applies_to = Column(String, default="Both")  # Retail, Wholesale, Both
    default_markup_percent = Column(Float, default=20.0)

class AdminAuditLog(Base):
    __tablename__ = "admin_audit_log"
    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(String, index=True, nullable=True)
    timestamp = Column(DateTime, default=func.now(), index=True)
    actor_email = Column(String, nullable=False, index=True)
    action = Column(String, nullable=False)
    target = Column(String, nullable=True)
    details = Column(String, nullable=True)

class QCInspection(Base):
    __tablename__ = "qc_inspections"
    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    org_id = Column(String, index=True, nullable=True)
    imei = Column(String, ForeignKey("device_inventory.imei"), nullable=False, index=True)
    screen_condition = Column(String, nullable=True)
    frame_condition = Column(String, nullable=True)
    camera_lens_damage = Column(Boolean, default=False)
    face_id_issue = Column(Boolean, default=False)
    battery_service = Column(Boolean, default=False)
    speaker_issue_ear = Column(Boolean, default=False)
    speaker_issue_loud = Column(Boolean, default=False)
    charging_port_issue = Column(Boolean, default=False)
    network_locked = Column(Boolean, default=False)
    grade = Column(String, nullable=True)
    needs_repair = Column(Boolean, default=False)
    repair_items = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    inspector_id = Column(String, nullable=False)
    created_at = Column(DateTime, default=func.now())

class ConsignmentBatch(Base):
    __tablename__ = "consignment_batches"
    id = Column(String, primary_key=True, index=True)
    org_id = Column(String, index=True, nullable=True)
    crm_id = Column(String, ForeignKey("unified_customers.crm_id"), nullable=False, index=True)
    status = Column(Enum(ConsignmentBatchStatus), default=ConsignmentBatchStatus.Active)
    handoff_date = Column(DateTime, default=func.now())
    due_date = Column(DateTime, nullable=False)
    settled_date = Column(DateTime, nullable=True)
    notes = Column(String, nullable=True)
    created_by_email = Column(String, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    customer = relationship("UnifiedCustomer", back_populates="consignment_batches")
    items = relationship("ConsignmentItem", back_populates="batch")

class ConsignmentItem(Base):
    __tablename__ = "consignment_items"
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String, ForeignKey("consignment_batches.id"), nullable=False, index=True)
    imei = Column(String, ForeignKey("device_inventory.imei"), nullable=True, index=True)
    sku = Column(String, nullable=True)
    description = Column(String, nullable=False)
    quantity = Column(Integer, default=1)
    unit_price = Column(Float, nullable=False, default=0.0)
    outcome = Column(Enum(ConsignmentItemOutcome), default=ConsignmentItemOutcome.Pending)
    settled_qty = Column(Integer, default=0)
    returned_qty = Column(Integer, default=0)
    settled_date = Column(DateTime, nullable=True)
    resulting_invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    notes = Column(String, nullable=True)

    batch = relationship("ConsignmentBatch", back_populates="items")
    device = relationship("DeviceInventory")
    resulting_invoice = relationship("Invoice")


class POStatus(str, enum.Enum):
    Draft = "Draft"
    Ordered = "Ordered"
    Partially_Received = "Partially_Received"
    Received = "Received"
    Cancelled = "Cancelled"


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    id = Column(String, primary_key=True, index=True)
    org_id = Column(String, index=True, nullable=True)
    po_number = Column(String, unique=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    store_id = Column(String, ForeignKey("store_locations.id"), nullable=True)
    status = Column(Enum(POStatus), default=POStatus.Draft)
    expected_date = Column(DateTime, nullable=True)
    received_date = Column(DateTime, nullable=True)
    total_cost = Column(Float, default=0.0)
    shipping_cost = Column(Float, default=0.0)
    tax_cost = Column(Float, default=0.0)
    notes = Column(String, nullable=True)
    created_by_email = Column(String, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    supplier = relationship("Supplier")
    items = relationship("POItem", back_populates="purchase_order")


class POItem(Base):
    __tablename__ = "po_items"
    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(String, index=True, nullable=True)
    po_id = Column(String, ForeignKey("purchase_orders.id"), nullable=False)
    sku = Column(String, nullable=True)
    description = Column(String, nullable=False)
    quantity_ordered = Column(Integer, default=1)
    quantity_received = Column(Integer, default=0)
    unit_cost = Column(Float, default=0.0)
    total_cost = Column(Float, default=0.0)

    purchase_order = relationship("PurchaseOrder", back_populates="items")
