import api from './api';
import type { Customer } from './crm';

export interface InvoiceItem {
  id: number;
  invoice_id: number;
  imei?: string | null;
  model_number?: string | null;
  description?: string | null;
  quantity: number;
  rate: number;
  amount: number;
  taxable: boolean;
  product_source?: string | null;
  sku?: string | null;
  batch_serial?: string | null;
  item_discount_amount: number;
  item_discount_percent: number;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  store_id: string;
  customer_id?: string | null;
  subtotal: number;
  tax_percent: number;
  tax_amount: number;
  total: number;
  fulfillment_method?: string | null;
  shipping_address?: string | null;
  status: string;
  payment_status: string;
  is_estimate: number;
  due_date?: string | null;
  sent_at?: string | null;
  viewed_at?: string | null;
  emailed_at?: string | null;
  message_on_invoice?: string | null;
  statement_memo?: string | null;
  discount_percent: number;
  discount_total: number;
  currency: string;
  paid_amount: number;
  share_token?: string | null;
  internal_notes?: string | null;
  created_at: string;
  items: InvoiceItem[];
  customer?: Customer | null;
  payments: Payment[];
  invoice_terms?: string | null;
}

export interface Payment {
  id: string;
  invoice_id: number;
  amount: number;
  payment_method: string;
  reference_id?: string | null;
  timestamp: string;
}

export interface InvoiceFormItem {
  model_number?: string;
  imei?: string;
  description?: string;
  device_name?: string;
  qty: number;
  rate: number;
  taxable: boolean;
  sku?: string;
  batch_serial?: string;
  item_discount_amount: number;
  item_discount_percent: number;
}

export interface InvoiceCreate {
  customer_id?: string;
  customer?: any;
  items: InvoiceFormItem[];
  invoice_date?: string;
  due_date?: string;
  terms?: string;
  message_on_invoice?: string;
  statement_memo?: string;
  discount_percent?: number;
  discount_total?: number;
  currency?: string;
  tax_percent?: number;
  fulfillment_method?: string;
  shipping_address?: string;
  status?: string;
  internal_notes?: string;
  payments?: { amount: number; payment_method: string; reference_id?: string }[];
}

export const PAYMENT_METHODS = ['Cash', 'Credit Card', 'Wire', 'Store Credit', 'On Terms', 'Zelle'] as const;

export interface AutocompleteResult {
  type: 'device_inventory' | 'device_catalog' | 'parts_inventory';
  label: string;
  sublabel?: string;
  imei?: string;
  model_number?: string;
  sku?: string;
  price?: number;
  cost_basis?: number;
  status?: string;
  location_id?: string;
  stock_qty?: number;
  part_name?: string;
}

export function extractError(err: any): string {
  const detail = err.response?.data?.detail;
  if (Array.isArray(detail)) {
    return detail.map((e: any) => e.msg || JSON.stringify(e)).join(', ');
  }
  if (typeof detail === 'string') return detail;
  if (typeof detail === 'object' && detail.message) return detail.message;
  return 'An unexpected error occurred';
}

export async function fetchInvoices(query?: string, storeId?: string | null): Promise<Invoice[]> {
  const params: Record<string, string> = {};
  if (query) params.query = query;
  if (storeId) params.store_id = storeId;
  const { data } = await api.get('/api/pos/invoices', { params });
  return data;
}

export async function fetchInvoice(invoiceNumber: string): Promise<Invoice> {
  // Fetch from list and find (no single-invoice GET endpoint yet except public)
  const invoices = await fetchInvoices(invoiceNumber);
  const match = invoices.find(i => i.invoice_number === invoiceNumber);
  if (!match) throw new Error('Invoice not found');
  return match;
}

export async function createInvoice(payload: InvoiceCreate): Promise<Invoice> {
  const { data } = await api.post('/api/pos/invoices', payload);
  return data;
}

export interface InvoiceUpdate {
  invoice_date?: string;
  due_date?: string;
  terms?: string;
  message_on_invoice?: string;
  statement_memo?: string;
  discount_percent?: number;
  discount_total?: number;
  currency?: string;
  tax_percent?: number;
  fulfillment_method?: string;
  shipping_address?: string;
  status?: string;
  internal_notes?: string;
  items?: InvoiceFormItem[];
  payments?: { amount: number; payment_method: string; reference_id?: string }[];
}

export async function updateInvoice(invoiceNumber: string, payload: InvoiceUpdate): Promise<Invoice> {
  const { data } = await api.patch(`/api/pos/invoices/${invoiceNumber}`, payload);
  return data;
}

export async function generateShareLink(invoiceNumber: string): Promise<{ share_token: string; url: string }> {
  const { data } = await api.post(`/api/pos/invoices/${invoiceNumber}/share`);
  return data;
}

export async function revokeShareLink(invoiceNumber: string): Promise<void> {
  await api.delete(`/api/pos/invoices/${invoiceNumber}/share`);
}

export async function fetchPublicInvoice(shareToken: string): Promise<Invoice> {
  const { data } = await api.get(`/api/pos/public/invoice/${shareToken}`);
  return data;
}

export async function fetchAutocomplete(query: string): Promise<AutocompleteResult[]> {
  if (!query || query.length < 2) return [];
  const { data } = await api.get('/api/inventory/autocomplete', { params: { q: query } });
  return data;
}

export interface TimelineEvent {
  ts: string;
  actor: string;
  action: string;
  details: string;
}

export interface InvoiceTimeline {
  invoice_number: string;
  status: string;
  created_at: string;
  events: TimelineEvent[];
}

export async function fetchInvoiceTimeline(invoiceNumber: string): Promise<InvoiceTimeline> {
  const { data } = await api.get(`/api/pos/invoices/${invoiceNumber}/timeline`);
  return data;
}

export async function voidInvoice(invoiceNumber: string): Promise<{ status: string; invoice_number: string; devices_released: number }> {
  const { data } = await api.post(`/api/pos/invoices/${invoiceNumber}/void`);
  return data;
}

export function invoicePdfUrl(invoiceNumber: string): string {
  return `/api/pos/invoices/${invoiceNumber}/pdf`;
}

export async function emailInvoice(invoiceNumber: string): Promise<{ status: string; invoice_number: string; recipient: string; sent_at: string }> {
  const { data } = await api.post(`/api/pos/invoices/${invoiceNumber}/email`);
  return data;
}

export async function uploadAttachment(invoiceNumber: string): Promise<{ status: string; invoice_number: string }> {
  const { data } = await api.post(`/api/pos/invoices/${invoiceNumber}/attachments`);
  return data;
}
