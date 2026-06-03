import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Loader2, AlertCircle, Mail, Phone, Calendar, FileText, DollarSign, Star, X, Edit, Package } from 'lucide-react';
import api from '../api/api';

interface Supplier {
  id: number;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  payment_terms: string | null;
  lead_time_days: number | null;
  notes: string | null;
  is_active: number | null;
}

interface SupplierPricing {
  id: number;
  supplier_id: number;
  sku: string;
  supplier_sku: string | null;
  unit_cost: number;
  moq: number;
  lead_time_days: number;
  is_preferred: number;
  last_updated: string;
}

const DEFAULT_SUPPLIER: Supplier = {
  id: 0, name: '', contact_email: null, contact_phone: null,
  payment_terms: 'Net 30', lead_time_days: 7, notes: null, is_active: 1,
};

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Supplier>({ ...DEFAULT_SUPPLIER });
  const [isNew, setIsNew] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [pricing, setPricing] = useState<SupplierPricing[]>([]);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [newPricing, setNewPricing] = useState({ sku: '', supplier_sku: '', unit_cost: '', moq: '1', lead_time_days: '7', is_preferred: 0 });
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/parts/suppliers');
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load suppliers');
    } finally { setLoading(false); }
  }, []);

  const loadPricing = useCallback(async (supplierId: number) => {
    setPricingLoading(true);
    try {
      const { data } = await api.get('/api/parts/supplier-pricing', { params: { supplier_id: supplierId } });
      setPricing(Array.isArray(data) ? data : []);
    } catch { setPricing([]); }
    finally { setPricingLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setIsNew(true); setEditing({ ...DEFAULT_SUPPLIER }); setFormError(null); setShowModal(true); };
  const openEdit = (s: Supplier) => { setIsNew(false); setEditing({ ...s }); setFormError(null); setShowModal(true); };

  const handleSave = async () => {
    if (!editing.name.trim()) { setFormError('Name is required'); return; }
    setSaving(true);
    setFormError(null);
    try {
      if (isNew) {
        await api.post('/api/parts/suppliers', editing);
      } else {
        await api.put(`/api/parts/suppliers/${editing.id}`, editing);
      }
      setShowModal(false);
      load();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const selectSupplier = (s: Supplier) => { setSelectedSupplier(s); loadPricing(s.id); };

  const addPricing = async () => {
    if (!selectedSupplier) return;
    if (!newPricing.sku.trim()) { setPricingError('SKU is required'); return; }
    setPricingSaving(true);
    setPricingError(null);
    try {
      await api.post('/api/parts/supplier-pricing', {
        supplier_id: selectedSupplier.id,
        sku: newPricing.sku.trim(),
        supplier_sku: newPricing.supplier_sku.trim() || null,
        unit_cost: parseFloat(newPricing.unit_cost) || 0,
        moq: parseInt(newPricing.moq) || 1,
        lead_time_days: parseInt(newPricing.lead_time_days) || 7,
        is_preferred: newPricing.is_preferred,
      });
      setShowPricingModal(false);
      setNewPricing({ sku: '', supplier_sku: '', unit_cost: '', moq: '1', lead_time_days: '7', is_preferred: 0 });
      loadPricing(selectedSupplier.id);
    } catch (err: any) {
      setPricingError(err.response?.data?.detail || 'Failed to add pricing');
    } finally { setPricingSaving(false); }
  };

  const deletePricing = async (id: number) => {
    if (!selectedSupplier) return;
    try {
      await api.delete(`/api/parts/supplier-pricing/${id}`);
      loadPricing(selectedSupplier.id);
    } catch {}
  };

  const filtered = search ? suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase())) : suppliers;
  const fm = (n: number) => `$${n.toFixed(2)}`;

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-[var(--text-tertiary)]" /></div>;
  if (error) return <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4"><AlertCircle size={16} /> {error}</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Suppliers</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">Manage vendors and their pricing</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={16} /> Add Supplier
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input className="form-input pl-9 text-sm w-full" placeholder="Search suppliers..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_2fr] gap-5">
        <div className="card space-y-1">
          {filtered.map(s => (
            <button
              key={s.id}
              onClick={() => selectSupplier(s)}
              className={`w-full text-left px-3 py-2.5 rounded-md text-sm flex items-center justify-between transition-colors ${selectedSupplier?.id === s.id ? 'bg-[var(--accent)]/10 text-[var(--accent)] font-semibold' : 'hover:bg-[var(--bg-muted)] text-[var(--text)]'}`}
            >
              <span>{s.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${s.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {s.is_active ? 'Active' : 'Inactive'}
              </span>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-[var(--text-tertiary)] text-sm text-center py-4">No suppliers found</p>}
        </div>

        <div>
          {!selectedSupplier ? (
            <div className="card text-center py-10 text-[var(--text-tertiary)] text-sm">Select a supplier to view details</div>
          ) : (
            <div className="space-y-4">
              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-base font-bold text-[var(--text)]">{selectedSupplier.name}</div>
                    <div className="text-xs text-[var(--text-tertiary)] mt-1">
                      <span className="inline-flex items-center gap-1">{selectedSupplier.payment_terms || 'Net 30'}</span>
                      <span className="mx-2">·</span>
                      <span>Lead: {selectedSupplier.lead_time_days || 7}d</span>
                    </div>
                  </div>
                  <button onClick={() => openEdit(selectedSupplier)} className="btn-ghost text-xs flex items-center gap-1">
                    <Edit size={14} /> Edit
                  </button>
                </div>
                <div className="mt-3 space-y-1 text-xs text-[var(--text-secondary)]">
                  {selectedSupplier.contact_email && <div className="flex items-center gap-1"><Mail size={12} /> {selectedSupplier.contact_email}</div>}
                  {selectedSupplier.contact_phone && <div className="flex items-center gap-1"><Phone size={12} /> {selectedSupplier.contact_phone}</div>}
                  {selectedSupplier.notes && <div className="flex items-center gap-1"><FileText size={12} /> {selectedSupplier.notes}</div>}
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-[var(--text)]">Supplier Pricing</h3>
                  <button onClick={() => { setShowPricingModal(true); setPricingError(null); setNewPricing({ sku: '', supplier_sku: '', unit_cost: '', moq: '1', lead_time_days: '7', is_preferred: 0 }); }} className="btn-primary text-[10px] flex items-center gap-1 px-2.5 py-1 rounded font-medium">
                    <Plus size={12} /> Add Pricing
                  </button>
                </div>
                {pricingLoading ? (
                  <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-[var(--text-tertiary)]" /></div>
                ) : pricing.length === 0 ? (
                  <p className="text-[var(--text-tertiary)] text-sm text-center py-4">No pricing entries yet</p>
                ) : (
                  <table className="table-standard">
                    <thead><tr><th>SKU</th><th>Supplier SKU</th><th className="text-right">Unit Cost</th><th className="text-right">MOQ</th><th className="text-right">Lead</th><th className="w-16" /></tr></thead>
                    <tbody>
                      {pricing.map(p => (
                        <tr key={p.id} className="text-xs">
                          <td className="font-mono">{p.sku} {p.is_preferred ? <Star size={10} className="inline text-yellow-500" /> : null}</td>
                          <td className="text-[var(--text-secondary)]">{p.supplier_sku || '-'}</td>
                          <td className="text-right font-medium">{fm(p.unit_cost)}</td>
                          <td className="text-right">{p.moq}</td>
                          <td className="text-right">{p.lead_time_days}d</td>
                          <td><button onClick={() => deletePricing(p.id)} className="text-[var(--text-tertiary)] hover:text-[var(--destructive)]"><X size={14} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-2"><Package size={18} className="text-[var(--accent)]" /><h2 className="text-base font-bold text-[var(--text)]">{isNew ? 'Add Supplier' : 'Edit Supplier'}</h2></div>
              <button onClick={() => setShowModal(false)} className="text-[var(--text-tertiary)] hover:text-[var(--text)]"><X size={18} /></button>
            </div>
            <div className="modal-body space-y-3">
              {formError && <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3"><AlertCircle size={16} /> {formError}</div>}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Name *</label>
                <input className="form-input text-sm w-full" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Email</label><input className="form-input text-sm w-full" value={editing.contact_email || ''} onChange={e => setEditing({ ...editing, contact_email: e.target.value || null })} /></div>
                <div><label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Phone</label><input className="form-input text-sm w-full" value={editing.contact_phone || ''} onChange={e => setEditing({ ...editing, contact_phone: e.target.value || null })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Payment Terms</label><input className="form-input text-sm w-full" value={editing.payment_terms || ''} onChange={e => setEditing({ ...editing, payment_terms: e.target.value })} /></div>
                <div><label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Lead Time (days)</label><input type="number" className="form-input text-sm w-full" value={editing.lead_time_days || 7} onChange={e => setEditing({ ...editing, lead_time_days: parseInt(e.target.value) || 7 })} /></div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Active</label>
                <select className="form-select text-sm w-full" value={editing.is_active || 1} onChange={e => setEditing({ ...editing, is_active: parseInt(e.target.value) })}>
                  <option value={1}>Active</option>
                  <option value={0}>Inactive</option>
                </select>
              </div>
              <div><label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Notes</label><textarea className="form-input text-sm w-full resize-none" rows={2} value={editing.notes || ''} onChange={e => setEditing({ ...editing, notes: e.target.value || null })} /></div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} className="btn-ghost text-sm px-4 py-2 rounded-lg">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary text-sm px-5 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {showPricingModal && selectedSupplier && (
        <div className="modal-overlay" onClick={() => setShowPricingModal(false)}>
          <div className="modal w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-2"><DollarSign size={18} className="text-[var(--accent)]" /><h2 className="text-base font-bold text-[var(--text)]">Add Pricing</h2></div>
              <button onClick={() => setShowPricingModal(false)} className="text-[var(--text-tertiary)] hover:text-[var(--text)]"><X size={18} /></button>
            </div>
            <div className="modal-body space-y-3">
              {pricingError && <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3"><AlertCircle size={16} /> {pricingError}</div>}
              <div><label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">SKU *</label><input className="form-input text-sm w-full font-mono" value={newPricing.sku} onChange={e => setNewPricing({ ...newPricing, sku: e.target.value.toUpperCase() })} /></div>
              <div><label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Supplier SKU</label><input className="form-input text-sm w-full" value={newPricing.supplier_sku} onChange={e => setNewPricing({ ...newPricing, supplier_sku: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Unit Cost</label><input type="number" step="0.01" min="0" className="form-input text-sm w-full" value={newPricing.unit_cost} onChange={e => setNewPricing({ ...newPricing, unit_cost: e.target.value })} /></div>
                <div><label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">MOQ</label><input type="number" min="1" className="form-input text-sm w-full" value={newPricing.moq} onChange={e => setNewPricing({ ...newPricing, moq: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1"><Calendar size={12} className="inline mr-1" />Lead Days</label><input type="number" min="1" className="form-input text-sm w-full" value={newPricing.lead_time_days} onChange={e => setNewPricing({ ...newPricing, lead_time_days: e.target.value })} /></div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors" style={newPricing.is_preferred ? { borderColor: 'var(--accent)', background: 'var(--accent)/0.05' } : { borderColor: 'var(--border)' }}>
                    <input type="checkbox" className="w-3.5 h-3.5" checked={!!newPricing.is_preferred} onChange={e => setNewPricing({ ...newPricing, is_preferred: e.target.checked ? 1 : 0 })} />
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">Preferred</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowPricingModal(false)} className="btn-ghost text-sm px-4 py-2 rounded-lg">Cancel</button>
              <button onClick={addPricing} disabled={pricingSaving} className="btn-primary text-sm px-5 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50">{pricingSaving ? <Loader2 size={16} className="animate-spin" /> : <DollarSign size={16} />}{pricingSaving ? 'Saving...' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
