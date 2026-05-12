import { useState, useEffect } from 'react';
import axios from 'axios';
import { useLocationFilter } from '../context/LocationContext';
import { Truck, Loader2, AlertCircle, CheckCircle2, FileText, ArrowDownCircle } from 'lucide-react';

interface TransferOrder {
    id: string;
    transfer_type: string;
    source_location_id: string;
    destination_location_id: string;
    notes: string | null;
    created_by_email: string;
    created_at: string;
    status: string;
}

interface DeviceInfo {
    imei: string;
    model_number: string;
    device_status: string;
    location_id: string;
}

interface TransferDetail extends TransferOrder {
    devices: DeviceInfo[];
    received_count: number;
    total_count: number;
}

function getStatusBadge(status: string) {
    const map: Record<string, string> = {
        Sellable: 'badge-sellable', In_QC: 'badge-purple', In_Repair: 'badge-in-repair',
        Awaiting_Parts: 'badge-awaiting-parts', In_Transit: 'badge-in-transit',
        Sold: 'badge-sold', Reserved_Layaway: 'badge-layaway', Scrapped: 'badge-scrapped',
    };
    return map[status] || 'badge-neutral';
}

export default function IncomingTransfers() {
    const { availableLocations } = useLocationFilter();
    const [transfers, setTransfers] = useState<TransferOrder[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [detail, setDetail] = useState<TransferDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [scanImei, setScanImei] = useState('');
    const [routing, setRouting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
    const locationNames = new Map(availableLocations.map(l => [l.id, l.name]));

    const fetchTransfers = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${apiUrl}/api/transfers/incoming`);
            setTransfers(res.data || []);
        } catch { setError('Failed to load incoming transfers'); } finally { setLoading(false); }
    };

    useEffect(() => { fetchTransfers(); }, []);

    const expandTransfer = async (id: string) => {
        if (expandedId === id) {
            setExpandedId(null); setDetail(null); return;
        }
        setExpandedId(id); setDetailLoading(true); setError(null); setSuccess(null);
        try {
            const res = await axios.get(`${apiUrl}/api/transfers/incoming/${id}`);
            setDetail(res.data);
        } catch { setError('Failed to load transfer detail'); } finally { setDetailLoading(false); }
    };

    const receiveItem = async () => {
        if (!detail || !scanImei.trim()) return;
        setRouting(true); setError(null); setSuccess(null);
        try {
            await axios.post(
                `${apiUrl}/api/transfers/${detail.id}/receive-item`,
                { imei: scanImei.trim() }
            );
            setSuccess(`Received ${scanImei.trim()}`);
            setScanImei('');
            // Refresh detail
            const res = await axios.get(`${apiUrl}/api/transfers/incoming/${detail.id}`);
            setDetail(res.data);
            if (res.data.received_count >= res.data.total_count) {
                fetchTransfers();
            }
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to receive device');
        } finally { setRouting(false); }
    };

    const receiveAll = async () => {
        if (!detail) return;
        if (!window.confirm(`Receive all ${detail.total_count - detail.received_count} remaining devices? This marks the entire transfer as received.`)) return;
        setRouting(true); setError(null); setSuccess(null);
        try {
            const res = await axios.post(
                `${apiUrl}/api/transfers/${detail.id}/receive-all`,
                {}
            );
            setSuccess(`Received all ${res.data.received_count} devices`);
            setExpandedId(null); setDetail(null);
            fetchTransfers();
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to receive all');
        } finally { setRouting(false); }
    };

    const downloadPdf = async (id: string) => {
        try {
            const res = await axios.get(`${apiUrl}/api/transfers/${id}/pdf`, { responseType: 'blob' });
            const url = URL.createObjectURL(res.data);
            window.open(url, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch {
            setError('Failed to download transfer PDF');
        }
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div>
                <h1 className="text-[22px] font-bold text-[var(--text-primary)] flex items-center gap-3">
                    Incoming Transfers
                    <span className="badge-neutral text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider font-bold border border-accent/20">
                        Receive
                    </span>
                </h1>
                <p className="text-xs text-[var(--text-secondary)] mt-1">Scan and receive devices transferred to your location</p>
            </div>

            {error && (
                <div className="p-4 bg-[#FEE2E2] border border-red-500/10 rounded-lg flex items-center gap-3 text-[var(--destructive)] text-xs font-bold">
                    <AlertCircle size={16} /> {error}
                    <button onClick={() => setError(null)} className="ml-auto text-[var(--destructive)]/60 hover:text-[var(--destructive)]">Dismiss</button>
                </div>
            )}
            {success && (
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-lg flex items-center gap-3 text-[var(--success)] text-xs font-bold">
                    <CheckCircle2 size={16} /> {success}
                </div>
            )}

            {loading ? (
                <div className="card">
                    <div className="card-body py-24 flex flex-col items-center justify-center">
                        <Loader2 size={32} className="animate-spin text-accent" />
                    </div>
                </div>
            ) : transfers.length === 0 ? (
                <div className="card">
                    <div className="card-body py-24 flex flex-col items-center justify-center space-y-3">
                        <Truck size={56} className="text-[var(--text-muted)]" />
                        <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">No incoming transfers</p>
                        <p className="text-[10px] text-[var(--text-tertiary)] text-center max-w-sm">No devices are currently in transit to your location</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    {transfers.map(t => (
                        <div key={t.id} className="card overflow-hidden">
                            <button
                                onClick={() => expandTransfer(t.id)}
                                className="w-full px-5 py-4 flex items-center justify-between hover:bg-[var(--bg-tertiary)]/50 transition-colors text-left"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${t.status === 'Received' ? 'bg-emerald-500/10' : 'bg-accent/10'}`}>
                                        <Truck size={20} className={t.status === 'Received' ? 'text-[var(--success)]' : 'text-accent'} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-[var(--text-primary)]">{t.id}</div>
                                        <div className="text-[11px] text-[var(--text-secondary)]">
                                            From: {locationNames.get(t.source_location_id) || t.source_location_id || '—'}
                                            {' → '}
                                            To: {locationNames.get(t.destination_location_id) || t.destination_location_id}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`badge ${t.status === 'Received' ? 'badge-sellable' : 'badge-in-transit'} text-[10px]`}>
                                        {t.status === 'In_Transit' ? 'In Transit' : t.status}
                                    </span>
                                    <FileText size={16} className="text-[var(--text-tertiary)] hover:text-accent" onClick={(e) => { e.stopPropagation(); downloadPdf(t.id); }} />
                                </div>
                            </button>

                            {expandedId === t.id && (
                                <div className="border-t border-[var(--border-primary)]">
                                    {detailLoading ? (
                                        <div className="p-8 flex justify-center">
                                            <Loader2 size={24} className="animate-spin text-accent" />
                                        </div>
                                    ) : detail ? (
                                        <div className="p-5 space-y-4">
                                            {/* Progress */}
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1 bg-[var(--bg-tertiary)] rounded-full h-2 overflow-hidden">
                                                    <div
                                                        className="h-full bg-emerald-500 rounded-full transition-all"
                                                        style={{ width: `${(detail.received_count / detail.total_count) * 100}%` }}
                                                    />
                                                </div>
                                                <span className="text-[11px] text-[var(--text-secondary)] font-bold">
                                                    {detail.received_count} / {detail.total_count} received
                                                </span>
                                            </div>

                                            {/* Device table */}
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-xs">
                                                    <thead>
                                                        <tr className="border-b border-[var(--border-primary)] text-[var(--text-tertiary)] font-bold uppercase tracking-wider">
                                                            <th className="text-left px-3 py-2">IMEI</th>
                                                            <th className="text-left px-3 py-2">Model</th>
                                                            <th className="text-left px-3 py-2">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {detail.devices.map(d => (
                                                            <tr key={d.imei} className={`border-b border-[var(--bg-secondary)] ${d.device_status !== 'In_Transit' ? 'bg-emerald-500/5' : ''}`}>
                                                                <td className="px-3 py-2 font-mono font-bold text-[var(--text-primary)] tracking-wider">{d.imei}</td>
                                                                <td className="px-3 py-2 text-[var(--text-primary)] font-bold">{d.model_number || '—'}</td>
                                                                <td className="px-3 py-2">
                                                                    <span className={`badge ${getStatusBadge(d.device_status)} text-[10px]`}>
                                                                        {d.device_status.replace(/_/g, ' ')}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Scan to receive */}
                                            <div className="flex gap-3 pt-4 border-t border-[var(--border-primary)]">
                                                <div className="flex-1 relative">
                                                    <input
                                                        value={scanImei}
                                                        onChange={e => setScanImei(e.target.value)}
                                                        onKeyDown={e => { if (e.key === 'Enter') receiveItem(); }}
                                                        placeholder="Scan IMEI to receive..."
                                                        className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] focus:border-accent rounded-lg px-4 py-2.5 font-mono text-sm text-[var(--text-primary)] outline-none transition-all placeholder:text-xs placeholder:text-[var(--text-tertiary)]"
                                                    />
                                                </div>
                                                <button
                                                    onClick={receiveItem}
                                                    disabled={routing || !scanImei.trim()}
                                                    className="bg-accent text-[var(--text-inverse)] hover:bg-accent-hover px-6 py-2.5 rounded-lg font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
                                                >
                                                    {routing ? <Loader2 size={16} className="animate-spin" /> : <ArrowDownCircle size={16} />}
                                                    Receive
                                                </button>
                                                <button
                                                    onClick={receiveAll}
                                                    disabled={routing || detail.received_count >= detail.total_count}
                                                    className="bg-emerald-600 text-white hover:bg-emerald-500 px-4 py-2.5 rounded-lg font-bold text-xs transition-all active:scale-[0.98] disabled:opacity-50"
                                                >
                                                    Receive All
                                                </button>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
