import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLocationFilter } from '../context/LocationContext';
import { Link } from 'react-router-dom';
import { Search, Loader2, AlertCircle, Smartphone, ChevronLeft, ChevronRight } from 'lucide-react';

interface DeviceItem {
    imei: string;
    model_number: string;
    device_status: string;
    location_id: string;
    sub_location_bin: string | null;
    cost_basis: number;
    received_date: string;
    store_name: string | null;
    location_type: string | null;
    model: { brand: string; name: string; color: string; storage_gb: number } | null;
}

function getStatusBadge(status: string) {
    const map: Record<string, string> = {
        Sellable: 'badge-sellable', In_QC: 'badge-purple', In_Repair: 'badge-in-repair',
        Awaiting_Parts: 'badge-awaiting-parts', In_Transit: 'badge-in-transit',
        Sold: 'badge-sold', Reserved_Layaway: 'badge-layaway', Scrapped: 'badge-scrapped',
    };
    return map[status] || 'badge-neutral';
}

function statusLabel(s: string) { return s.replace(/_/g, ' '); }

export default function Inventory() {
    const navigate = useNavigate();
    const { token } = useAuth();
    const { selectedLocationId } = useLocationFilter();
    const [devices, setDevices] = useState<DeviceItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(0);
    const limit = 50;

    const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

    const fetchInventory = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const params = new URLSearchParams();
            if (selectedLocationId) params.set('location_id', selectedLocationId);
            if (statusFilter) params.set('device_status', statusFilter);
            if (search.trim()) params.set('search', search.trim());
            params.set('limit', String(limit));
            params.set('offset', String(page * limit));

            const res = await axios.get(`${apiUrl}/api/inventory/?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setDevices(res.data.items || []);
            setTotal(res.data.total || 0);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to load inventory');
        } finally { setLoading(false); }
    }, [token, selectedLocationId, statusFilter, search, page]);

    useEffect(() => { fetchInventory(); }, [fetchInventory]);

    // Debounced search
    useEffect(() => {
        const t = setTimeout(() => { setPage(0); fetchInventory(); }, 300);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => { setPage(0); fetchInventory(); }, [statusFilter, selectedLocationId]);

    const totalPages = Math.ceil(total / limit);

    const STATUS_OPTIONS = [
        '', 'Sellable', 'In_QC', 'In_Repair', 'In_Transit', 'Awaiting_Parts',
        'Sold', 'Reserved_Layaway', 'Scrapped',
    ];

    return (
        <div className="space-y-5">
            <div className="page-header">
                <div>
                    <div className="flex items-center gap-[10px]">
                        <h1 className="page-title">Inventory Dashboard</h1>
                        <span className="badge badge-neutral">All Devices</span>
                    </div>
                    <p className="text-[13px] text-[var(--text-tertiary)] mt-1">Browse, search, and filter your entire device inventory</p>
                </div>
                <Link to="/admin/manual-intake" className="btn-primary">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add Device
                </Link>
            </div>

            <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <div className="kpi-card"><div className="kpi-label">Total Inventory</div><div className="kpi-value">{total.toLocaleString()}</div></div>
                <div className="kpi-card"><div className="kpi-label">Sellable</div><div className="kpi-value">{devices.filter(d => d.device_status === 'Sellable').length.toLocaleString()}</div></div>
                <div className="kpi-card"><div className="kpi-label">In Repair</div><div className="kpi-value">{devices.filter(d => d.device_status === 'In_Repair').length.toLocaleString()}</div></div>
                <div className="kpi-card"><div className="kpi-label">Avg Cost Basis</div><div className="kpi-value">{devices.length > 0 ? `$${(devices.reduce((s, d) => s + (d.cost_basis || 0), 0) / devices.length).toFixed(0)}` : '—'}</div></div>
            </div>

            {error && (
                <div className="p-4 rounded-lg flex items-center gap-3 text-[var(--destructive)] text-[13px] font-bold" style={{ background: '#FEE2E2' }}>
                    <AlertCircle size={16} /> {error}
                    <button onClick={() => setError(null)} className="ml-auto underline">Dismiss</button>
                </div>
            )}

            {/* Filters */}
            <div className="flex gap-3 mb-4">
                <div className="flex-1 relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] z-10" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by IMEI or model..."
                        className="w-full bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--accent)] rounded-md pl-10 pr-4 py-2 text-[13px] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-muted)]"
                        style={{ fontFamily: 'var(--font-body)' }}
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="bg-[var(--bg)] border border-[var(--border)] rounded-md px-4 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] cursor-pointer"
                    style={{ fontFamily: 'var(--font-body)' }}
                >
                    <option value="">All Statuses</option>
                    {STATUS_OPTIONS.filter(Boolean).map(s => (
                        <option key={s} value={s}>{statusLabel(s)}</option>
                    ))}
                </select>
            </div>

            {/* Table */}
            <div className="card overflow-hidden">
                <div className="card-header">
                    <span>Device Inventory</span>
                    <span className="text-xs text-[var(--text-tertiary)]">{total.toLocaleString()} devices</span>
                </div>
                <div className="card-body p-0">
                    {loading ? (
                        <div className="py-24 flex justify-center">
                            <Loader2 size={32} className="animate-spin text-[var(--accent)]" />
                        </div>
                    ) : devices.length === 0 ? (
                        <div className="py-24 flex flex-col items-center justify-center gap-3 text-center">
                            <Smartphone size={56} className="text-[var(--text-muted)] opacity-40" />
                            <h3 className="text-base font-bold text-[var(--text)]" style={{ fontFamily: 'var(--font-heading)' }}>No devices found</h3>
                            <p className="text-[13px] text-[var(--text-tertiary)]">Try adjusting your search or filter criteria</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr>
                                        <th className="text-left px-[14px] py-[10px] text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] bg-[var(--bg-muted)] border-b border-[var(--border)]">IMEI</th>
                                        <th className="text-left px-[14px] py-[10px] text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] bg-[var(--bg-muted)] border-b border-[var(--border)]">Model</th>
                                        <th className="text-left px-[14px] py-[10px] text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] bg-[var(--bg-muted)] border-b border-[var(--border)]">Status</th>
                                        <th className="text-left px-[14px] py-[10px] text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] bg-[var(--bg-muted)] border-b border-[var(--border)]">Location</th>
                                        <th className="text-right px-[14px] py-[10px] text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] bg-[var(--bg-muted)] border-b border-[var(--border)]">Cost Basis</th>
                                        <th className="text-right px-[14px] py-[10px] text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] bg-[var(--bg-muted)] border-b border-[var(--border)]">Days</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {devices.map(d => {
                                        const days = Math.floor((Date.now() - new Date(d.received_date).getTime()) / 86400000);
                                        return (
                                            <tr key={d.imei} className="border-b border-[var(--border)] hover:bg-[var(--bg-muted)] transition-colors cursor-pointer"
                                              onClick={() => navigate(`/admin/track?q=${d.imei}`)}
                                              tabIndex={0}
                                              onKeyDown={(e) => e.key === 'Enter' && navigate(`/admin/track?q=${d.imei}`)}
                                            >
                                                <td className="px-[14px] py-[10px] text-[13px] font-mono font-semibold text-[var(--text)]">{d.imei}</td>
                                                <td className="px-[14px] py-[10px] text-[13px] text-[var(--text)] font-semibold">
                                                    {d.model_number || '—'}
                                                    {d.model && <span className="text-[var(--text-secondary)] ml-1 font-normal">{d.model.name.toLowerCase().startsWith(d.model.brand.toLowerCase()) ? d.model.name : `${d.model.brand} ${d.model.name}`}</span>}
                                                </td>
                                                <td className="px-[14px] py-[10px] text-[13px]">
                                                    <span className={`badge ${getStatusBadge(d.device_status)}`}>
                                                        {statusLabel(d.device_status)}
                                                    </span>
                                                </td>
                                                <td className="px-[14px] py-[10px] text-[13px] text-[var(--text-secondary)]">{d.store_name || d.location_id?.replace(/_/g, ' ') || '—'}</td>
                                                <td className="px-[14px] py-[10px] text-[13px] text-right font-mono text-[var(--text)]">${(d.cost_basis || 0).toFixed(2)}</td>
                                                <td className="px-[14px] py-[10px] text-[13px] text-right text-[var(--text-secondary)]">{days}d</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-[18px] py-3 border-t border-[var(--border)] flex items-center justify-between text-[13px]">
                        <span className="text-[var(--text-tertiary)]">
                            Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="p-1.5 rounded-md hover:bg-[var(--bg-muted)] disabled:opacity-30 transition-colors"
                            >
                                <ChevronLeft size={16} className="text-[var(--text)]" />
                            </button>
                            <span className="text-[var(--text)] font-bold">{page + 1} / {totalPages}</span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                disabled={page >= totalPages - 1}
                                className="p-1.5 rounded-md hover:bg-[var(--bg-muted)] disabled:opacity-30 transition-colors"
                            >
                                <ChevronRight size={16} className="text-[var(--text)]" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
