import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, Save, Plus, Trash2, Search, X, Building2, User, ArrowLeft } from 'lucide-react';
import { createInvoice, fetchAutocomplete, InvoiceFormItem, AutocompleteResult, extractError } from '../api/invoices';
import { fetchCustomers, Customer } from '../api/crm';

const emptyItem: InvoiceFormItem = { description: '', qty: 1, rate: 0, taxable: true };

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Autocomplete state per item index
  const [autocompleteIdx, setAutocompleteIdx] = useState<number | null>(null);
  const [autocompleteResults, setAutocompleteResults] = useState<AutocompleteResult[]>([]);
  const acRef = useRef<HTMLDivElement>(null);
  const acTimer = useRef<NodeJS.Timeout | null>(null);

  // Load customers on search
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

  // Autocomplete search
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

  // Debounced autocomplete
  const handleItemDescChange = useCallback((idx: number, value: string) => {
    const next = [...items];
    next[idx] = { ...next[idx], description: value };
    setItems(next);

    if (acTimer.current) clearTimeout(acTimer.current);
    acTimer.current = setTimeout(() => doAutocomplete(value, idx), 250);
  }, [items, doAutocomplete]);

  // Select autocomplete result
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

  // Close autocomplete on click outside
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

  const subtotal = items.reduce((s, i) => s + i.rate * i.qty, 0);
  const discountAmount = discountPercent > 0 ? subtotal * (discountPercent / 100) : 0;
  const discountedSubtotal = subtotal - discountAmount;
  const taxAmount = discountedSubtotal * (taxPercent / 100);
  const total = discountedSubtotal + taxAmount;

  const selectedCustomer = customers.find(c => c.crm_id === customerId);

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
    setSaving(true);
    setError(null);
    try {
      const payload = {
        customer_id: customerId,
        items: validItems,
        terms,
        message_on_invoice: messageOnInvoice || undefined,
        statement_memo: statementMemo || undefined,
        discount_percent: discountPercent || 0,
        tax_percent: taxPercent,
        fulfillment_method: fulfillmentMethod,
        payments: [],
      };
      await createInvoice(payload);
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
          Save Invoice
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
                <p className="text-xs text-[var(--text-tertiary)]">{selectedCustomer.phone}</p>
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

      {/* Summary & Settings */}
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
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-tertiary)]">Balance Due</span>
            <span className="text-accent font-bold">${total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
