import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Loader2, AlertCircle, Wrench, Search } from 'lucide-react';
import { fetchServices, fetchServiceCategories, createService, updateService, deleteService, ServiceItem } from '../api/services';

const emptyService = { name: '', category: '', default_price: 0 };

export default function ServiceCatalog() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ServiceItem | null>(null);
  const [form, setForm] = useState(emptyService);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([fetchServices(), fetchServiceCategories()]);
      setServices(s);
      setCategories(c);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = services.filter(s => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (catFilter && s.category !== catFilter) return false;
    return true;
  });

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyService });
    setError(null);
    setShowModal(true);
  };

  const openEdit = (s: ServiceItem) => {
    setEditing(s);
    setForm({ name: s.name, category: s.category || '', default_price: s.default_price });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name) { setError('Service name is required'); return; }
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await updateService(editing.id, form);
      } else {
        await createService(form);
      }
      setShowModal(false);
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteService(id);
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
          <h1 className="text-xl font-bold text-[var(--text)]">Service Catalog</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">Manage repair services, pricing defaults & categories</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={16} /> Add Service
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
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search services..." className="w-full pl-9 pr-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--accent)]" />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-sm px-3 py-2 outline-none focus:border-[var(--accent)] cursor-pointer">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-[var(--text-tertiary)]" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Wrench size={36} className="text-[var(--text-muted)] mb-3" />
          <p className="text-sm text-[var(--text)] font-medium">No services found</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">Add repair services to build your catalog</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="table-standard">
            <thead>
              <tr>
                <th>Service</th>
                <th>Category</th>
                <th className="text-right">Default Price</th>
                <th className="w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id}>
                  <td className="text-sm font-medium text-[var(--text)]">{s.name}</td>
                  <td className="text-sm text-[var(--text-tertiary)]">{s.category || '—'}</td>
                  <td className="text-sm text-right font-mono text-[var(--text)]">${s.default_price.toFixed(2)}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded hover:bg-[var(--bg-muted)] text-[var(--text-tertiary)] hover:text-[var(--accent)]" title="Edit"><Pencil size={14} /></button>
                      <button onClick={() => setDeleteTarget(s.id)} className="p-1.5 rounded hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-400" title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowModal(false)}>
          <div className="bg-[var(--bg-card)] rounded-xl shadow-2xl border border-[var(--border)] w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[var(--text)] mb-4">{editing ? 'Edit Service' : 'Add Service'}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">Service Name</label>
                <input className="form-input text-sm" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Screen Replacement" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">Category</label>
                <input className="form-input text-sm" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Display, Battery, etc." list="cat-list" />
                <datalist id="cat-list">{categories.map(c => <option key={c} value={c} />)}</datalist>
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">Default Price ($)</label>
                <input type="number" step="0.01" className="form-input text-sm" value={form.default_price} onChange={e => setForm({ ...form, default_price: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowModal(false)} className="btn-secondary px-4 py-2 rounded-lg text-sm">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary px-4 py-2 rounded-lg text-sm disabled:opacity-50">{saving ? <Loader2 size={14} className="animate-spin" /> : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeleteTarget(null)}>
          <div className="bg-[var(--bg-card)] rounded-xl shadow-2xl border border-[var(--border)] w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[var(--text)] mb-2">Delete Service?</h2>
            <p className="text-sm text-[var(--text-tertiary)] mb-4">This will permanently remove this service from the catalog.</p>
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
