import { useState, useEffect, useCallback } from 'react';
import { Plus, Loader2, AlertCircle, Package, ChevronDown, Truck, Calendar, X } from 'lucide-react';
import api from '../api/api';

interface POItem {
  id: number;
  sku: string | null;
  description: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  total_cost: number;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: number;
  supplier_name: string;
  store_id: string | null;
  status: string;
  expected_date: string | null;
  received_date: string | null;
  total_cost: number;
  shipping_cost: number;
  tax_cost: number;
  notes: string | null;
  created_by_email: string | null;
  created_at: string;
  items: POItem[];
  received_count: number;
  total_count: number;
}

interface Supplier {
  id: number;
  name: string;
}

const STATUS_LABELS: Record<string, string> = {
  'Draft': 'Draft',
  'Ordered': 'Ordered',
  'Partially_Received': 'Partially Received',
  'Received': 'Received',
  'Cancelled': 'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  'Draft': 'bg-gray-50 text-gray-700',
  'Ordered': 'bg-blue-50 text-blue-700',
  'Partially_Received': 'bg-yellow-50 text-yellow-700',
  'Received': 'bg-green-50 text-green-700',
  'Cancelled': 'bg-red-50 text-red-700',
};

export default function PurchaseOrders() {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [supplierId, setSupplierId] = useState(0);
  const [expectedDate, setExpectedDate] = useState('');
  const [shippingCost, setShippingCost] = useState('');
  const [items, setItems] = useState([{ description: '', sku: '', quantity_ordered: 1, unit_cost: 0 }]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [receiving, setReceiving] = useState<Record<number, number>>({});
  const [receiveError, setReceiveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: poData }, { data: supData }] = await Promise.all([
        api.get('/api/po/'),
        api.get('/api/parts/suppliers'),
      ]);
      setPos(Array.isArray(poData) ? poData : []);
      setSuppliers(Array.isArray(supData) ? supData : []);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const addItem = () => setItems(prev => [...prev, { description: '', sku: '', quantity_ordered: 1, unit_cost: 0 }]);

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const handleCreate = async () => {
    if (!supplierId) { setFormError('Select a supplier'); return; }
    const valid = items.filter(i => i.description.trim());
    if (valid.length === 0) { setFormError('Add at least one item'); return; }
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post('/api/po/', {
        supplier_id: supplierId,
        expected_date: expectedDate || null,
        shipping_cost: shippingCost ? parseFloat(shippingCost) : 0,
        items: valid.map(i => ({ ...i, sku: i.sku || null })),
        notes: notes || null,
      });
      setShowModal(false);
      resetForm();
      load();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || 'Failed to create PO');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceive = async (poId: string) => {
    if (!Object.keys(receiving).length) return;
    setReceiveError(null);
    const receiveItems = Object.entries(receiving)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, qty]) => ({ item_id: parseInt(itemId), qty }));
    if (!receiveItems.length) return;
    try {
      await api.post(`/api/po/${poId}/receive`, receiveItems);
      setReceiving({});
      load();
    } catch (err: any) {
      setReceiveError(err.response?.data?.detail || 'Failed to receive items');
    }
  };

  const handleCancel = async (poId: string) => {
    try {
      await api.post(`/api/po/${poId}/cancel`);
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to cancel PO');
    }
  };

  const resetForm = () => {
    setSupplierId(0);
    setExpectedDate('');
    setShippingCost('');
    setItems([{ description: '', sku: '', quantity_ordered: 1, unit_cost: 0 }]);
    setNotes('');
    setFormError(null);
  };

  const fm = (n: number) => `$${n.toFixed(2)}`;

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-[var(--text-tertiary)]" /></div>;
  }

  if (error) {
    return <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4"><AlertCircle size={16} /> {error}</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Purchase Orders</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">Create and track supplier POs</p>
        </div>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={16} /> New PO
        </button>
      </div>

      {pos.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-tertiary)]">
          <Truck size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No purchase orders</p>
          <p className="text-xs mt-1">Click "New PO" to create one</p>
        </div>
      ) : (
        <div className="card">
          <table className="table-standard">
            <thead>
              <tr>
                <th className="w-10" />
                <th>PO #</th>
                <th>Supplier</th>
                <th>Status</th>
                <th className="text-right">Items</th>
                <th className="text-right">Total</th>
                <th>Date</th>
                <th className="w-40">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pos.map(po => {
                const isOpen = expanded.has(po.id);
                return (
                  <>
                    <tr key={po.id} onClick={() => toggleExpand(po.id)} className="cursor-pointer hover:bg-[var(--bg-muted)]">
                      <td><ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''} text-[var(--text-tertiary)]`} /></td>
                      <td className="font-mono text-xs font-semibold">{po.po_number}</td>
                      <td className="text-sm">{po.supplier_name}</td>
                      <td>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${STATUS_COLORS[po.status] || 'bg-gray-50 text-gray-700'}`}>
                          {STATUS_LABELS[po.status] || po.status}
                        </span>
                      </td>
                      <td className="text-right text-sm">
                        {po.received_count}/{po.total_count}
                      </td>
                      <td className="text-right font-medium">{fm(po.total_cost)}</td>
                      <td className="text-xs text-[var(--text-secondary)]">
                        {po.created_at ? new Date(po.created_at).toLocaleDateString() : '-'}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          {po.status !== 'Received' && po.status !== 'Cancelled' && (
                            <>
                              {Object.keys(receiving).length > 0 && po.id === Object.keys(receiving)[0] ? (
                                <button onClick={e => { e.stopPropagation(); handleReceive(po.id); }}
                                  className="btn-primary text-[10px] px-2 py-1 rounded font-medium">Confirm</button>
                              ) : null}
                              <button onClick={e => { e.stopPropagation(); handleCancel(po.id); }}
                                className="btn-danger text-[10px] px-2 py-1 rounded font-medium">Cancel</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isOpen && po.items.map((item, idx) => (
                      <tr key={item.id || idx} className="bg-[var(--bg-muted)] text-xs">
                        <td />
                        <td colSpan={2} className="pl-10">{item.description}</td>
                        <td className="text-[10px] text-[var(--text-tertiary)]">Ordered: {item.quantity_ordered} · Unit: {fm(item.unit_cost)}</td>
                        <td className="text-right">{item.quantity_received}/{item.quantity_ordered}</td>
                        <td className="text-right font-mono">{fm(item.total_cost)}</td>
                        <td />
                        <td>
                          {po.status !== 'Received' && po.status !== 'Cancelled' && item.quantity_received < item.quantity_ordered && (
                            <input
                              type="number"
                              min="0"
                              max={item.quantity_ordered - item.quantity_received}
                              className="form-input text-[10px] py-0.5 px-1 w-14 text-center"
                              placeholder="Recv"
                              value={receiving[item.id] || ''}
                              onChange={e => {
                                const v = parseInt(e.target.value) || 0;
                                setReceiving(prev => ({ ...prev, [item.id]: Math.min(v, item.quantity_ordered - item.quantity_received) }));
                              }}
                              onClick={e => e.stopPropagation()}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {receiveError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
          <AlertCircle size={16} /> {receiveError}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <Package size={18} className="text-[var(--accent)]" />
                <h2 className="text-base font-bold text-[var(--text)]">New Purchase Order</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="text-[var(--text-tertiary)] hover:text-[var(--text)]">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body space-y-4">
              {formError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
                  <AlertCircle size={16} /> {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Supplier *</label>
                <select className="form-select text-sm w-full" value={supplierId} onChange={e => setSupplierId(parseInt(e.target.value))}>
                  <option value={0}>Select supplier...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    <Calendar size={12} className="inline mr-1" /> Expected Date
                  </label>
                  <input type="date" className="form-input text-sm w-full" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Shipping Cost</label>
                  <input type="number" step="0.01" min="0" className="form-input text-sm w-full" placeholder="0.00" value={shippingCost} onChange={e => setShippingCost(e.target.value)} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[var(--text-secondary)]">Items</label>
                  <button onClick={addItem} className="text-[10px] text-[var(--accent)] font-medium hover:underline">+ Add Item</button>
                </div>
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        className="form-input text-xs flex-1"
                        placeholder="Description"
                        value={item.description}
                        onChange={e => updateItem(idx, 'description', e.target.value)}
                      />
                      <input
                        type="text"
                        className="form-input text-xs w-24"
                        placeholder="SKU"
                        value={item.sku}
                        onChange={e => updateItem(idx, 'sku', e.target.value)}
                      />
                      <input
                        type="number"
                        min="1"
                        className="form-input text-xs w-16 text-center"
                        value={item.quantity_ordered}
                        onChange={e => updateItem(idx, 'quantity_ordered', parseInt(e.target.value) || 1)}
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input text-xs w-20 text-center"
                        placeholder="Cost"
                        value={item.unit_cost || ''}
                        onChange={e => updateItem(idx, 'unit_cost', parseFloat(e.target.value) || 0)}
                      />
                      <button onClick={() => removeItem(idx)} className="text-[var(--text-tertiary)] hover:text-[var(--destructive)] text-xs">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Notes</label>
                <textarea className="form-input text-sm w-full resize-none" rows={2} placeholder="PO notes..." value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} className="btn-ghost text-sm px-4 py-2 rounded-lg">Cancel</button>
              <button onClick={handleCreate} disabled={submitting} className="btn-primary text-sm px-5 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
                {submitting ? 'Creating...' : 'Create PO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
