import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Loader2, AlertCircle, Save, Plus, Trash2, Search, X, Building2, User,
  ArrowLeft, Wallet, Mail, Printer, Paperclip, FileEdit, Barcode, Pencil,
} from 'lucide-react';
import {
  createInvoice, updateInvoice, fetchInvoice, fetchAutocomplete,
  InvoiceFormItem, AutocompleteResult, extractError, PAYMENT_METHODS, emailInvoice,
} from '../api/invoices';
import { fetchCustomers, Customer } from '../api/crm';

interface PaymentRow {
  amount: number;
  payment_method: string;
  reference_id: string;
}

const emptyItem: InvoiceFormItem = {
  description: '', qty: 1, rate: 0, taxable: true,
  sku: '', batch_serial: '', item_discount_amount: 0, item_discount_percent: 0,
};

const emptyPayment: PaymentRow = { amount: 0, payment_method: 'Cash', reference_id: '' };

export default function InvoiceForm() {
  const navigate = useNavigate();
  const { invoiceNumber } = useParams<{ invoiceNumber?: string }>();
  const isEdit = !!invoiceNumber;

  const [items, setItems] = useState<InvoiceFormItem[]>([{ ...emptyItem }]);
  const [customerId, setCustomerId] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [terms, setTerms] = useState('Due on Receipt');
  const [messageOnInvoice, setMessageOnInvoice] = useState('');
  const [statementMemo, setStatementMemo] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountTotal, setDiscountTotal] = useState(0);
  const [taxPercent, setTaxPercent] = useState(8.5);
  const [fulfillmentMethod, setFulfillmentMethod] = useState('Walk-in');
  const [currency, setCurrency] = useState('USD');
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceStatus, setInvoiceStatus] = useState<'Active' | 'Draft'>('Active');
  const [internalNotes, setInternalNotes] = useState('');
  const [scanImei, setScanImei] = useState('');
  const [loadingEdit, setLoadingEdit] = useState(isEdit);
  const [lockedCustomer, setLockedCustomer] = useState<Customer | null>(null);

  // Load existing invoice for edit mode
  useEffect(() => {
    if (!invoiceNumber) return;
    (async () => {
      setLoadingEdit(true);
      try {
        const inv = await fetchInvoice(invoiceNumber);
        setCustomerId(inv.customer_id || '');
        if (inv.customer) setLockedCustomer(inv.customer as Customer);
        setTerms(inv.invoice_terms || 'Due on Receipt');
        setMessageOnInvoice(inv.message_on_invoice || '');
        setStatementMemo(inv.statement_memo || '');
        setDiscountPercent(inv.discount_percent || 0);
        setDiscountTotal(inv.discount_total || 0);
        setTaxPercent(inv.tax_percent || 8.5);
        setCurrency(inv.currency || 'USD');
        setFulfillmentMethod(inv.fulfillment_method || 'Walk-in');
        setInvoiceStatus(inv.status === 'Draft' ? 'Draft' : 'Active');
        setInternalNotes(inv.internal_notes || '');
        if (inv.items?.length) {
          setItems(inv.items.map(i => ({
            model_number: i.model_number || '',
            imei: i.imei || '',
            description: i.description || '',
            qty: i.quantity || 1,
            rate: i.rate || 0,
            taxable: i.taxable,
            sku: i.sku || '',
            batch_serial: i.batch_serial || '',
            item_discount_amount: i.item_discount_amount || 0,
            item_discount_percent: i.item_discount_percent || 0,
          })));
        }
        if (inv.payments?.length) {
          setPayments(inv.payments.map(p => ({
            amount: p.amount || 0,
            payment_method: p.payment_method || 'Cash',
            reference_id: p.reference_id || '',
          })));
        }
      } catch (err: any) {
        setError(extractError(err));
      } finally {
        setLoadingEdit(false);
      }
    })();
  }, [invoiceNumber]);

  // Autocomplete per item index
  const [acIdx, setAcIdx] = useState<number | null>(null);
  const [acResults, setAcResults] = useState<AutocompleteResult[]>([]);
  const acRef = useRef<HTMLDivElement>(null);
  const acTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchCustomers = useCallback(async (q: string) => {
    setCustomerSearch(q);
    if (!q || q.length < 1) {
      setCustomers([]);
      setShowCustomerDropdown(false);
      return;
    }
    try {
      const data = await fetchCustomers(q);
      setCustomers(data);
      setShowCustomerDropdown(true);
    } catch { setCustomers([]); }
  }, []);

  const doAutocomplete = useCallback(async (q: string, idx: number) => {
    if (!q || q.length < 2) { setAcResults([]); setAcIdx(null); return; }
    setAcIdx(idx);
    try {
      const results = await fetchAutocomplete(q);
      setAcResults(results);
    } catch { setAcResults([]); }
  }, []);

  const handleItemDescChange = useCallback((idx: number, value: string) => {
    const next = [...items];
    next[idx] = { ...next[idx], description: value };
    setItems(next);
    if (acTimer.current) clearTimeout(acTimer.current);
    acTimer.current = setTimeout(() => doAutocomplete(value, idx), 250);
  }, [items, doAutocomplete]);

  const selectAutocomplete = (idx: number, result: AutocompleteResult) => {
    const next = [...items];
    next[idx] = {
      ...next[idx],
      description: result.label,
      imei: result.imei,
      model_number: result.model_number || result.sku,
      sku: result.sku || result.model_number || '',
      rate: result.price || 0,
      taxable: true,
    };
    setItems(next);
    setAcResults([]);
    setAcIdx(null);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (acRef.current && !acRef.current.contains(e.target as Node)) {
        setAcResults([]);
        setAcIdx(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addItem = () => setItems(prev => [...prev, { ...emptyItem }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof InvoiceFormItem, value: any) => {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: value };
    setItems(next);
  };

  const addPayment = () => setPayments(prev => [...prev, { ...emptyPayment }]);
  const removePayment = (idx: number) => setPayments(prev => prev.filter((_, i) => i !== idx));
  const updatePayment = (idx: number, field: keyof PaymentRow, value: any) => {
    const next = [...payments];
    next[idx] = { ...next[idx], [field]: value };
    setPayments(next);
  };

  // Computed totals
  const subtotal = items.reduce((s, i) => s + i.rate * i.qty, 0);
  const itemsDiscount = items.reduce((s, i) => s + (i.item_discount_amount || 0), 0);
  const effectiveDiscount = discountPercent > 0 ? subtotal * (discountPercent / 100) : discountTotal;
  const totalDiscount = effectiveDiscount + itemsDiscount;
  const discountedSubtotal = subtotal - totalDiscount;
  const taxAmount = discountedSubtotal * (taxPercent / 100);
  const total = discountedSubtotal + taxAmount;
  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const balanceDue = total - totalPaid;
  const selectedCustomer = customers.find(c => c.crm_id === customerId);

  // Handle scan barcode
  const handleScanBarcode = async () => {
    if (!scanImei.trim()) return;
    try {
      const results = await fetchAutocomplete(scanImei.trim());
      if (results.length > 0) {
        const r = results[0];
        const newItem: InvoiceFormItem = {
          ...emptyItem,
          description: r.label,
          imei: r.imei || scanImei.trim(),
          model_number: r.model_number || r.sku,
          sku: r.sku || r.model_number || '',
          rate: r.price || 0,
          taxable: true,
        };
        setItems(prev => {
          // If first row is empty, replace it
          if (prev.length === 1 && !prev[0].description && !prev[0].imei) {
            return [newItem];
          }
          return [...prev, newItem];
        });
      } else {
        // No match found, add as raw IMEI
        const newItem: InvoiceFormItem = {
          ...emptyItem,
          description: `Device ${scanImei.trim()}`,
          imei: scanImei.trim(),
          rate: 0,
          taxable: true,
        };
        setItems(prev => {
          if (prev.length === 1 && !prev[0].description && !prev[0].imei) {
            return [newItem];
          }
          return [...prev, newItem];
        });
      }
    } catch { /* ignore */ }
    setScanImei('');
  };

  const handleSave = async () => {
    const validItems = items.filter(i => i.description || i.model_number || i.imei || i.sku);
    if (validItems.length === 0) { setError('Add at least one line item'); return; }
    if (!customerId) { setError('Select a customer'); return; }

    const validPayments = payments
      .filter(p => p.amount > 0 && p.payment_method)
      .map(p => ({
        amount: p.amount,
        payment_method: p.payment_method,
        reference_id: p.reference_id || undefined,
      }));

    setSaving(true);
    setError(null);
    try {
      const payload = {
        items: validItems,
        terms,
        message_on_invoice: messageOnInvoice || undefined,
        statement_memo: statementMemo || undefined,
        discount_percent: discountPercent || 0,
        discount_total: effectiveDiscount,
        currency,
        tax_percent: taxPercent,
        fulfillment_method: fulfillmentMethod,
        status: invoiceStatus,
        internal_notes: internalNotes || undefined,
        payments: validPayments,
      };

      if (isEdit && invoiceNumber) {
        const updated = await updateInvoice(invoiceNumber, payload);
        navigate(`/admin/invoices/${updated.invoice_number}`, { replace: true });
      } else {
        const created = await createInvoice({ ...payload, customer_id: customerId });
        if (invoiceStatus === 'Draft') {
          navigate(`/admin/invoices/${created.invoice_number}`, { replace: true });
        } else {
          navigate('/admin/invoices', { replace: true });
        }
      }
    } catch (err: any) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleEmailInvoice = async () => {
    if (!customerId) { setError('Select a customer first'); return; }
    try {
      await emailInvoice(customerId);
      setError(null);
    } catch (err: any) {
      setError(extractError(err));
    }
  };

  const handlePrint = () => {
    // Print preview — open PDF in new tab
    window.open('/api/pos/invoices/latest/pdf', '_blank');
  };

  if (loadingEdit) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={28} className="animate-spin text-[var(--text-tertiary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-[var(--text-primary)]">
                {isEdit ? 'EDIT INVOICE' : 'NEW INVOICE'}
              </h1>
              {isEdit && <span className="font-mono text-sm text-accent">{invoiceNumber}</span>}
              {invoiceStatus === 'Draft' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <FileEdit size={11} /> DRAFT
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              {isEdit ? 'Edit invoice details and line items' : 'Create and send a professional invoice to your customer'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-tertiary)]">
            Balance Due: <span className="text-red-400 font-bold font-mono">${balanceDue.toFixed(2)}</span>
          </span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle size={16} />{error}
        </div>
      )}

      <div className="flex gap-5 items-start">
        {/* ── LEFT COLUMN ── */}
        <div className="flex-1 space-y-5 min-w-0">
          {/* Customer Section */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Customer Information</p>
              {!isEdit && <button className="text-xs text-accent hover:text-accent/80 font-medium">+ Add New</button>}
              {isEdit && <span className="text-[10px] text-[var(--text-tertiary)] italic">Locked — customer cannot be changed</span>}
            </div>

            {isEdit && lockedCustomer ? (
              <div className="flex items-start justify-between">
                <div className="space-y-1.5">
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    {lockedCustomer.company_name || `${lockedCustomer.first_name || ''} ${lockedCustomer.last_name || ''}`.trim() || 'Customer'}
                  </p>
                  {lockedCustomer.email && <p className="text-xs text-[var(--text-secondary)]">{lockedCustomer.email}</p>}
                  {lockedCustomer.phone && <p className="text-xs text-[var(--text-secondary)]">{lockedCustomer.phone}</p>}
                  {lockedCustomer.shipping_address && <p className="text-xs text-[var(--text-tertiary)] max-w-xs">{lockedCustomer.shipping_address}</p>}
                  <div className="flex items-center gap-4 mt-2">
                    <div>
                      <p className="text-[10px] text-[var(--text-tertiary)] uppercase">Balance</p>
                      <p className={`text-xs font-bold font-mono ${lockedCustomer.current_balance > 0 ? 'text-red-400' : 'text-[var(--text-primary)]'}`}>
                        ${lockedCustomer.current_balance.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--text-tertiary)] uppercase">Credit Limit</p>
                      <p className="text-xs font-bold text-[var(--text-primary)] font-mono">${lockedCustomer.credit_limit.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : !isEdit && selectedCustomer ? (
              <div className="flex items-start justify-between">
                <div className="space-y-1.5">
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    {selectedCustomer.company_name || `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim() || 'Customer'}
                  </p>
                  {selectedCustomer.email && <p className="text-xs text-[var(--text-secondary)]">{selectedCustomer.email}</p>}
                  {selectedCustomer.phone && <p className="text-xs text-[var(--text-secondary)]">{selectedCustomer.phone}</p>}
                  {selectedCustomer.shipping_address && <p className="text-xs text-[var(--text-tertiary)] max-w-xs">{selectedCustomer.shipping_address}</p>}
                  <div className="flex items-center gap-4 mt-2">
                    <div>
                      <p className="text-[10px] text-[var(--text-tertiary)] uppercase">Balance</p>
                      <p className={`text-xs font-bold font-mono ${selectedCustomer.current_balance > 0 ? 'text-red-400' : 'text-[var(--text-primary)]'}`}>
                        ${selectedCustomer.current_balance.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--text-tertiary)] uppercase">Credit Limit</p>
                      <p className="text-xs font-bold text-[var(--text-primary)] font-mono">${selectedCustomer.credit_limit.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
                <button onClick={() => { setCustomerId(''); setCustomerSearch(''); setCustomers([]); }} className="text-[var(--text-tertiary)] hover:text-red-400 shrink-0">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <input
                  type="text"
                  className="form-input pl-9"
                  placeholder="Search by name, phone, email or company..."
                  value={customerSearch}
                  onChange={e => searchCustomers(e.target.value)}
                  onFocus={() => customers.length > 0 && setShowCustomerDropdown(true)}
                />
                {showCustomerDropdown && customers.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg shadow-xl max-h-56 overflow-y-auto">
                    {customers.map(c => (
                      <button
                        key={c.crm_id}
                        className="w-full text-left px-4 py-3 hover:bg-[var(--bg-tertiary)] flex items-center justify-between border-b border-[var(--border-primary)] last:border-0"
                        onClick={() => { setCustomerId(c.crm_id); setShowCustomerDropdown(false); }}
                      >
                        <div className="flex items-center gap-2.5">
                          {c.customer_type === 'Wholesale' ? <Building2 size={16} className="text-accent" /> : <User size={16} className="text-accent" />}
                          <div>
                            <p className="text-sm font-medium text-[var(--text-primary)]">
                              {c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim()}
                            </p>
                            <p className="text-xs text-[var(--text-tertiary)]">
                              {c.phone}{c.email ? ` · ${c.email}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]">{c.customer_type}</span>
                          {c.current_balance > 0 && (
                            <p className="text-[10px] text-red-400 mt-0.5 font-mono">Bal: ${c.current_balance.toFixed(2)}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Line Items Table */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-[var(--bg-tertiary)]">
              <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Invoice Items</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    className="form-input text-xs py-1 px-2 w-36"
                    placeholder="Scan IMEI / barcode..."
                    value={scanImei}
                    onChange={e => setScanImei(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleScanBarcode()}
                  />
                  <button
                    onClick={handleScanBarcode}
                    disabled={!scanImei.trim()}
                    className="flex items-center gap-1 text-[10px] text-accent hover:text-accent/80 font-medium disabled:opacity-40"
                  >
                    <Barcode size={14} /> Scan
                  </button>
                </div>
                <button onClick={addItem} className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 font-medium">
                  <Plus size={14} /> Add Line Item
                </button>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider border-b border-[var(--border-primary)]">
                  <th className="text-left p-3 w-[22%]">Product / Service</th>
                  <th className="text-left p-3 w-[12%]">SKU</th>
                  <th className="text-left p-3 w-[12%]">Serial / IMEI</th>
                  <th className="text-center p-3 w-[7%]">Qty</th>
                  <th className="text-right p-3 w-[10%]">Price</th>
                  <th className="text-right p-3 w-[14%]">Discount</th>
                  <th className="text-right p-3 w-[10%]">Amount</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-primary)]">
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="p-2">
                      <div ref={acIdx === idx ? acRef : undefined} className="relative">
                        <input
                          type="text"
                          className="form-input text-xs py-1.5"
                          placeholder="Search item or type description..."
                          value={item.description || ''}
                          onChange={e => handleItemDescChange(idx, e.target.value)}
                        />
                        {acIdx === idx && acResults.length > 0 && (
                          <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg shadow-xl max-h-44 overflow-y-auto">
                            {acResults.map((r, ri) => (
                              <button
                                key={ri}
                                className="w-full text-left px-3 py-2 hover:bg-[var(--bg-tertiary)] border-b border-[var(--border-primary)] last:border-0"
                                onClick={() => selectAutocomplete(idx, r)}
                              >
                                <p className="text-xs text-[var(--text-primary)]">{r.label}</p>
                                <p className="text-[10px] text-[var(--text-tertiary)]">{r.sublabel}</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        className="form-input text-xs py-1.5"
                        placeholder="SKU"
                        value={item.sku || ''}
                        onChange={e => updateItem(idx, 'sku', e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        className="form-input text-xs py-1.5"
                        placeholder="IMEI or serial #"
                        value={item.batch_serial || ''}
                        onChange={e => updateItem(idx, 'batch_serial', e.target.value)}
                        onBlur={async (e) => {
                          const val = e.target.value.trim();
                          if (val.length < 5) return;
                          try {
                            const results = await fetchAutocomplete(val);
                            if (results.length > 0) {
                              const r = results[0];
                              const matchedModel = r.model_number || r.sku || r.label;
                              // Check if any existing row already has this model
                              const existingIdx = items.findIndex((it, i) =>
                                i !== idx && it.model_number === matchedModel && (it.description || it.imei)
                              );
                              if (existingIdx >= 0) {
                                // Stack onto existing row
                                const next = [...items];
                                const existing = next[existingIdx];
                                const existingImeis = (existing.batch_serial || '').split(',').map(s => s.trim()).filter(Boolean);
                                if (!existingImeis.includes(val)) existingImeis.push(val);
                                next[existingIdx] = {
                                  ...existing,
                                  qty: existing.qty + 1,
                                  batch_serial: existingImeis.join(', '),
                                };
                                // Clear current row or remove if empty
                                const currentRow = next[idx];
                                if (!currentRow.description && !currentRow.imei && !currentRow.sku) {
                                  next.splice(idx, 1);
                                } else {
                                  next[idx] = { ...currentRow, batch_serial: '' };
                                }
                                setItems(next);
                              } else {
                                // New model — populate current row
                                const next = [...items];
                                next[idx] = {
                                  ...next[idx],
                                  description: next[idx].description || r.label,
                                  imei: r.imei || val,
                                  model_number: next[idx].model_number || matchedModel,
                                  sku: next[idx].sku || r.sku || '',
                                  rate: next[idx].rate || r.price || 0,
                                  batch_serial: val,
                                };
                                setItems(next);
                              }
                            }
                          } catch { /* ignore */ }
                        }}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        className="form-input text-xs text-center py-1.5"
                        min="1"
                        value={item.qty}
                        onChange={e => updateItem(idx, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        step="0.01"
                        className="form-input text-xs text-right py-1.5"
                        value={item.rate || ''}
                        onChange={e => updateItem(idx, 'rate', parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          className="form-input text-xs text-right py-1.5 w-[48%]"
                          placeholder="$0"
                          value={item.item_discount_amount || ''}
                          onChange={e => updateItem(idx, 'item_discount_amount', parseFloat(e.target.value) || 0)}
                        />
                        <span className="text-[10px] text-[var(--text-tertiary)]">or</span>
                        <input
                          type="number"
                          step="0.01"
                          className="form-input text-xs text-right py-1.5 w-[40%]"
                          placeholder="0%"
                          value={item.item_discount_percent || ''}
                          onChange={e => updateItem(idx, 'item_discount_percent', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </td>
                    <td className="p-2 text-right text-xs font-mono text-[var(--text-primary)]">
                      ${((item.rate * item.qty) - (item.item_discount_amount || 0) - ((item.item_discount_percent || 0) / 100 * item.rate * item.qty)).toFixed(2)}
                    </td>
                    <td className="p-2">
                      <button onClick={() => removeItem(idx)} className="text-[var(--text-tertiary)] hover:text-red-400">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {items.length === 0 && (
              <div className="text-center py-8 text-sm text-[var(--text-tertiary)]">
                No items yet. Click "Add Line Item" or scan a barcode.
              </div>
            )}
          </div>

          {/* Payments */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-[var(--bg-tertiary)]">
              <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Payments Received</p>
              <button onClick={addPayment} className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 font-medium">
                <Plus size={13} /> Split Payment
              </button>
            </div>
            {payments.length === 0 ? (
              <div className="px-5 py-4 text-center">
                <p className="text-xs text-[var(--text-tertiary)] mb-3">No payments recorded yet</p>
                <button onClick={addPayment} className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium mx-auto">
                  <Wallet size={12} /> Record Payment
                </button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider border-b border-[var(--border-primary)]">
                    <th className="text-left p-3">Method</th>
                    <th className="text-right p-3 w-28">Amount ($)</th>
                    <th className="text-left p-3 w-40">Reference</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-primary)]">
                  {payments.map((p, idx) => (
                    <tr key={idx}>
                      <td className="p-2">
                        <select className="form-input text-xs py-1.5" value={p.payment_method} onChange={e => updatePayment(idx, 'payment_method', e.target.value)}>
                          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </td>
                      <td className="p-2">
                        <input type="number" step="0.01" className="form-input text-xs text-right py-1.5" value={p.amount || ''} onChange={e => updatePayment(idx, 'amount', parseFloat(e.target.value) || 0)} />
                      </td>
                      <td className="p-2">
                        <input type="text" className="form-input text-xs py-1.5" placeholder="e.g. last 4 digits" value={p.reference_id} onChange={e => updatePayment(idx, 'reference_id', e.target.value)} />
                      </td>
                      <td className="p-2">
                        <button onClick={() => removePayment(idx)} className="text-[var(--text-tertiary)] hover:text-red-400"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {payments.length === 1 && payments[0].amount < total - 0.01 && total > 0 && (
              <div className="px-5 py-2 border-t border-[var(--border-primary)] bg-[var(--bg-tertiary)]/50">
                <button
                  onClick={() => updatePayment(0, 'amount', parseFloat(total.toFixed(2)))}
                  className="text-xs text-accent hover:text-accent/80 font-medium"
                >
                  Pay in Full (${total.toFixed(2)})
                </button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={handleEmailInvoice}
              className="card p-4 text-left hover:border-accent/30 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center mb-2 group-hover:bg-accent/20 transition-colors">
                <Mail size={14} className="text-accent" />
              </div>
              <p className="text-xs font-semibold text-[var(--text-primary)]">Email</p>
              <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">Email invoice to customer directly</p>
            </button>

            <button
              onClick={handlePrint}
              className="card p-4 text-left hover:border-accent/30 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center mb-2 group-hover:bg-accent/20 transition-colors">
                <Printer size={14} className="text-accent" />
              </div>
              <p className="text-xs font-semibold text-[var(--text-primary)]">Print</p>
              <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">Print or download as PDF</p>
            </button>

            <button className="card p-4 text-left hover:border-accent/30 transition-colors group">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center mb-2 group-hover:bg-accent/20 transition-colors">
                <Paperclip size={14} className="text-accent" />
              </div>
              <p className="text-xs font-semibold text-[var(--text-primary)]">Attachments</p>
              <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">Attach files or related documents</p>
            </button>
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="w-[340px] shrink-0 space-y-5">
          {/* Invoice Preview Card */}
          <div className="card overflow-hidden sticky top-5">
            <div className="px-4 py-3 bg-[var(--bg-tertiary)] border-b border-[var(--border-primary)]">
              <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">INVOICE PREVIEW</p>
            </div>

            <div className="p-5 space-y-4">
              {/* Company Info */}
              <div className="text-center space-y-1 pb-4 border-b border-[var(--border-primary)]">
                <p className="text-sm font-bold text-[var(--text-primary)]">AMAFH ELECTRONICS</p>
                <p className="text-[10px] text-[var(--text-tertiary)]">123 Business Ave, Suite 100</p>
                <p className="text-[10px] text-[var(--text-tertiary)]">Dallas, TX 75201 · Tax ID: XX-XXXXXXX</p>
              </div>

              {/* Bill To */}
              <div className="space-y-1">
                <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">Bill To</p>
                {selectedCustomer ? (
                  <>
                    <p className="text-xs font-semibold text-[var(--text-primary)]">
                      {selectedCustomer.company_name || `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim()}
                    </p>
                    <p className="text-[10px] text-[var(--text-tertiary)]">
                      {selectedCustomer.shipping_address || `${selectedCustomer.phone || ''}${selectedCustomer.email ? ` · ${selectedCustomer.email}` : ''}`}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-[var(--text-tertiary)] italic">Select a customer</p>
                )}
              </div>

              {/* Items Summary */}
              <div className="space-y-1.5 pt-2 border-t border-[var(--border-primary)]">
                {items.filter(i => i.description || i.imei || i.sku).slice(0, 4).map((item, i) => (
                  <div key={i} className="flex justify-between text-[10px]">
                    <span className="text-[var(--text-tertiary)] truncate max-w-[180px]">
                      {item.description || item.sku || item.imei} × {item.qty}
                    </span>
                    <span className="text-[var(--text-primary)] font-mono">${(item.rate * item.qty).toFixed(2)}</span>
                  </div>
                ))}
                {items.filter(i => i.description || i.imei || i.sku).length > 4 && (
                  <p className="text-[10px] text-[var(--text-tertiary)] italic">
                    +{items.filter(i => i.description || i.imei || i.sku).length - 4} more items
                  </p>
                )}
              </div>

              {/* Totals */}
              <div className="space-y-1.5 pt-2 border-t border-[var(--border-primary)]">
                <div className="flex justify-between text-[10px]">
                  <span className="text-[var(--text-tertiary)]">Subtotal</span>
                  <span className="text-[var(--text-primary)] font-mono">${subtotal.toFixed(2)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-[10px]">
                    <span className="text-[var(--text-tertiary)]">Discount</span>
                    <span className="text-red-400 font-mono">-${totalDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[10px]">
                  <span className="text-[var(--text-tertiary)]">Tax ({taxPercent}%)</span>
                  <span className="text-[var(--text-primary)] font-mono">${taxAmount.toFixed(2)}</span>
                </div>
                <hr className="border-[var(--border-primary)]" />
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-[var(--text-primary)]">Total</span>
                  <span className="text-[var(--text-primary)] font-mono">${total.toFixed(2)}</span>
                </div>
                {totalPaid > 0 && (
                  <div className="flex justify-between text-[10px] text-emerald-400">
                    <span>Paid</span>
                    <span className="font-mono">${totalPaid.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-red-400">Balance Due</span>
                  <span className="text-red-400 font-mono">${balanceDue.toFixed(2)}</span>
                </div>
              </div>

              {/* Terms */}
              <div className="text-[10px] text-[var(--text-tertiary)] pt-2 border-t border-[var(--border-primary)]">
                <p className="font-semibold uppercase mb-0.5">Terms</p>
                <input
                  type="text"
                  className="form-input text-[10px] py-1 px-2 w-full"
                  value={terms}
                  onChange={e => setTerms(e.target.value)}
                />
              </div>

              {/* Notes */}
              {messageOnInvoice && (
                <div className="text-[10px] text-[var(--text-tertiary)] pt-2 border-t border-[var(--border-primary)]">
                  <p className="font-semibold uppercase mb-0.5">Notes</p>
                  <p>{messageOnInvoice}</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="px-5 pb-5 space-y-2">
              {!isEdit && (
                <button
                  onClick={() => { setInvoiceStatus('Draft'); handleSave(); }}
                  disabled={saving}
                  className="w-full btn-secondary flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {saving && invoiceStatus === 'Draft' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save as Draft
                </button>
              )}
              <button
                onClick={() => { setInvoiceStatus('Active'); handleSave(); }}
                disabled={saving || !customerId || items.filter(i => i.description || i.imei).length === 0}
                className="w-full btn-primary flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : isEdit ? <Pencil size={16} /> : <Plus size={16} />}
                {isEdit ? 'Update Invoice' : 'Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings (hidden by default, shown via preview) */}
      <div className="grid grid-cols-4 gap-4" style={{ display: 'none' }}>
        {/* Hidden fields needed for form state */}
        <div className="form-group">
          <label className="form-label text-xs">Tax %</label>
          <input type="number" step="0.01" className="form-input" value={taxPercent} onChange={e => setTaxPercent(parseFloat(e.target.value) || 0)} />
        </div>
        <div className="form-group">
          <label className="form-label text-xs">Discount %</label>
          <input type="number" step="0.01" className="form-input" value={discountPercent} onChange={e => setDiscountPercent(parseFloat(e.target.value) || 0)} />
        </div>
        <div className="form-group">
          <label className="form-label text-xs">Discount Total</label>
          <input type="number" step="0.01" className="form-input" value={discountTotal} onChange={e => setDiscountTotal(parseFloat(e.target.value) || 0)} />
        </div>
        <div className="form-group">
          <label className="form-label text-xs">Currency</label>
          <select className="form-input" value={currency} onChange={e => setCurrency(e.target.value)}>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="CAD">CAD (C$)</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label text-xs">Fulfillment</label>
          <select className="form-input" value={fulfillmentMethod} onChange={e => setFulfillmentMethod(e.target.value)}>
            <option value="Walk-in">Walk-in</option>
            <option value="Pickup">Pickup</option>
            <option value="Delivery">Delivery</option>
            <option value="Shipping">Shipping</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label text-xs">Message on Invoice</label>
          <textarea className="form-input" rows={2} value={messageOnInvoice} onChange={e => setMessageOnInvoice(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label text-xs">Statement Memo</label>
          <input type="text" className="form-input" value={statementMemo} onChange={e => setStatementMemo(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label text-xs">Internal Notes</label>
          <textarea className="form-input" rows={2} value={internalNotes} onChange={e => setInternalNotes(e.target.value)} placeholder="Staff notes — not shown to customer" />
        </div>

      </div>
    </div>
  );
}
