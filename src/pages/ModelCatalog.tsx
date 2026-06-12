import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Loader2, AlertCircle, Package, Search } from 'lucide-react';
import { fetchModels, fetchBrands, createModel, updateModel, deleteModel, PhoneModel } from '../api/models';
import { useAuth } from '../context/AuthContext';
import { useLocationFilter } from '../context/LocationContext';

const emptyModel: PhoneModel = {
  model_number: '',
  brand: '',
  name: '',
  color: '',
  storage_gb: 0,
};

export default function ModelCatalog() {
  const { user } = useAuth();
  const { selectedLocationId } = useLocationFilter();
  const effectiveStoreId = user?.role !== 'admin' ? (user?.store_id || null) : selectedLocationId;

  const [models, setModels] = useState<PhoneModel[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PhoneModel | null>(null);
  const [form, setForm] = useState<PhoneModel>({ ...emptyModel });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, b] = await Promise.all([
        fetchModels(undefined, undefined, undefined, effectiveStoreId),
        fetchBrands(),
      ]);
      setModels(m);
      setBrands(b);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [effectiveStoreId]);

  useEffect(() => { load(); }, [load]);

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
      load();
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
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Device Catalog</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
            {effectiveStoreId ? `Showing inventory for ${effectiveStoreId}` : 'All locations'} · {models.filter(m => (m.inventory_count ?? 0) > 0).length} models in stock
          </p>
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
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search models..."
            className="w-full pl-9 pr-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--accent)]" />
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
                <th>Model Number</th>
                <th>Brand</th>
                <th>Name</th>
                <th>Storage</th>
                <th>Color</th>
                <th className="text-right">In Stock</th>
                <th className="w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.model_number}
                  className={`cursor-pointer hover:bg-[var(--bg-muted)] transition-colors ${(m.inventory_count ?? 0) === 0 ? 'opacity-40' : ''}`}
                  onClick={() => navigate(`/admin/models/${encodeURIComponent(m.model_number)}`)}>
                  <td className="font-mono text-xs">{m.model_number}</td>
                  <td className="text-sm">{m.brand}</td>
                  <td className="text-sm font-medium text-[var(--text)]">{m.name}</td>
                  <td className="text-sm">{m.storage_gb > 0 ? `${m.storage_gb}GB` : '—'}</td>
                  <td className="text-sm text-[var(--text-tertiary)]">{m.color || '—'}</td>
                  <td className="text-right">
                    {(m.inventory_count ?? 0) > 0 ? (
                      <span className="font-mono font-bold text-sm text-emerald-400">{m.inventory_count}</span>
                    ) : (
                      <span className="text-xs text-[var(--text-tertiary)]">0</span>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openEdit(m)}
                        className="p-1.5 rounded hover:bg-[var(--bg-muted)] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
                        title="Edit"><Pencil size={14} /></button>
                      <button onClick={() => setDeleteTarget(m.model_number)}
                        className="p-1.5 rounded hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-400 transition-colors"
                        title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
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
              <div><label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">Model Number</label>
                <input className="form-input text-sm" value={form.model_number} onChange={e => setForm({ ...form, model_number: e.target.value })} placeholder="e.g. IP15P256" /></div>
              <div><label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">Brand</label>
                <input className="form-input text-sm" value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} placeholder="Apple, Samsung, etc." /></div>
              <div><label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">Name</label>
                <input className="form-input text-sm" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="iPhone 15 Pro Max" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">Storage (GB)</label>
                  <input type="number" className="form-input text-sm" value={form.storage_gb} onChange={e => setForm({ ...form, storage_gb: parseInt(e.target.value) || 0 })} /></div>
                <div><label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">Color</label>
                  <input className="form-input text-sm" value={form.color || ''} onChange={e => setForm({ ...form, color: e.target.value || '' })} placeholder="Optional" /></div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowModal(false)} className="btn-secondary px-4 py-2 rounded-lg text-sm">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : 'Save'}</button>
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
