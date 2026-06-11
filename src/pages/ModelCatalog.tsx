import { useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, AlertCircle, Package, Search, ChevronDown, ChevronRight, BarChart3, TrendingUp, Truck, ShoppingCart, PenTool, ArrowDownToLine, Store } from 'lucide-react';
import useModels, { createModel, updateModel, deleteModel, PhoneModel } from '../api/models';
import api from '../api/api';

const emptyModel: PhoneModel = {
  model_number: '',
  brand: '',
  name: '',
  color: '',
  storage_gb: 0,
};

interface TimelineEvent {
  type: 'import' | 'sale' | 'transfer' | 'notes';
  label: string;
  date: string | null;
  detail?: string;
  count: number;
}

interface ModelAnalytics {
  model_number: string;
  total_ever_registered: number;
  currently_in_stock: number;
  available_sellable: number;
  sold: number;
  scrapped: number;
  status_breakdown: Record<string, number>;
  store_breakdown: { location_id: string; location_name: string; count: number }[];
  timeline: TimelineEvent[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  Sellable: { label: 'Sellable', color: '#10b981' },
  In_QC: { label: 'In QC', color: '#00f0ff' },
  In_Repair: { label: 'In Repair', color: '#f59e0b' },
  In_Transit: { label: 'In Transit', color: '#14b8a6' },
  Reserved_Layaway: { label: 'Layaway', color: '#f97316' },
  Sold: { label: 'Sold', color: '#3b82f6' },
  Scrapped: { label: 'Scrapped', color: '#ef4444' },
  Awaiting_Parts: { label: 'Awaiting Parts', color: '#a855f7' },
  On_Consignment: { label: 'Consignment', color: '#8b5cf6' },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ModelCatalog() {
  const { models, brands, loading, reload } = useModels();
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PhoneModel | null>(null);
  const [form, setForm] = useState<PhoneModel>({ ...emptyModel });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<ModelAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const filtered = models.filter(m => {
    if (search && !`${m.brand} ${m.name} ${m.model_number}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (brandFilter && m.brand !== brandFilter) return false;
    return true;
  });

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyModel });
    setError(null);
    setShowModal(true);
  };

  const openEdit = (m: PhoneModel) => {
    setEditing(m);
    setForm({ ...m, color: m.color || '' });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.brand || !form.name || !form.model_number) {
      setError('Brand, name, and model number are required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await updateModel(editing.model_number, form);
      } else {
        await createModel(form);
      }
      setShowModal(false);
      reload(search, brandFilter);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save model');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (modelNumber: string) => {
    try {
      await deleteModel(modelNumber);
      setDeleteTarget(null);
      reload(search, brandFilter);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const toggleAnalytics = async (modelNumber: string) => {
    if (expandedModel === modelNumber) {
      setExpandedModel(null);
      setAnalytics(null);
      return;
    }
    setExpandedModel(modelNumber);
    setAnalyticsLoading(true);
    setAnalytics(null);
    try {
      const { data } = await api.get(`/api/models/${encodeURIComponent(modelNumber)}/analytics`);
      setAnalytics(data);
    } catch {
      setError('Failed to load analytics');
      setExpandedModel(null);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Device Catalog</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">Manage phone models, tablets, watches & more</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={16} /> Add Model
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle size={16} />{error}
          <button onClick={() => setError(null)} className="ml-auto text-xs underline">Dismiss</button>
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search models..."
            className="w-full pl-9 pr-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>
        <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)}
          className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-sm px-3 py-2 outline-none focus:border-[var(--accent)] cursor-pointer">
          <option value="">All Brands</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-[var(--text-tertiary)]" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Package size={36} className="text-[var(--text-muted)] mb-3" />
          <p className="text-sm text-[var(--text)] font-medium">No models found</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">Add models to build your device catalog</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="table-standard">
            <thead>
              <tr>
                <th className="w-8"></th>
                <th>Model Number</th>
                <th>Brand</th>
                <th>Name</th>
                <th>Storage</th>
                <th>Color</th>
                <th className="w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <>
                  <tr key={m.model_number}
                    className={`cursor-pointer hover:bg-[var(--bg-muted)] transition-colors ${expandedModel === m.model_number ? 'bg-[var(--bg-muted)]' : ''}`}
                    onClick={() => toggleAnalytics(m.model_number)}>
                    <td className="w-8">
                      {expandedModel === m.model_number ? <ChevronDown size={14} className="text-accent" /> : <ChevronRight size={14} className="text-[var(--text-tertiary)]" />}
                    </td>
                    <td className="font-mono text-xs">{m.model_number}</td>
                    <td className="text-sm">{m.brand}</td>
                    <td className="text-sm font-medium text-[var(--text)]">{m.name}</td>
                    <td className="text-sm">{m.storage_gb > 0 ? `${m.storage_gb}GB` : '—'}</td>
                    <td className="text-sm text-[var(--text-tertiary)]">{m.color || '—'}</td>
                    <td>
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => openEdit(m)} className="p-1.5 rounded hover:bg-[var(--bg-muted)] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors" title="Edit"><Pencil size={14} /></button>
                        <button onClick={() => setDeleteTarget(m.model_number)} className="p-1.5 rounded hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-400 transition-colors" title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                  {expandedModel === m.model_number && (
                    <tr key={`${m.model_number}-analytics`}>
                      <td colSpan={7} className="p-0">
                        {analyticsLoading ? (
                          <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-[var(--text-tertiary)]" /></div>
                        ) : analytics ? (
                          <div className="px-6 py-5 bg-[var(--bg)] border-t border-[var(--border)]">

                            {/* KPI Row */}
                            <div className="grid grid-cols-5 gap-4 mb-5">
                              <div className="bg-[var(--bg-card)] rounded-lg p-3 border border-[var(--border)]">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Total Registered</div>
                                <div className="text-2xl font-bold text-[var(--text)]">{analytics.total_ever_registered}</div>
                              </div>
                              <div className="bg-[var(--bg-card)] rounded-lg p-3 border border-[var(--border)]">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">In Stock</div>
                                <div className="text-2xl font-bold text-[var(--text)]">{analytics.currently_in_stock}</div>
                              </div>
                              <div className="bg-[var(--bg-card)] rounded-lg p-3 border border-emerald-500/20">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1">Sellable</div>
                                <div className="text-2xl font-bold text-emerald-400">{analytics.available_sellable}</div>
                              </div>
                              <div className="bg-[var(--bg-card)] rounded-lg p-3 border border-blue-500/20">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-1">Sold</div>
                                <div className="text-2xl font-bold text-blue-400">{analytics.sold}</div>
                              </div>
                              <div className="bg-[var(--bg-card)] rounded-lg p-3 border border-red-500/20">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-red-400 mb-1">Scrapped</div>
                                <div className="text-2xl font-bold text-red-400">{analytics.scrapped}</div>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-5">
                              {/* Status Breakdown */}
                              <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2 flex items-center gap-1.5">
                                  <BarChart3 size={12} /> Status
                                </h4>
                                <div className="space-y-1.5">
                                  {Object.entries(analytics.status_breakdown)
                                    .filter(([, count]) => count > 0)
                                    .map(([status, count]) => {
                                      const info = STATUS_LABELS[status] || { label: status.replace(/_/g, ' '), color: '#6b7280' };
                                      return (
                                        <div key={status} className="flex items-center justify-between text-sm">
                                          <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: info.color }} />
                                            <span className="text-[var(--text-secondary)]">{info.label}</span>
                                          </div>
                                          <span className="font-mono font-bold text-[var(--text)]">{count}</span>
                                        </div>
                                      );
                                    })}
                                  {Object.values(analytics.status_breakdown).every(c => c === 0) && (
                                    <p className="text-xs text-[var(--text-tertiary)] italic">No devices</p>
                                  )}
                                </div>
                              </div>

                              {/* Store Breakdown */}
                              <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2 flex items-center gap-1.5">
                                  <Store size={12} /> By Store
                                </h4>
                                <div className="space-y-1.5">
                                  {analytics.store_breakdown.length > 0 ? (
                                    analytics.store_breakdown.map(s => (
                                      <div key={s.location_id} className="flex items-center justify-between text-sm">
                                        <span className="text-[var(--text-secondary)]">{s.location_name}</span>
                                        <span className="font-mono font-bold text-[var(--text)]">{s.count}</span>
                                      </div>
                                    ))
                                  ) : (
                                    <p className="text-xs text-[var(--text-tertiary)] italic">None in stock</p>
                                  )}
                                </div>
                              </div>

                              {/* Timeline */}
                              <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2 flex items-center gap-1.5">
                                  <TrendingUp size={12} /> History
                                </h4>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                  {analytics.timeline.length > 0 ? (
                                    analytics.timeline.map((event, i) => {
                                      const Icon = event.type === 'import' ? ArrowDownToLine
                                        : event.type === 'sale' ? ShoppingCart
                                        : event.type === 'transfer' ? Truck
                                        : PenTool;
                                      const color = event.type === 'import' ? 'text-emerald-400'
                                        : event.type === 'sale' ? 'text-blue-400'
                                        : event.type === 'transfer' ? 'text-amber-400'
                                        : 'text-purple-400';
                                      return (
                                        <div key={i} className="flex gap-2 text-xs border-b border-[var(--border)] pb-2 last:border-0 last:pb-0">
                                          <Icon size={12} className={`${color} flex-shrink-0 mt-0.5`} />
                                          <div className="min-w-0 flex-1">
                                            <div className="font-medium text-[var(--text)]">{event.label}</div>
                                            {event.detail && (
                                              <div className="text-[10px] text-[var(--text-tertiary)] truncate">{event.detail}</div>
                                            )}
                                          </div>
                                          <span className="text-[10px] text-[var(--text-tertiary)] whitespace-nowrap">{formatDate(event.date)}</span>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <p className="text-xs text-[var(--text-tertiary)] italic">No activity yet</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowModal(false)}>
          <div className="bg-[var(--bg-card)] rounded-xl shadow-2xl border border-[var(--border)] w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[var(--text)] mb-4">{editing ? 'Edit Model' : 'Add Model'}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">Model Number</label>
                <input className="form-input text-sm" value={form.model_number} onChange={e => setForm({ ...form, model_number: e.target.value })} placeholder="e.g. IP15P256" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">Brand</label>
                <input className="form-input text-sm" value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} placeholder="Apple, Samsung, etc." />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">Name</label>
                <input className="form-input text-sm" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="iPhone 15 Pro Max" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">Storage (GB)</label>
                  <input type="number" className="form-input text-sm" value={form.storage_gb} onChange={e => setForm({ ...form, storage_gb: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">Color</label>
                  <input className="form-input text-sm" value={form.color || ''} onChange={e => setForm({ ...form, color: e.target.value || '' })} placeholder="Optional" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowModal(false)} className="btn-secondary px-4 py-2 rounded-lg text-sm">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeleteTarget(null)}>
          <div className="bg-[var(--bg-card)] rounded-xl shadow-2xl border border-[var(--border)] w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[var(--text)] mb-2">Delete Model?</h2>
            <p className="text-sm text-[var(--text-tertiary)] mb-4">
              This will remove <span className="font-mono font-medium text-[var(--text)]">{deleteTarget}</span> from the catalog. Devices already using this model won't be affected.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary px-4 py-2 rounded-lg text-sm">Cancel</button>
              <button onClick={() => handleDelete(deleteTarget)} className="px-4 py-2 rounded-lg text-sm bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
