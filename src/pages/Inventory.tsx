import { useState, useEffect, useCallback } from 'react';
import api from '../api/api';
import { useLocationFilter } from '../context/LocationContext';
import { Link } from 'react-router-dom';
import { Search, Loader2, AlertCircle, Smartphone, ChevronLeft, ChevronRight, X, MapPin, Clock, User, Hash, Package, ArrowRightLeft } from 'lucide-react';

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

interface HistoryEntry {
    log_id: number;
    imei: string;
    timestamp: string;
    action_type: string;
    employee_id: string;
    previous_status: string | null;
    new_status: string;
    notes: string | null;
}

interface DeviceDetail {
    imei: string;
    serial_number: string | null;
    model_number: string | null;
    location_id: string;
    sub_location_bin: string | null;
    device_status: string | null;
    received_date: string;
    store_name: string | null;
    model: { brand: string; name: string; color: string; storage_gb: number; model_number: string } | null;
}

const HISTORY_STATUS_COLORS: Record<string, string> = {
    Sellable: '#10b981', In_QC: '#a855f7', In_Repair: '#f59e0b', In_Transit: '#06b6d4',
    Pending_Acknowledgment: '#3b82f6', Sold: '#059669', Transit_to_Repair: '#d97706',
    Transit_to_QC: '#c084fc', Transit_to_Main_Bin: '#34d399', Reserved_Layaway: '#6366f1',
    Scrapped: '#ef4444', Awaiting_Parts: '#60a5fa',
};

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
    const { selectedLocationId } = useLocationFilter();
    const [devices, setDevices] = useState<DeviceItem[]>([]);
    const [total, setTotal] = useState(0);
    const [sellableCount, setSellableCount] = useState(0);
    const [inRepairCount, setInRepairCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(0);
    const [selectedImei, setSelectedImei] = useState<string | null>(null);
    const [deviceDetail, setDeviceDetail] = useState<DeviceDetail | null>(null);
    const [historyTimeline, setHistoryTimeline] = useState<HistoryEntry[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const limit = 50;

    const fetchInventory = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const params = new URLSearchParams();
            if (selectedLocationId) params.set('location_id', selectedLocationId);
            if (statusFilter) params.set('device_status', statusFilter);
            if (search.trim()) params.set('search', search.trim());
            params.set('limit', String(limit));
            params.set('offset', String(page * limit));

            const res = await api.get(`/api/inventory/?${params.toString()}`);
            setDevices(res.data.items || []);
            setTotal(res.data.total || 0);
            setSellableCount(res.data.sellable_count ?? 0);
            setInRepairCount(res.data.in_repair_count ?? 0);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to load inventory');
        } finally { setLoading(false); }
    }, [selectedLocationId, statusFilter, search, page]);

    useEffect(() => { fetchInventory(); }, [fetchInventory]);

    // Debounced search
    useEffect(() => {
        const t = setTimeout(() => { setPage(0); fetchInventory(); }, 300);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => { setPage(0); fetchInventory(); }, [statusFilter, selectedLocationId]);

    const openDeviceHistory = async (imei: string) => {
        setSelectedImei(imei);
        setHistoryLoading(true);
        setDeviceDetail(null);
        setHistoryTimeline([]);
        try {
            const res = await api.get(`/api/track/`, {
                params: { identifier: imei },
            });
            setDeviceDetail(res.data.device);
            setHistoryTimeline(res.data.timeline || []);
        } catch {
            setDeviceDetail(null);
            setHistoryTimeline([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    const closeDeviceHistory = () => {
        setSelectedImei(null);
        setDeviceDetail(null);
        setHistoryTimeline([]);
    };

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
                <div className="kpi-card"><div className="kpi-label">Sellable</div><div className="kpi-value">{sellableCount.toLocaleString()}</div></div>
                <div className="kpi-card"><div className="kpi-label">In Repair</div><div className="kpi-value">{inRepairCount.toLocaleString()}</div></div>
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
                                              onClick={() => openDeviceHistory(d.imei)}
                                              tabIndex={0}
                                              onKeyDown={(e) => e.key === 'Enter' && openDeviceHistory(d.imei)}
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

            {/* Device History Modal */}
            {selectedImei && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4" onClick={closeDeviceHistory}>
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                    <div
                        className="relative bg-[var(--bg-card)] border border-[var(--border)] rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--bg-card)] rounded-t-xl">
                            <h2 className="text-base font-bold text-[var(--text)]">Device History</h2>
                            <button onClick={closeDeviceHistory} className="p-1.5 rounded-md hover:bg-[var(--bg-muted)] transition-colors">
                                <X size={18} className="text-[var(--text-tertiary)]" />
                            </button>
                        </div>

                        <div className="p-5">
                            {historyLoading ? (
                                <div className="py-16 flex justify-center">
                                    <Loader2 size={32} className="animate-spin text-[var(--accent)]" />
                                </div>
                            ) : !deviceDetail ? (
                                <div className="py-16 flex flex-col items-center gap-3 text-center">
                                    <AlertCircle size={40} className="text-[var(--text-muted)] opacity-40" />
                                    <p className="text-sm text-[var(--text-tertiary)]">Could not load device history</p>
                                </div>
                            ) : (
                                <>
                                    {/* Device Info */}
                                    <div className="flex items-center gap-4 mb-5">
                                        <div
                                            className="w-12 h-12 rounded-full flex items-center justify-center"
                                            style={{ background: HISTORY_STATUS_COLORS[deviceDetail.device_status || ''] || '#71717a' }}
                                        >
                                            <Smartphone size={22} className="text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-[var(--text)]">
                                                {deviceDetail.model
                                                    ? (deviceDetail.model.name.toLowerCase().startsWith(deviceDetail.model.brand.toLowerCase())
                                                        ? deviceDetail.model.name
                                                        : `${deviceDetail.model.brand} ${deviceDetail.model.name}`)
                                                    : 'Unknown Device'}
                                            </h3>
                                            <p className="text-sm text-[var(--text-tertiary)]">
                                                {deviceDetail.model && `${deviceDetail.model.color || ''}${deviceDetail.model.color ? ' · ' : ''}${deviceDetail.model.storage_gb}GB`}
                                            </p>
                                        </div>
                                        <div className="ml-auto">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-opacity-20 text-[var(--text)] border border-[var(--border-secondary)]">
                                                <span
                                                    className="w-2 h-2 rounded-full"
                                                    style={{ background: HISTORY_STATUS_COLORS[deviceDetail.device_status || ''] || '#71717a' }}
                                                />
                                                {(deviceDetail.device_status || 'Unknown').replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mb-5">
                                        <Info icon={Hash} label="IMEI" value={deviceDetail.imei} />
                                        <Info icon={Hash} label="Serial" value={deviceDetail.serial_number || '—'} />
                                        <Info icon={MapPin} label="Location" value={deviceDetail.store_name || deviceDetail.location_id} />
                                        {deviceDetail.model && (
                                            <>
                                                <Info icon={Smartphone} label="Model" value={deviceDetail.model.model_number} />
                                                <Info icon={Package} label="Brand" value={deviceDetail.model.brand} />
                                            </>
                                        )}
                                        <Info icon={Clock} label="Received" value={new Date(deviceDetail.received_date).toLocaleDateString()} />
                                        {deviceDetail.sub_location_bin && (
                                            <Info icon={MapPin} label="Bin" value={deviceDetail.sub_location_bin} />
                                        )}
                                    </div>

                                    {/* Timeline */}
                                    <div>
                                        <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4">
                                            Journey ({historyTimeline.length} {historyTimeline.length === 1 ? 'event' : 'events'})
                                        </h4>

                                        <div className="relative">
                                            {historyTimeline.map((entry, i) => {
                                                const isLast = i === historyTimeline.length - 1;
                                                const color = HISTORY_STATUS_COLORS[entry.new_status] || '#71717a';

                                                return (
                                                    <div key={entry.log_id} className="flex gap-4">
                                                        <div className="flex flex-col items-center">
                                                            <div
                                                                className="w-3 h-3 rounded-full flex-shrink-0"
                                                                style={{ background: color }}
                                                            />
                                                            {!isLast && <div className="w-0.5 flex-1 bg-[var(--border-primary)] min-h-[24px]" />}
                                                        </div>

                                                        <div className="flex-1 pb-5">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-sm font-semibold text-[var(--text)]">{entry.action_type}</span>
                                                                <span className="text-xs text-[var(--text-muted)]">
                                                                    {new Date(entry.timestamp).toLocaleString()}
                                                                </span>
                                                            </div>

                                                            <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] mb-1">
                                                                <span className="flex items-center gap-1">
                                                                    <User size={12} /> {entry.employee_id}
                                                                </span>
                                                                {entry.previous_status && (
                                                                    <span className="flex items-center gap-1">
                                                                        <span className="text-[var(--text-muted)]">{entry.previous_status.replace(/_/g, ' ')}</span>
                                                                        <span className="text-[var(--text-tertiary)]">→</span>
                                                                        <span className="text-[var(--text)] font-medium">{entry.new_status.replace(/_/g, ' ')}</span>
                                                                    </span>
                                                                )}
                                                                {!entry.previous_status && (
                                                                    <span className="text-[var(--text)] font-medium">{entry.new_status.replace(/_/g, ' ')}</span>
                                                                )}
                                                            </div>

                                                            {entry.notes && (
                                                                <p className="text-xs text-[var(--text-tertiary)] mt-1">{entry.notes}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {historyTimeline.length === 0 && (
                                            <p className="text-sm text-[var(--text-tertiary)] text-center py-6">No history recorded yet.</p>
                                        )}
                                    </div>

                                    {/* Action */}
                                    <div className="mt-5 pt-4 border-t border-[var(--border)]">
                                        <Link
                                            to={`/admin/routing?imei=${deviceDetail.imei}`}
                                            onClick={closeDeviceHistory}
                                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
                                        >
                                            <ArrowRightLeft size={14} /> Route Device
                                        </Link>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function Info({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
    return (
        <div className="flex items-center gap-2">
            <Icon size={14} className="text-[var(--text-tertiary)] flex-shrink-0" />
            <div className="min-w-0">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">{label}</span>
                <span className="text-sm text-[var(--text)] font-medium truncate block">{value}</span>
            </div>
        </div>
    );
}
