import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Loader2, AlertCircle, Save, ArrowLeft, Plus, Trash2, Search, CheckCircle2,
  PackageOpen, Smartphone, X
} from 'lucide-react';
import {
  fetchConsignees, fetchBatch, createBatch, settleBatch,
  ConsignmentBatch, ConsignmentItemCreate, Customer, SettleItem
} from '../api/crm';

interface LocalItem extends ConsignmentItemCreate {
  id: string; // temp client-side id
}

export default function ConsignmentDetail() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const isNew = batchId === 'new';

  // For new batch creation
  const [consignees, setConsignees] = useState<Customer[]>([]);
  const [consigneeSearch, setConsigneeSearch] = useState('');
  const [showConsigneeSearch, setShowConsigneeSearch] = useState(false);
  const [selectedConsignee, setSelectedConsignee] = useState<Customer | null>(null);
  const [items, setItems] = useState<LocalItem[]>([]);
  const [notes, setNotes] = useState('');

  // For viewing/settling
  const [batch, setBatch] = useState<ConsignmentBatch | null>(null);
  const [settleItems, setSettleItems] = useState<Record<number, { outcome: 'sold' | 'returned'; settled_qty: number; returned_qty: number }>>({});

  // Payment
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [skipQc, setSkipQc] = useState(false);

  // State
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load batch if editing
  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const b = await fetchBatch(batchId!);
      setBatch(b);
      if (b.status === 'active') {
        const initial: Record<number, any> = {};
        b.items.forEach(item => {
          initial[item.id] = { outcome: 'sold', settled_qty: item.quantity, returned_qty: 0 };
        });
        setSettleItems(initial);
        // Default payment amount to total
        const total = b.items
          .filter(item => initial[item.id]?.outcome !== 'returned')
          .reduce((sum, item) => sum + item.unit_price * (item.quantity), 0);
        setPaymentAmount(total);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load batch');
    } finally {
      setLoading(false);
    }
  }, [batchId, isNew]);

  useEffect(() => { load(); }, [load]);

  // Search consignees
  const searchConsignees = async (q: string) => {
    setConsigneeSearch(q);
    if (q.length < 1) { setConsignees([]); return; }
    try {
      const results = await fetchConsignees(q);
      setConsignees(results);
    } catch {}
  };

  // Add item to new batch
  const addItem = () => {
    setItems(prev => [...prev, {
      id: crypto.randomUUID(),
      imei: '',
      sku: '',
      description: '',
      quantity: 1,
      unit_price: 0,
    }]);
  };

  const updateItem = (id: string, field: string, value: any) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  // Create new handoff
  const handleCreate = async () => {
    if (!selectedConsignee) { setError('Select a consignee'); return; }
    if (items.length === 0) { setError('Add at least one item'); return; }
    setSaving(true);
    setError(null);
    try {
      const cleanItems = items.map(({ id, ...rest }) => ({
        ...rest,
        imei: rest.imei || undefined,
        sku: rest.sku || undefined,
      }));
      const b = await createBatch({
        crm_id: selectedConsignee.crm_id,
        items: cleanItems,
        notes: notes || undefined,
      });
      setSuccess('Consignment handoff created');
      navigate(`/admin/consignments/${b.id}`, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create handoff');
    } finally {
      setSaving(false);
    }
  };

  // Settle batch
  const handleSettle = async () => {
    if (!batch) return;
    setSaving(true);
    setError(null);
    try {
      const sitems: SettleItem[] = [];
      let invoiceTotal = 0;

      Object.entries(settleItems).forEach(([idStr, val]) => {
        const id = parseInt(idStr);
        const item = batch.items.find(i => i.id === id);
        if (!item || val.outcome === ('pending' as any)) return;

        if (val.outcome === 'sold') {
          invoiceTotal += item.unit_price * (val.settled_qty || item.quantity);
        }

        sitems.push({
          item_id: id,
          outcome: val.outcome,
          settled_qty: val.outcome === 'sold' ? (val.settled_qty || item.quantity) : undefined,
          returned_qty: val.outcome === 'returned' ? (val.returned_qty || item.quantity) : undefined,
        });
      });

      if (sitems.length === 0) { setError('No items to settle'); setSaving(false); return; }

      const result = await settleBatch(batch.id, {
        items: sitems,
        payment_method: paymentAmount > 0 ? paymentMethod as any : undefined,
        payment_amount: paymentAmount > 0 ? paymentAmount : undefined,
        skip_qc: skipQc,
        notes: undefined,
      });

      setBatch(result);
      setSuccess('Batch settled successfully');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to settle batch');
    } finally {
      setSaving(false);
    }
  };

  // Update settle item
  const updateSettleItem = (itemId: number, field: string, value: any) => {
    setSettleItems(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value }
    }));
  };

  const paymentMethods = ['Cash', 'Credit Card', 'Wire', 'Zelle', 'On Terms'];

  // ── New Batch Form ────────────────────────────────────────────────────
  if (isNew) {
    return (
      <div className="space-y-5 max-w-3xl">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">New Consignment Handoff</h1>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            <AlertCircle size={16} />{error}
          </div>
        )}

        {/* Consignee Selection */}
        <div className="card space-y-3">
          <label className="form-label">Select Consignee</label>
          {selectedConsignee ? (
            <div className="flex items-center justify-between p-3 rounded-lg bg-accent/10 border border-accent/30">
              <div>
                <div className="font-medium text-[var(--text-primary)] text-sm">
                  {selectedConsignee.company_name}
                </div>
                <div className="text-xs text-[var(--text-tertiary)]">
                  {selectedConsignee.contact_person} · {selectedConsignee.phone}
                </div>
              </div>
              <button onClick={() => setSelectedConsignee(null)} className="text-[var(--text-tertiary)] hover:text-red-400">
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                  <input
                    type="text"
                    className="form-input pl-9"
                    placeholder="Search consignee by name..."
                    value={consigneeSearch}
                    onChange={e => searchConsignees(e.target.value)}
                    onFocus={() => setShowConsigneeSearch(true)}
                  />
                </div>
              </div>
              {showConsigneeSearch && consignees.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {consignees.map(c => (
                    <button
                      key={c.crm_id}
                      className="w-full text-left px-4 py-2.5 hover:bg-[var(--bg-hover)] text-sm text-[var(--text-primary)] border-b border-[var(--border-secondary)] last:border-0"
                      onClick={() => {
                        setSelectedConsignee(c);
                        setShowConsigneeSearch(false);
                        setConsigneeSearch('');
                      }}
                    >
                      <div className="font-medium">{c.company_name}</div>
                      <div className="text-xs text-[var(--text-tertiary)]">{c.contact_person} · {c.phone}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Items */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Items in this handoff</h3>
            <button onClick={addItem} className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium">
              <Plus size={14} /> Add Item
            </button>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)] text-center py-4">No items added yet</p>
          ) : (
            <div className="space-y-3">
              {items.map(item => (
                <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-secondary)]">
                  <div className="flex-1 grid grid-cols-5 gap-2">
                    <input
                      type="text"
                      className="form-input text-xs col-span-1"
                      placeholder="IMEI (optional)"
                      value={item.imei || ''}
                      onChange={e => updateItem(item.id, 'imei', e.target.value)}
                    />
                    <input
                      type="text"
                      className="form-input text-xs col-span-1"
                      placeholder="SKU (optional)"
                      value={item.sku || ''}
                      onChange={e => updateItem(item.id, 'sku', e.target.value)}
                    />
                    <input
                      type="text"
                      className="form-input text-xs"
                      placeholder="Description"
                      value={item.description}
                      onChange={e => updateItem(item.id, 'description', e.target.value)}
                    />
                    <input
                      type="number"
                      className="form-input text-xs"
                      placeholder="Qty"
                      min="1"
                      value={item.quantity}
                      onChange={e => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                    />
                    <input
                      type="number"
                      step="0.01"
                      className="form-input text-xs"
                      placeholder="Unit Price"
                      value={item.unit_price || ''}
                      onChange={e => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <button onClick={() => removeItem(item.id)} className="text-[var(--text-tertiary)] hover:text-red-400 mt-1 flex-shrink-0">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="card">
          <label className="form-label">Notes</label>
          <textarea className="form-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        <button
          onClick={handleCreate}
          disabled={saving || !selectedConsignee || items.length === 0}
          className="btn-primary flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Create Handoff
        </button>
      </div>
    );
  }

  // ── Batch Detail View ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={28} className="animate-spin text-[var(--text-tertiary)]" />
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="card text-center py-16">
        <PackageOpen size={48} className="mx-auto text-[var(--text-tertiary)] mb-3 opacity-30" />
        <p className="text-[var(--text-secondary)] font-medium">Batch not found</p>
      </div>
    );
  }

  const isSettled = batch.status === 'settled';
  const activeItems = batch.items.filter(i => i.outcome === 'pending').length;
  const totalItems = batch.items.length;
  const totalQty = batch.items.reduce((s, i) => s + i.quantity, 0);
  const totalValue = batch.items.reduce((s, i) => s + i.unit_price * i.quantity, 0);

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-bold text-[var(--text-primary)] font-mono">{batch.id}</h1>
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
          isSettled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
        }`}>
          {batch.status}
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle size={16} />{error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">{success}</div>
      )}

      {/* Batch Info */}
      <div className="grid grid-cols-4 gap-3">
        <div className="card p-3">
          <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Customer</div>
          <div className="text-sm font-medium text-[var(--text-primary)] mt-0.5">
            {batch.customer?.company_name || batch.crm_id}
          </div>
        </div>
        <div className="card p-3">
          <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Handoff</div>
          <div className="text-sm font-medium text-[var(--text-primary)] mt-0.5">
            {new Date(batch.handoff_date).toLocaleDateString()}
          </div>
        </div>
        <div className="card p-3">
          <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Due Date</div>
          <div className={`text-sm font-medium mt-0.5 ${!isSettled && new Date(batch.due_date) < new Date() ? 'text-red-400' : 'text-[var(--text-primary)]'}`}>
            {new Date(batch.due_date).toLocaleDateString()}
          </div>
        </div>
        <div className="card p-3">
          <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Total Value</div>
          <div className="text-sm font-mono font-bold text-[var(--text-primary)] mt-0.5">
            ${totalValue.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="card overflow-hidden">
        <div className="card-header px-5 py-3 border-b border-[var(--border-primary)]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Items ({totalItems} items, {totalQty} total qty)
            </h3>
            {!isSettled && activeItems > 0 && (
              <span className="text-xs text-amber-400">{activeItems} pending settlement</span>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="table-standard">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Total</th>
                <th>Outcome</th>
                {!isSettled && <th className="w-48">Settlement</th>}
              </tr>
            </thead>
            <tbody>
              {batch.items.map(item => {
                const s = settleItems[item.id];
                return (
                  <tr key={item.id} className={item.outcome !== 'pending' ? 'opacity-60' : ''}>
                    <td>
                      <div className="flex items-center gap-2">
                        {item.imei ? <Smartphone size={14} className="text-[var(--text-tertiary)]" /> : <PackageOpen size={14} className="text-[var(--text-tertiary)]" />}
                        <div>
                          <div className="text-sm text-[var(--text-primary)]">{item.description}</div>
                          <div className="text-xs text-[var(--text-tertiary)] font-mono">
                            {item.imei || item.sku || ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="text-sm text-[var(--text-primary)]">{item.quantity}</td>
                    <td className="text-sm font-mono text-[var(--text-primary)]">${item.unit_price.toFixed(2)}</td>
                    <td className="text-sm font-mono font-medium text-[var(--text-primary)]">
                      ${(item.unit_price * item.quantity).toFixed(2)}
                    </td>
                    <td>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        item.outcome === 'sold' ? 'bg-emerald-500/10 text-emerald-400'
                          : item.outcome === 'returned' ? 'bg-blue-500/10 text-blue-400'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {item.outcome}
                        {item.outcome === 'sold' && item.settled_qty !== item.quantity && ` (${item.settled_qty})`}
                        {item.outcome === 'returned' && item.returned_qty !== item.quantity && ` (${item.returned_qty})`}
                      </span>
                    </td>
                    {!isSettled && (
                      <td>
                        {item.outcome === 'pending' && s && (
                          <div className="flex items-center gap-2">
                            <select
                              className="form-input text-xs py-1 px-2"
                              value={s.outcome}
                              onChange={e => updateSettleItem(item.id, 'outcome', e.target.value)}
                            >
                              <option value="sold">Sold</option>
                              <option value="returned">Returned</option>
                            </select>
                            {item.quantity > 1 && (
                              <input
                                type="number"
                                className="form-input text-xs w-16 py-1 px-2"
                                min="0"
                                max={item.quantity}
                                value={s.outcome === 'sold' ? (s.settled_qty || item.quantity) : (s.returned_qty || item.quantity)}
                                onChange={e => {
                                  const v = parseInt(e.target.value) || 0;
                                  if (s.outcome === 'sold') updateSettleItem(item.id, 'settled_qty', v);
                                  else updateSettleItem(item.id, 'returned_qty', v);
                                }}
                              />
                            )}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settlement Controls */}
      {!isSettled && (
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Settlement</h3>

          <div className="grid grid-cols-3 gap-4">
            <div className="form-group">
              <label className="form-label">Payment Method</label>
              <select
                className="form-input"
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
              >
                {paymentMethods.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Payment Amount ($)</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={paymentAmount || ''}
                onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="form-group flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipQc}
                  onChange={e => setSkipQc(e.target.checked)}
                  className="rounded border-[var(--border-primary)] bg-[var(--bg-tertiary)] text-accent"
                />
                <span className="form-label mb-0">Skip QC for returns</span>
              </label>
            </div>
          </div>

          <button
            onClick={handleSettle}
            disabled={saving}
            className="btn-primary flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Settle Batch & Create Invoice
          </button>
        </div>
      )}
    </div>
  );
}
