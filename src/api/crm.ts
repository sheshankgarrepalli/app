// CRM & Consignment API helpers
import api from './api';

// ── Customers ──

export interface CustomerContact {
  id: number;
  customer_id: string;
  name: string;
  phone?: string;
  is_authorized_buyer: number;
}

export interface CustomerDocument {
  id: number;
  customer_id: string;
  document_type: string;
  file_url: string;
  expiry_date?: string;
}

export interface Customer {
  crm_id: string;
  customer_type: 'Retail' | 'Wholesale';
  first_name?: string;
  last_name?: string;
  company_name?: string;
  contact_person?: string;
  shipping_address?: string;
  phone: string;
  email?: string;
  tax_exempt_id?: string;
  tax_exempt_expiry?: string;
  pricing_tier: number;
  credit_limit: number;
  current_balance: number;
  payment_terms_days: number;
  wholesale_subtype?: 'standard' | 'consignee';
  default_consignment_days: number;
  notes?: string;
  is_active: number;
  contacts: CustomerContact[];
  documents: CustomerDocument[];
}

export interface CustomerCreate {
  customer_type: 'Retail' | 'Wholesale';
  first_name?: string;
  last_name?: string;
  company_name?: string;
  contact_person?: string;
  shipping_address?: string;
  phone: string;
  email?: string;
  tax_exempt_id?: string;
  tax_exempt_expiry?: string;
  pricing_tier?: number;
  credit_limit?: number;
  payment_terms_days?: number;
  wholesale_subtype?: 'standard' | 'consignee';
  default_consignment_days?: number;
  notes?: string;
}

export async function fetchCustomers(search?: string): Promise<Customer[]> {
  const params = search ? { search } : {};
  const { data } = await api.get('/crm/', { params });
  return data;
}

export async function fetchCustomer(crmId: string): Promise<Customer> {
  const { data } = await api.get(`/crm/${crmId}/history`);
  return data.customer;
}

export async function createCustomer(customer: CustomerCreate): Promise<Customer> {
  const { data } = await api.post('/crm/', customer);
  return data;
}

export async function updateCustomer(crmId: string, customer: CustomerCreate): Promise<Customer> {
  const { data } = await api.put(`/crm/${crmId}`, customer);
  return data;
}

// ── Consignments ──

export interface ConsignmentItem {
  id: number;
  batch_id: string;
  imei?: string;
  sku?: string;
  description: string;
  quantity: number;
  unit_price: number;
  outcome: 'pending' | 'sold' | 'returned';
  settled_qty: number;
  returned_qty: number;
  settled_date?: string;
  resulting_invoice_id?: number;
  notes?: string;
  device?: any;
}

export interface ConsignmentBatch {
  id: string;
  org_id?: string;
  crm_id: string;
  status: 'active' | 'settled';
  handoff_date: string;
  due_date: string;
  settled_date?: string;
  notes?: string;
  created_by_email?: string;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  items: ConsignmentItem[];
}

export interface ConsignmentItemCreate {
  imei?: string;
  sku?: string;
  description: string;
  quantity: number;
  unit_price: number;
}

export interface ConsignmentBatchCreate {
  crm_id: string;
  items: ConsignmentItemCreate[];
  notes?: string;
}

export interface SettleItem {
  item_id: number;
  outcome: 'sold' | 'returned';
  settled_qty?: number;
  returned_qty?: number;
}

export interface SettleRequest {
  items: SettleItem[];
  payment_method?: string;
  payment_amount?: number;
  payment_reference?: string;
  skip_qc?: boolean;
  notes?: string;
}

export async function fetchConsignees(search?: string): Promise<Customer[]> {
  const params = search ? { search } : {};
  const { data } = await api.get('/consignment/customers/consignees', { params });
  return data;
}

export async function fetchBatches(crmId?: string, status?: string): Promise<ConsignmentBatch[]> {
  const params: any = {};
  if (crmId) params.crm_id = crmId;
  if (status) params.status = status;
  const { data } = await api.get('/consignment/batches', { params });
  return data;
}

export async function fetchBatch(batchId: string): Promise<ConsignmentBatch> {
  const { data } = await api.get(`/consignment/batches/${batchId}`);
  return data;
}

export async function createBatch(batch: ConsignmentBatchCreate): Promise<ConsignmentBatch> {
  const { data } = await api.post('/consignment/batches', batch);
  return data;
}

export async function settleBatch(batchId: string, request: SettleRequest): Promise<ConsignmentBatch> {
  const { data } = await api.post(`/consignment/batches/${batchId}/settle`, request);
  return data;
}
