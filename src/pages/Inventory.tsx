import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLocationFilter } from '../context/LocationContext';
import { Search, PackageSearch, Loader2, AlertCircle, Smartphone, ChevronLeft, ChevronRight } from 'lucide-react';

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
        <div className="space-y-6 max-w-6xl mx-auto">
            <div>
                <h1 className="text-[22px] font-bold text-[#e4e4e7] flex items-center gap-3">
                    Inventory Dashboard
                    <span className="bg-accent/10 text-accent text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider font-bold border border-accent/20">
                        All Devices
                    </span>
                </h1>
                <p className="text-xs text-[#71717a] mt-1">Browse, search, and filter your entire device inventory</p>
            </div>

            {error && (
                <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-lg flex items-center gap-3 text-red-400 text-xs font-bold">
                    <AlertCircle size={16} /> {error}
                    <button onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-400">Dismiss</button>
                </div>
            )}

            {/* Filters */}
            <div className="flex gap-3">
                <div className="flex-1 relative">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#52525b]" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by IMEI or model..."
                        className="w-full bg-[#0c0c0e] border border-[#1a1a1c] focus:border-accent rounded-xl pl-12 pr-4 py-2.5 text-sm text-[#e4e4e7] outline-none transition-all placeholder:text-xs placeholder:text-[#52525b]"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="bg-[#0c0c0e] border border-[#1a1a1c] rounded-xl px-4 py-2.5 text-sm text-[#e4e4e7] outline-none focus:border-accent cursor-pointer font-bold"
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
                    <span className="flex items-center gap-2">
                        <PackageSearch size={16} className="text-accent" /> Inventory
                    </span>
                    <span className="text-[11px] text-[#52525b]">{total.toLocaleString()} devices</span>
                </div>
                <div className="card-body p-0">
                    {loading ? (
                        <div className="py-24 flex justify-center">
                            <Loader2 size={32} className="animate-spin text-accent" />
                        </div>
                    ) : devices.length === 0 ? (
                        <div className="py-24 flex flex-col items-center justify-center space-y-3">
                            <Smartphone size={56} className="text-[#1a1a1c]" />
                            <p className="text-xs font-bold uppercase tracking-wider text-[#52525b]">No devices found</p>
                            <p className="text-[10px] text-[#52525b]">Try adjusting your search or filter criteria</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-[#1a1a1c] text-[#52525b] font-bold uppercase tracking-wider">
                                        <th className="text-left px-5 py-3">IMEI</th>
                                        <th className="text-left px-5 py-3">Model</th>
                                        <th className="text-left px-5 py-3">Status</th>
                                        <th className="text-left px-5 py-3">Location</th>
                                        <th className="text-right px-5 py-3">Cost Basis</th>
                                        <th className="text-right px-5 py-3">Days</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {devices.map(d => {
                                        const days = Math.floor((Date.now() - new Date(d.received_date).getTime()) / 86400000);
                                        return (
                                            <tr key={d.imei} className="border-b border-[#0c0c0e] hover:bg-[#141416]/50 transition-colors">
                                                <td className="px-5 py-3 font-mono font-bold text-[#e4e4e7] tracking-wider">{d.imei}</td>
                                                <td className="px-5 py-3 text-[#e4e4e7] font-bold">
                                                    {d.model_number || '—'}
                                                    {d.model && <span className="text-[#52525b] ml-1 font-normal">{d.model.brand} {d.model.name}</span>}
                                                </td>
                                                <td className="px-5 py-3">
                                                    <span className={`badge ${getStatusBadge(d.device_status)} text-[10px]`}>
                                                        {statusLabel(d.device_status)}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 text-[#e4e4e7]">{d.store_name || d.location_id?.replace(/_/g, ' ') || '—'}</td>
                                                <td className="px-5 py-3 text-right font-mono text-[#e4e4e7]">${(d.cost_basis || 0).toFixed(2)}</td>
                                                <td className="px-5 py-3 text-right text-[#71717a]">{days}d</td>
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
                    <div className="px-5 py-3 border-t border-[#1a1a1c] flex items-center justify-between text-xs">
                        <span className="text-[#52525b]">
                            Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="p-1.5 rounded-lg hover:bg-[#141416] disabled:opacity-30 transition-colors"
                            >
                                <ChevronLeft size={16} className="text-[#e4e4e7]" />
                            </button>
                            <span className="text-[#e4e4e7] font-bold">{page + 1} / {totalPages}</span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                disabled={page >= totalPages - 1}
                                className="p-1.5 rounded-lg hover:bg-[#141416] disabled:opacity-30 transition-colors"
                            >
                                <ChevronRight size={16} className="text-[#e4e4e7]" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
