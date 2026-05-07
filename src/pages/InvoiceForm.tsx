import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, Save, Plus, Trash2, Search, X, Building2, User, ArrowLeft, Wallet, CreditCard } from 'lucide-react';
import { createInvoice, fetchAutocomplete, InvoiceFormItem, AutocompleteResult, extractError, PAYMENT_METHODS } from '../api/invoices';
import { fetchCustomers, Customer } from '../api/crm';

interface PaymentRow {
  amount: number;
  payment_method: string;
  reference_id: string;
}

const emptyItem: InvoiceFormItem = { description: '', qty: 1, rate: 0, taxable: true };
const emptyPayment: PaymentRow = { amount: 0, payment_method: 'Cash', reference_id: '' };

export default function InvoiceForm() {
  const navigate = useNavigate();
  const [items, setItems] = useState<InvoiceFormItem[]>([{ ...emptyItem }]);
  const [customerId, setCustomerId] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [terms, setTerms] = useState('Due on Receipt');
  const [messageOnInvoice, setMessageOnInvoice] = useState('');
  const [statementMemo, setStatementMemo] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [taxPercent, setTaxPercent] = useState(8.5);
  const [fulfillmentMethod, setFulfillmentMethod] = useState('Walk-in');
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Autocomplete state per item index
  const [autocompleteIdx, setAutocompleteIdx] = useState<number | null>(null);
  const [autocompleteResults, setAutocompleteResults] = useState<AutocompleteResult[]>([]);
  const acRef = useRef<HTMLDivElement>(null);
  const acTimer = useRef<NodeJS.Timeout | null>(null);

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
    } catch {
      setCustomers([]);
    }
  }, []);

  const doAutocomplete = useCallback(async (q: string, idx: number) => {
    if (!q || q.length < 2) {
      setAutocompleteResults([]);
      setAutocompleteIdx(null);
      return;
    }
    setAutocompleteIdx(idx);
    try {
      const results = await fetchAutocomplete(q);
      setAutocompleteResults(results);
    } catch {
      setAutocompleteResults([]);
    }
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
      rate: result.price || 0,
      taxable: true,
    };
    setItems(next);
    setAutocompleteResults([]);
    setAutocompleteIdx(null);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (acRef.current && !acRef.current.contains(e.target as Node)) {
        setAutocompleteResults([]);
        setAutocompleteIdx(null);
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

  const subtotal = items.reduce((s, i) => s + i.rate * i.qty, 0);
  const discountAmount = discountPercent > 0 ? subtotal * (discountPercent / 100) : 0;
  const discountedSubtotal = subtotal - discountAmount;
  const taxAmount = discountedSubtotal * (taxPercent / 100);
  const total = discountedSubtotal + taxAmount;
  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const balanceDue = total - totalPaid;
  const isFullyPaid = totalPaid >= total - 0.01;
  const hasAnyPayment = payments.length > 0 && totalPaid > 0;

  const selectedCustomer = customers.find(c => c.crm_id === customerId);

  // Auto-fill remaining payment amount on new payment row
  useEffect(() => {
    if (payments.length === 1 && payments[0].amount === 0 && !payments[0].reference_id) {
      // Don't auto-fill — let user decide
    }
  }, [payments.length]);

  const handleSave = async () => {
    const validItems = items.filter(i => i.description || i.model_number || i.imei);
    if (validItems.length === 0) {
      setError('Add at least one line item');
      return;
    }
    if (!customerId) {
      setError('Select a customer');
      return;
    }
    // Filter out zero-amount payments
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
      await createInvoice({
        customer_id: customerId,
        items: validItems,
        terms,
        message_on_invoice: messageOnInvoice || undefined,
        statement_memo: statementMemo || undefined,
        discount_percent: discountPercent || 0,
        tax_percent: taxPercent,
        fulfillment_method: fulfillmentMethod,
        payments: validPayments,
      });
      navigate(`/admin/invoices`, { replace: true });
    } catch (err: any) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">New Invoice</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">Create a structured invoice with line items</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !customerId || items.filter(i => i.description || i.imei).length === 0}
          className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {hasAnyPayment ? (isFullyPaid ? 'Save & Close' : 'Save & Reserve') : 'Save Invoice'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle size={16} />{error}
        </div>
      )}

      {/* Customer Selection */}
      <div className="card p-4 space-y-3">
        <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Bill To</p>
        {selectedCustomer ? (
          <div className="flex items-center justify-between p-3 bg-accent/5 border border-accent/20 rounded-lg">
            <div className="flex items-center gap-2">
              {selectedCustomer.customer_type === 'Wholesale' ? <Building2 size={16} className="text-accent" /> : <User size={16} className="text-accent" />}
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {selectedCustomer.company_name || `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim()}
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">{selectedCustomer.phone}{selectedCustomer.email ? ` · ${selectedCustomer.email}` : ''}</p>
              </div>
            </div>
            <button onClick={() => { setCustomerId(''); setCustomerSearch(''); setCustomers([]); }} className="text-[var(--text-tertiary)] hover:text-red-400">
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              type="text"
              className="form-input pl-9"
              placeholder="Search customers by name, phone, or company..."
              value={customerSearch}
              onChange={e => searchCustomers(e.target.value)}
              onFocus={() => customers.length > 0 && setShowCustomerDropdown(true)}
            />
            {showCustomerDropdown && customers.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {customers.map(c => (
                  <button
                    key={c.crm_id}
                    className="w-full text-left px-4 py-2.5 hover:bg-[var(--bg-tertiary)] flex items-center justify-between"
                    onClick={() => { setCustomerId(c.crm_id); setShowCustomerDropdown(false); }}
                  >
                    <div className="flex items-center gap-2">
                      {c.customer_type === 'Wholesale' ? <Building2 size={14} className="text-[var(--text-tertiary)]" /> : <User size={14} className="text-[var(--text-tertiary)]" />}
                      <div>
                        <p className="text-sm text-[var(--text-primary)]">{c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim()}</p>
                        <p className="text-xs text-[var(--text-tertiary)]">{c.phone}{c.email ? ` · ${c.email}` : ''}</p>
                      </div>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]">{c.customer_type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-tertiary)]">
          <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Line Items</p>
          <button onClick={addItem} className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 font-medium">
            <Plus size={14} /> Add Line
          </button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider border-b border-[var(--border-primary)]">
              <th className="text-left p-3 w-5/12">Item / Description</th>
              <th className="text-center p-3 w-1/12">Qty</th>
              <th className="text-right p-3 w-2/12">Rate ($)</th>
              <th className="text-right p-3 w-2/12">Amount</th>
              <th className="text-center p-3 w-1/12">Tax</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-primary)]">
            {items.map((item, idx) => (
              <tr key={idx} className="relative">
                <td className="p-2">
                  <div ref={autocompleteIdx === idx ? acRef : undefined} className="relative">
                    <input
                      type="text"
                      className="form-input text-sm py-1.5"
                      placeholder="Search IMEI, model, part or type description..."
                      value={item.description || ''}
                      onChange={e => handleItemDescChange(idx, e.target.value)}
                    />
                    {autocompleteIdx === idx && autocompleteResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg shadow-xl max-h-48 overflow-y-auto">
                        {autocompleteResults.map((r, ri) => (
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
                    type="number"
                    className="form-input text-sm text-center py-1.5"
                    min="1"
                    value={item.qty}
                    onChange={e => updateItem(idx, 'qty', parseInt(e.target.value) || 0)}
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    step="0.01"
                    className="form-input text-sm text-right py-1.5"
                    value={item.rate}
                    onChange={e => updateItem(idx, 'rate', parseFloat(e.target.value) || 0)}
                  />
                </td>
                <td className="p-2 text-right text-[var(--text-primary)] font-mono text-xs">
                  ${(item.rate * item.qty).toFixed(2)}
                </td>
                <td className="p-2 text-center">
                  <button
                    onClick={() => updateItem(idx, 'taxable', !item.taxable)}
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-colors ${
                      item.taxable ? 'bg-accent/20 text-accent' : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
                    }`}
                  >
                    {item.taxable ? 'Tax' : '—'}
                  </button>
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
          <div className="text-center py-8 text-sm text-[var(--text-tertiary)]">No items yet. Click "Add Line" to start.</div>
        )}
      </div>

      {/* Payments */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-tertiary)]">
          <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Payments Received</p>
          <button onClick={addPayment} className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 font-medium">
            <Plus size={14} /> Split Payment
          </button>
        </div>

        {payments.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-[var(--text-tertiary)] mb-3">No payments yet — invoice will be created as Unpaid</p>
            <button onClick={addPayment} className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium mx-auto">
              <Wallet size={13} /> Add Payment
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider border-b border-[var(--border-primary)]">
                <th className="text-left p-3">Method</th>
                <th className="text-right p-3 w-32">Amount ($)</th>
                <th className="text-left p-3 w-40">Reference</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-primary)]">
              {payments.map((p, idx) => (
                <tr key={idx}>
                  <td className="p-2">
                    <select
                      className="form-input text-sm py-1.5"
                      value={p.payment_method}
                      onChange={e => updatePayment(idx, 'payment_method', e.target.value)}
                    >
                      {PAYMENT_METHODS.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="0.01"
                      className="form-input text-sm text-right py-1.5"
                      placeholder="0.00"
                      value={p.amount || ''}
                      onChange={e => updatePayment(idx, 'amount', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      className="form-input text-sm py-1.5"
                      placeholder="e.g. last 4 digits..."
                      value={p.reference_id}
                      onChange={e => updatePayment(idx, 'reference_id', e.target.value)}
                    />
                  </td>
                  <td className="p-2">
                    <button onClick={() => removePayment(idx)} className="text-[var(--text-tertiary)] hover:text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Quick-fill: Pay in Full */}
        {payments.length === 1 && totalPaid < total - 0.01 && total > 0 && (
          <div className="px-4 py-2 border-t border-[var(--border-primary)]">
            <button
              onClick={() => updatePayment(0, 'amount', parseFloat(total.toFixed(2)))}
              className="text-xs text-accent hover:text-accent/80 font-medium"
            >
              <CreditCard size={12} className="inline mr-1" />
              Pay in Full (${total.toFixed(2)})
            </button>
          </div>
        )}
      </div>

      {/* Settings + Summary */}
      <div className="grid grid-cols-2 gap-5">
        {/* Settings */}
        <div className="card p-4 space-y-3">
          <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Settings</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label text-xs">Tax %</label>
              <input type="number" step="0.01" className="form-input" value={taxPercent} onChange={e => setTaxPercent(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="form-group">
              <label className="form-label text-xs">Discount %</label>
              <input type="number" step="0.01" className="form-input" value={discountPercent} onChange={e => setDiscountPercent(parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label text-xs">Terms</label>
            <input type="text" className="form-input" value={terms} onChange={e => setTerms(e.target.value)} />
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
        </div>

        {/* Totals */}
        <div className="card p-4 space-y-2 self-start">
          <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Summary</p>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-tertiary)]">Subtotal</span>
            <span className="text-[var(--text-primary)]">${subtotal.toFixed(2)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-tertiary)]">Discount ({discountPercent}%)</span>
              <span className="text-red-400">-${discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-tertiary)]">Tax ({taxPercent}%)</span>
            <span className="text-[var(--text-primary)]">${taxAmount.toFixed(2)}</span>
          </div>
          <hr className="border-[var(--border-primary)]" />
          <div className="flex justify-between font-bold text-[var(--text-primary)]">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
          {hasAnyPayment && (
            <>
              <div className="flex justify-between text-sm text-emerald-400">
                <span>Paid</span>
                <span>${totalPaid.toFixed(2)}</span>
              </div>
              <hr className="border-[var(--border-primary)]" />
            </>
          )}
          <div className="flex justify-between text-sm font-bold">
            <span className="text-[var(--text-tertiary)]">Balance Due</span>
            <span className={balanceDue > 0.01 ? 'text-red-400' : 'text-emerald-400'}>${balanceDue.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
