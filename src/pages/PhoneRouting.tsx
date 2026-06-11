import { useState, useRef, useEffect } from 'react';
import api from '../api/api';
import { useLocationFilter } from '../context/LocationContext';
import {
    Search, ArrowRightLeft, Smartphone, Loader2, AlertCircle, CheckCircle2,
    Wrench, ShieldCheck, Trash2, ShoppingCart, Zap, MapPin,
    DollarSign, Calendar, Hash, PackageCheck, XCircle, Info, Clock, Layers,
    FileText, Send
} from 'lucide-react';

interface DeviceInfo {
    imei: string;
    model_number: string;
    storage: string;
    color: string;
    device_status: string;
    cost_basis: number;
    current_bin: string;
    days_in_inventory: number;
    brand: string;
    last_action: string;
    notes?: string | null;
}

interface Transition {
    target: string;
    label: string;
    requirements: string[];
}

const ACTION_DEFINITIONS: Record<string, { icon: typeof ShieldCheck; label: string; prompt: string; color: string }> = {
    In_QC: { icon: Search, label: 'Send to QC', prompt: 'Route to quality inspection station', color: '#00f0ff' },
    In_Repair: { icon: Wrench, label: 'Send to Repair', prompt: 'Route to repair bench for service', color: '#f59e0b' },
    Sellable: { icon: ShieldCheck, label: 'Mark Sellable', prompt: 'Device passed QC — ready for sales floor', color: '#10b981' },
    Awaiting_Parts: { icon: PackageCheck, label: 'Await Parts', prompt: 'Device waiting on part order', color: '#a855f7' },
    In_Transit: { icon: ArrowRightLeft, label: 'Transfer to Location', prompt: 'Select destination to transfer this device', color: '#14b8a6' },
    Sold: { icon: ShoppingCart, label: 'Mark Sold', prompt: 'Record as sold', color: '#3b82f6' },
    Reserved_Layaway: { icon: Zap, label: 'Reserve Layaway', prompt: 'Lock device for layaway customer', color: '#f97316' },
    Scrapped: { icon: XCircle, label: 'Scrap Device', prompt: 'Device damaged beyond repair', color: '#ef4444' },
};

function useStoreLocations() {
    const { availableLocations } = useLocationFilter();
    if (availableLocations.length === 0) {
        return [
            { id: 'warehouse', label: 'Dallas Office' },
            { id: 'grand-prairie', label: 'Grand Prairie' },
            { id: 'foodland', label: 'Foodland' },
            { id: 'fiesta', label: 'Fiesta' },
        ];
    }
    return availableLocations.map(l => ({ id: l.id, label: l.name }));
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

export default function PhoneRouting() {
    const [imei, setImei] = useState('');
    const [device, setDevice] = useState<DeviceInfo | null>(null);
    const [transitions, setTransitions] = useState<Transition[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [routing, setRouting] = useState(false);
    const [notes, setNotes] = useState('');
    const [showLocationPicker, setShowLocationPicker] = useState<string | null>(null);
    const imeiRef = useRef<HTMLInputElement>(null);

    // Batch routing state
    const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
    const [batchImeisText, setBatchImeisText] = useState('');
    const [batchDevices, setBatchDevices] = useState<Map<string, { device: DeviceInfo | null; transitions: Transition[]; error?: string }>>(new Map());
    const [batchLoading, setBatchLoading] = useState(false);
    const [batchRouting, setBatchRouting] = useState(false);
    const [batchResults, setBatchResults] = useState<Array<{ imei: string; success: boolean; error?: string }> | null>(null);
    const [showBatchLocationPicker, setShowBatchLocationPicker] = useState(false);
    const [batchTargetAction, setBatchTargetAction] = useState<string | null>(null);
    const [pendingTransfer, setPendingTransfer] = useState<string | null>(null);
    const [dispatching, setDispatching] = useState(false);

    useEffect(() => { imeiRef.current?.focus(); }, []);
    useEffect(() => { if (!device) imeiRef.current?.focus(); }, [device]);

    const lookupDevice = async (identifier?: string) => {
        const query = (identifier || imei).trim();
        if (!query) return;
        setLoading(true); setError(null); setSuccess(null); setNotes('');
        try {
            const [trackRes, transRes] = await Promise.all([
                api.get(`/api/track/?identifier=${query}`),
                api.get(`/api/inventory/${query}/transitions`),
            ]);
            setDevice(trackRes.data.device);
            setTransitions(transRes.data || []);
        } catch (err: any) {
            setError(err.response?.status === 404 ? `Device ${query} not found` : err.response?.data?.detail || 'Lookup failed');
            setDevice(null); setTransitions([]);
        } finally { setLoading(false); }
    };

    const handleImeiKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') { e.preventDefault(); lookupDevice(); }
    };

    const executeRoute = async (targetStatus: string) => {
        if (!device) return;
        if ((targetStatus === 'Scrapped' || targetStatus === 'Sold') && !window.confirm(`Are you sure you want to mark device ${device.imei} as "${targetStatus}"? This cannot be undone.`)) return;
        setRouting(true); setError(null); setSuccess(null);
        try {
            await api.post(
                `/api/inventory/routing?imei=${device.imei}`,
                { new_status: targetStatus, notes: notes || undefined }
            );
            setSuccess(`Routed ${device.imei} to ${statusLabel(targetStatus)}`);
            setDevice(null); setTransitions([]); setImei('');
            setTimeout(() => { setSuccess(null); imeiRef.current?.focus(); }, 2000);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Routing failed');
        } finally { setRouting(false); }
    };

    const executeTransitToStore = async (targetBin: string) => {
        if (!device) return;
        setRouting(true); setError(null); setSuccess(null); setShowLocationPicker(null);
        try {
            const res = await api.post(
                `/api/transfers/`,
                { imei_list: [device.imei], destination_location_id: targetBin, transfer_type: 'Restock', notes: notes || undefined }
            );
            setPendingTransfer(res.data.transfer_order_id);
            setSuccess(`Transfer ${res.data.transfer_order_id} saved as draft for ${device.imei}`);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Transfer failed');
        } finally { setRouting(false); }
    };

    const clearDevice = () => {
        setDevice(null); setTransitions([]); setImei(''); setError(null); setSuccess(null); setNotes(''); setShowLocationPicker(null);
        imeiRef.current?.focus();
    };

    // ── Batch routing ────────────────────────────────────────────────────────

    const parseImeis = (): string[] => {
        return batchImeisText
            .split(/[\n,]+/)
            .map(s => s.trim())
            .filter(s => s.length > 0);
    };

    const lookupBatch = async () => {
        const imeis = parseImeis();
        if (imeis.length === 0) return;
        setBatchLoading(true); setError(null); setSuccess(null); setBatchResults(null);
        const results = new Map<string, { device: DeviceInfo | null; transitions: Transition[]; error?: string }>();

        // Fetch all devices in parallel, 10 at a time to not overwhelm the server
        const chunkSize = 10;
        for (let i = 0; i < imeis.length; i += chunkSize) {
            const chunk = imeis.slice(i, i + chunkSize);
            const chunkResults = await Promise.all(
                chunk.map(async (imei) => {
                    try {
                        const [trackRes, transRes] = await Promise.all([
                            api.get(`/api/track/?identifier=${imei}`),
                            api.get(`/api/inventory/${imei}/transitions`),
                        ]);
                        return { imei, device: trackRes.data.device as DeviceInfo, transitions: transRes.data as Transition[] };
                    } catch (err: any) {
                        return { imei, device: null, transitions: [], error: err.response?.data?.detail || 'Lookup failed' };
                    }
                })
            );
            for (const r of chunkResults) {
                results.set(r.imei, { device: r.device, transitions: r.transitions, error: r.error });
            }
        }

        setBatchDevices(results);
        setBatchLoading(false);
    };

    const getCommonTransitions = (): Transition[] => {
        const allTransitions: Transition[][] = [];
        for (const [, data] of batchDevices) {
            if (data.device && data.transitions.length > 0) {
                allTransitions.push(data.transitions);
            }
        }
        if (allTransitions.length === 0) return [];
        const [first, ...rest] = allTransitions;
        return first.filter(t =>
            rest.every(other => other.some(ot => ot.target === t.target))
        );
    };

    const executeBatchRoute = async (targetStatus: string, targetBin: string, notesStr: string) => {
        if (foundDevices.length === 0) return;
        setBatchRouting(true); setError(null); setSuccess(null); setBatchResults(null); setShowBatchLocationPicker(false); setBatchTargetAction(null);
        const items = foundDevices.map(d => ({
            imei: d.device!.imei,
            new_status: targetStatus,
            new_bin: targetBin || undefined,
            notes: notesStr || undefined,
        }));

        try {
            const res = await api.post(
                `/api/inventory/routing/batch`,
                { items }
            );
            const data = res.data as { results: Array<{ imei: string; success: boolean; error?: string }>; total: number; succeeded: number; failed: number };
            setBatchResults(data.results);
            setSuccess(`Batch complete: ${data.succeeded} succeeded, ${data.failed} failed`);
            if (data.succeeded > 0) {
                setBatchImeisText('');
                setBatchDevices(new Map());
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Batch routing failed');
        } finally {
            setBatchRouting(false);
        }
    };

    const handleBatchActionClick = (targetStatus: string) => {
        if (targetStatus === 'In_Transit') {
            setBatchTargetAction(targetStatus);
            setShowBatchLocationPicker(true);
        } else {
            executeBatchRoute(targetStatus, '', notes);
        }
    };

    const handleBatchTransitSelect = async (targetBin: string) => {
        if (foundDevices.length === 0) return;
        setBatchRouting(true); setError(null); setSuccess(null);
        setShowBatchLocationPicker(false); setBatchTargetAction(null);
        try {
            const res = await api.post(
                `/api/transfers/`,
                {
                    imei_list: foundDevices.map(d => d.device!.imei),
                    destination_location_id: targetBin,
                    transfer_type: 'Restock',
                    notes: notes || undefined,
                }
            );
            setPendingTransfer(res.data.transfer_order_id);
            setSuccess(`Transfer ${res.data.transfer_order_id} saved as draft with ${foundDevices.length} devices`);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Batch transfer failed');
        } finally { setBatchRouting(false); }
    };

    const downloadTransferPdf = async (id: string) => {
        try {
            const res = await api.get(`/api/transfers/${id}/pdf`, {
                responseType: 'blob',
            });
            const url = URL.createObjectURL(res.data);
            window.open(url, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch {
            setError('Failed to download transfer PDF');
        }
    };

    const dispatchTransfer = async (id: string) => {
        setDispatching(true); setError(null);
        try {
            await api.post(
                `/api/transfers/${id}/dispatch`,
                {}
            );
            const count = activeTab === 'batch' ? foundDevices.length : 1;
            setSuccess(`Transfer ${id} dispatched — ${count} device(s) now In Transit`);
            setPendingTransfer(null);
            if (activeTab === 'batch') {
                setBatchImeisText('');
                setBatchDevices(new Map());
                setBatchResults(null);
            } else {
                setDevice(null); setTransitions([]); setImei(''); setNotes('');
                setTimeout(() => imeiRef.current?.focus(), 100);
            }
            setTimeout(() => setSuccess(null), 5000);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Dispatch failed');
        } finally { setDispatching(false); }
    };

    const foundDevices = Array.from(batchDevices.entries())
        .filter(([, data]) => data.device !== null)
        .map(([imei, data]) => ({ imei, device: data.device!, transitions: data.transitions }));

    const notFoundImeis = Array.from(batchDevices.entries())
        .filter(([, data]) => data.error)
        .map(([imei, data]) => ({ imei, error: data.error! }));

    const commonTransitions = getCommonTransitions();
    const storeLocations = useStoreLocations();

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Page Header */}
            <div>
                <h1 className="text-[22px] font-bold text-[var(--text)] flex items-center gap-3">
                    Routing Hub
                    <span className="bg-accent/10 text-accent text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider font-bold border border-accent/20">
                        Command & Control
                    </span>
                </h1>
                <p className="text-xs text-[var(--text-secondary)] mt-1">Scan an IMEI to inspect device state and route to the next station</p>
            </div>

            {/* Tab Bar */}
            <div className="flex gap-1 bg-[var(--bg-card)] rounded-xl p-1 border border-[var(--border)] w-fit">
                <button
                    onClick={() => { setActiveTab('single'); setError(null); setSuccess(null); }}
                    className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'single' ? 'bg-accent text-[var(--text-inverse)]' : 'text-[var(--text-secondary)] hover:text-[var(--text)]'}`}
                >
                    Single Device
                </button>
                <button
                    onClick={() => { setActiveTab('batch'); setError(null); setSuccess(null); }}
                    className={`px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'batch' ? 'bg-accent text-[var(--text-inverse)]' : 'text-[var(--text-secondary)] hover:text-[var(--text)]'}`}
                >
                    <Layers size={16} />
                    Batch Routing
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-lg flex items-center gap-3 text-red-400 text-xs font-bold">
                    <AlertCircle size={16} /> {error}
                    <button onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-400">Dismiss</button>
                </div>
            )}
            {success && (
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-lg flex items-center gap-3 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 size={16} /> {success}
                </div>
            )}

            {/* ═══ SINGLE DEVICE TAB ═══ */}
            {activeTab === 'single' && (
                <>
                    {/* Scanner + Look Up Button */}
                    <div className="flex gap-3">
                        <div className="flex-1 relative bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
                            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-accent/5 via-transparent to-purple-500/5 pointer-events-none" />
                            <div className="relative">
                                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-accent">
                                    <Search size={22} />
                                </div>
                                <input
                                    ref={imeiRef}
                                    value={imei}
                                    onChange={e => setImei(e.target.value)}
                                    onKeyDown={handleImeiKey}
                                    placeholder="Enter IMEI to look up..."
                                    className="w-full bg-transparent pl-14 pr-6 py-5 text-lg font-mono font-bold tracking-wider text-[var(--text)] outline-none placeholder:font-sans placeholder:text-sm placeholder:tracking-normal placeholder:text-[var(--text-tertiary)]"
                                    autoFocus
                                    disabled={loading}
                                />
                                {loading && (
                                    <div className="absolute right-5 top-1/2 -translate-y-1/2">
                                        <Loader2 size={20} className="animate-spin text-accent" />
                                    </div>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => lookupDevice()}
                            disabled={loading || !imei.trim()}
                            className="bg-accent text-[var(--text-inverse)] hover:bg-accent-hover px-8 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
                        >
                            <Search size={18} />
                            Look Up
                        </button>
                    </div>

                    {/* Empty State */}
                    {!device && !loading && (
                        <div className="card">
                            <div className="card-body py-24 flex flex-col items-center justify-center space-y-3">
                                <ArrowRightLeft size={56} className="text-[var(--text-muted)]" />
                                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Awaiting IMEI</p>
                                <p className="text-[10px] text-[var(--text-tertiary)] text-center max-w-sm">Enter an IMEI and click Look Up to view device details and routing actions</p>
                            </div>
                        </div>
                    )}

                    {device && (
                        <>
                            {/* Device Details Card */}
                            <div className="card overflow-hidden">
                                <div className="px-5 py-4 bg-navy border-b border-[var(--border)] flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Smartphone size={18} className="text-accent" />
                                        <span className="text-[var(--text)] font-bold text-base">{device.model_number || 'Unknown Model'}</span>
                                        <span className={`badge ${getStatusBadge(device.device_status)} text-[10px]`}>
                                            {statusLabel(device.device_status)}
                                        </span>
                                    </div>
                                    <button onClick={clearDevice} className="text-[var(--text-tertiary)] hover:text-[var(--text)] transition-colors" title="Clear device">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                <div className="card-body">
                                    <div className="grid grid-cols-4 gap-4">
                                        <div>
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1.5 mb-1">
                                                <Hash size={11} /> IMEI
                                            </div>
                                            <div className="font-mono text-sm font-bold text-[var(--text)] tracking-wider">{device.imei}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1.5 mb-1">
                                                <Smartphone size={11} /> Model
                                            </div>
                                            <div className="text-sm font-bold text-[var(--text)]">{device.model_number || '—'}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1.5 mb-1">
                                                <Info size={11} /> Status
                                            </div>
                                            <span className={`badge ${getStatusBadge(device.device_status)} text-[10px]`}>
                                                {statusLabel(device.device_status)}
                                            </span>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1.5 mb-1">
                                                <MapPin size={11} /> Location
                                            </div>
                                            <div className="text-sm font-bold text-[var(--text)]">{device.current_bin?.replace(/_/g, ' ') || '—'}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1.5 mb-1">
                                                <DollarSign size={11} /> Cost Basis
                                            </div>
                                            <div className="font-mono text-sm font-bold text-[var(--text)]">${(device.cost_basis || 0).toFixed(2)}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1.5 mb-1">
                                                <Calendar size={11} /> Days in Inventory
                                            </div>
                                            <div className="font-mono text-sm font-bold text-[var(--text)]">{device.days_in_inventory ?? '—'}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1.5 mb-1">
                                                <Info size={11} /> Brand
                                            </div>
                                            <div className="text-sm font-bold text-[var(--text)]">{device.brand || '—'}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1.5 mb-1">
                                                <Clock size={11} /> Last Action
                                            </div>
                                            <div className="text-sm font-bold text-[var(--text)] truncate">{device.last_action || '—'}</div>
                                        </div>
                                    </div>
                                    {device.notes && (
                                        <div className="mt-3 pt-3 border-t border-[var(--border)]">
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1.5 mb-1">
                                                <FileText size={11} /> Notes
                                            </div>
                                            <div className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">{device.notes}</div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Routing Actions */}
                            {transitions.length > 0 ? (
                                <div className="card overflow-hidden">
                                    <div className="card-header">
                                        <span className="flex items-center gap-2">
                                            <ArrowRightLeft size={16} className="text-accent" /> Available Routing Actions
                                        </span>
                                        <span className="text-[11px] text-[var(--text-tertiary)]">{transitions.length} actions</span>
                                    </div>
                                    <div className="card-body space-y-4">
                                        <div className="grid grid-cols-4 gap-3">
                                            {transitions.map(t => {
                                                const def = ACTION_DEFINITIONS[t.target];
                                                if (!def) return null;
                                                const Icon = def.icon;
                                                const isTransit = t.target === 'In_Transit';
                                                const showingPicker = showLocationPicker === t.target;

                                                if (isTransit && showingPicker) {
                                                    return (
                                                        <div key={t.target} className="col-span-4 space-y-2">
                                                            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
                                                                <MapPin size={12} /> Select Destination Location
                                                            </div>
                                                            <div className="grid grid-cols-4 gap-3">
                                                                {storeLocations.map(store => (
                                                                    <button
                                                                        key={store.id}
                                                                        onClick={() => executeTransitToStore(store.id)}
                                                                        disabled={routing}
                                                                        className="flex items-center gap-3 p-4 rounded-xl border-2 border-[var(--border-secondary)] hover:border-accent bg-[var(--bg-primary)] transition-all text-left disabled:opacity-50"
                                                                    >
                                                                        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                                                                            <MapPin size={20} className="text-accent" />
                                                                        </div>
                                                                        <div>
                                                                            <div className="text-sm font-bold text-[var(--text)]">{store.label}</div>
                                                                            <div className="text-[10px] text-[var(--text-tertiary)]">Transfer device to this location</div>
                                                                        </div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <button
                                                                onClick={() => setShowLocationPicker(null)}
                                                                className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <button
                                                        key={t.target}
                                                        onClick={() => isTransit ? setShowLocationPicker(t.target) : executeRoute(t.target)}
                                                        disabled={routing}
                                                        className="group flex flex-col gap-3 p-4 rounded-xl border-2 border-[var(--border-secondary)] hover:border-[var(--action-color)] bg-[var(--bg-primary)] transition-all text-left disabled:opacity-50 disabled:pointer-events-none"
                                                        style={{ '--action-color': def.color } as React.CSSProperties}
                                                    >
                                                        <div
                                                            className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
                                                            style={{ backgroundColor: `${def.color}15` }}
                                                        >
                                                            <Icon size={22} style={{ color: def.color }} />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold text-[var(--text)]">{def.label}</div>
                                                            <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-tight">{def.prompt}</div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Notes */}
                                        <div className="pt-4 border-t border-[var(--border)]">
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">Routing Notes</div>
                                            <textarea
                                                value={notes}
                                                onChange={e => setNotes(e.target.value)}
                                                placeholder="Add notes about this routing action..."
                                                rows={3}
                                                className="w-full bg-[var(--bg-muted)] border border-[var(--border-secondary)] focus:border-accent rounded-lg px-4 py-3 text-sm text-[var(--text)] outline-none transition-all placeholder:text-xs placeholder:text-[var(--text-tertiary)] resize-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="card">
                                    <div className="card-body py-12 flex flex-col items-center justify-center space-y-2">
                                        <AlertCircle size={32} className="text-[var(--text-muted)]" />
                                        <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">No routing actions available</p>
                                        <p className="text-[10px] text-[var(--text-tertiary)]">Terminal state — no valid transitions</p>
                                    </div>
                                </div>
                            )}

                            {/* Pending transfer for single device */}
                            {pendingTransfer && device && (
                                <div className="card overflow-hidden" style={{ borderColor: 'var(--accent)' }}>
                                    <div className="card-header">
                                        <span className="flex items-center gap-2">
                                            <CheckCircle2 size={16} className="text-emerald-400" /> Transfer Saved
                                        </span>
                                        <span className="badge badge-neutral text-[10px]">{pendingTransfer}</span>
                                    </div>
                                    <div className="card-body">
                                        <p className="text-xs text-[var(--text-secondary)] mb-4">
                                            Device {device.imei} saved to draft transfer. Download the manifest first, then dispatch.
                                        </p>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => downloadTransferPdf(pendingTransfer)}
                                                className="btn-secondary flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold"
                                            >
                                                <FileText size={16} /> Download Manifest
                                            </button>
                                            <button
                                                onClick={() => dispatchTransfer(pendingTransfer)}
                                                disabled={dispatching}
                                                className="bg-accent text-[var(--text-inverse)] hover:bg-accent-hover px-5 py-2.5 rounded-lg text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
                                            >
                                                {dispatching ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                                Initiate Transfer
                                            </button>
                                            <button
                                                onClick={() => { setPendingTransfer(null); setError(null); }}
                                                className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </>
            )}

            {/* ═══ BATCH ROUTING TAB ═══ */}
            {activeTab === 'batch' && (
                <>
                    {/* IMEI textarea */}
                    <div className="card overflow-hidden">
                        <div className="card-header">
                            <span className="flex items-center gap-2">
                                <Layers size={16} className="text-accent" /> Batch Device Entry
                            </span>
                        </div>
                        <div className="card-body space-y-4">
                            <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                                    Enter IMEIs (one per line or comma-separated)
                                </div>
                                <textarea
                                    value={batchImeisText}
                                    onChange={e => setBatchImeisText(e.target.value)}
                                    placeholder={"356644449990012\n356644449990013\n356644449990014"}
                                    rows={6}
                                    className="w-full bg-[var(--bg-muted)] border border-[var(--border-secondary)] focus:border-accent rounded-lg px-4 py-3 font-mono text-sm text-[var(--text)] outline-none transition-all placeholder:text-xs placeholder:text-[var(--text-tertiary)] resize-none"
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={lookupBatch}
                                    disabled={batchLoading || !batchImeisText.trim()}
                                    className="bg-accent text-[var(--text-inverse)] hover:bg-accent-hover px-6 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
                                >
                                    {batchLoading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                                    Look Up All
                                </button>
                                <span className="text-[11px] text-[var(--text-tertiary)]">
                                    {parseImeis().length > 0 && `${parseImeis().length} IMEI(s) entered`}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Results: Device Table */}
                    {(foundDevices.length > 0 || notFoundImeis.length > 0) && (
                        <div className="card overflow-hidden">
                            <div className="card-header">
                                <span className="flex items-center gap-2">
                                    <Smartphone size={16} className="text-accent" /> Devices Found
                                </span>
                                <span className="text-[11px] text-[var(--text-tertiary)]">
                                    {foundDevices.length} found{notFoundImeis.length > 0 ? `, ${notFoundImeis.length} not found` : ''}
                                </span>
                            </div>
                            <div className="card-body p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-[var(--border)] text-[var(--text-tertiary)] font-bold uppercase tracking-wider">
                                                <th className="text-left px-5 py-3">IMEI</th>
                                                <th className="text-left px-5 py-3">Model</th>
                                                <th className="text-left px-5 py-3">Status</th>
                                                <th className="text-left px-5 py-3">Location</th>
                                                <th className="text-left px-5 py-3">Brand</th>
                                                <th className="text-right px-5 py-3">Cost Basis</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {foundDevices.map(({ imei, device: d }) => (
                                                <tr key={imei} className="border-b border-[var(--bg-secondary)] hover:bg-[var(--bg-muted)]/50 transition-colors">
                                                    <td className="px-5 py-3 font-mono font-bold text-[var(--text)] tracking-wider">{d.imei}</td>
                                                    <td className="px-5 py-3 text-[var(--text)] font-bold">{d.model_number || '—'}</td>
                                                    <td className="px-5 py-3">
                                                        <span className={`badge ${getStatusBadge(d.device_status)} text-[10px]`}>
                                                            {statusLabel(d.device_status)}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3 text-[var(--text)]">{d.current_bin?.replace(/_/g, ' ') || '—'}</td>
                                                    <td className="px-5 py-3 text-[var(--text)]">{d.brand || '—'}</td>
                                                    <td className="px-5 py-3 text-right font-mono text-[var(--text)]">${(d.cost_basis || 0).toFixed(2)}</td>
                                                </tr>
                                            ))}
                                            {notFoundImeis.map(({ imei, error: errMsg }) => (
                                                <tr key={imei} className="border-b border-[var(--bg-secondary)] bg-red-500/5">
                                                    <td className="px-5 py-3 font-mono text-red-400 font-bold tracking-wider">{imei}</td>
                                                    <td className="px-5 py-3 text-red-400 italic" colSpan={5}>{errMsg}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Batch results summary */}
                    {batchResults && (
                        <div className="card overflow-hidden">
                            <div className="card-header">
                                <span className="flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-accent" /> Batch Results
                                </span>
                            </div>
                            <div className="card-body p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-[var(--border)] text-[var(--text-tertiary)] font-bold uppercase tracking-wider">
                                                <th className="text-left px-5 py-3">IMEI</th>
                                                <th className="text-left px-5 py-3">Result</th>
                                                <th className="text-left px-5 py-3">Error</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {batchResults.map(r => (
                                                <tr key={r.imei} className={`border-b border-[var(--bg-secondary)] ${r.success ? '' : 'bg-red-500/5'}`}>
                                                    <td className="px-5 py-3 font-mono font-bold text-[var(--text)] tracking-wider">{r.imei}</td>
                                                    <td className="px-5 py-3">
                                                        {r.success
                                                            ? <span className="text-emerald-400 font-bold">Success</span>
                                                            : <span className="text-red-400 font-bold">Failed</span>
                                                        }
                                                    </td>
                                                    <td className="px-5 py-3 text-[var(--text-secondary)]">{r.error || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Batch Routing Actions */}
                    {foundDevices.length > 0 && commonTransitions.length > 0 && !batchResults && (
                        <div className="card overflow-hidden">
                            <div className="card-header">
                                <span className="flex items-center gap-2">
                                    <ArrowRightLeft size={16} className="text-accent" /> Batch Routing Actions
                                </span>
                                <span className="text-[11px] text-[var(--text-tertiary)]">
                                    {commonTransitions.length} common action(s) across {foundDevices.length} device(s)
                                </span>
                            </div>
                            <div className="card-body space-y-4">
                                {showBatchLocationPicker && batchTargetAction ? (
                                    <div className="space-y-2">
                                        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
                                            <MapPin size={12} /> Select Destination for {foundDevices.length} device(s)
                                        </div>
                                        <div className="grid grid-cols-4 gap-3">
                                            {storeLocations.map(store => (
                                                <button
                                                    key={store.id}
                                                    onClick={() => handleBatchTransitSelect(store.id)}
                                                    disabled={batchRouting}
                                                    className="flex items-center gap-3 p-4 rounded-xl border-2 border-[var(--border-secondary)] hover:border-accent bg-[var(--bg-primary)] transition-all text-left disabled:opacity-50"
                                                >
                                                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                                                        <MapPin size={20} className="text-accent" />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-[var(--text)]">{store.label}</div>
                                                        <div className="text-[10px] text-[var(--text-tertiary)]">Transfer all devices to this location</div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            onClick={() => { setShowBatchLocationPicker(false); setBatchTargetAction(null); }}
                                            className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-4 gap-3">
                                        {commonTransitions.map(t => {
                                            const def = ACTION_DEFINITIONS[t.target];
                                            if (!def) return null;
                                            const Icon = def.icon;
                                            return (
                                                <button
                                                    key={t.target}
                                                    onClick={() => handleBatchActionClick(t.target)}
                                                    disabled={batchRouting}
                                                    className="group flex flex-col gap-3 p-4 rounded-xl border-2 border-[var(--border-secondary)] hover:border-[var(--action-color)] bg-[var(--bg-primary)] transition-all text-left disabled:opacity-50 disabled:pointer-events-none"
                                                    style={{ '--action-color': def.color } as React.CSSProperties}
                                                >
                                                    <div
                                                        className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
                                                        style={{ backgroundColor: `${def.color}15` }}
                                                    >
                                                        <Icon size={22} style={{ color: def.color }} />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-[var(--text)]">{def.label}</div>
                                                        <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-tight">
                                                            Route {foundDevices.length} device(s)
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Notes for batch */}
                                {!showBatchLocationPicker && (
                                    <div className="pt-4 border-t border-[var(--border)]">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">Batch Routing Notes</div>
                                        <textarea
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)}
                                            placeholder="Add notes applied to all devices in this batch..."
                                            rows={3}
                                            className="w-full bg-[var(--bg-muted)] border border-[var(--border-secondary)] focus:border-accent rounded-lg px-4 py-3 text-sm text-[var(--text)] outline-none transition-all placeholder:text-xs placeholder:text-[var(--text-tertiary)] resize-none"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* No common transitions warning */}
                    {foundDevices.length > 0 && commonTransitions.length === 0 && !batchResults && (
                        <div className="card">
                            <div className="card-body py-12 flex flex-col items-center justify-center space-y-2">
                                <AlertCircle size={32} className="text-[var(--text-muted)]" />
                                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">No common routing actions</p>
                                <p className="text-[10px] text-[var(--text-tertiary)] text-center max-w-sm">
                                    The selected devices don't share any valid routing targets. Devices may be in incompatible states.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Pending transfer — show download + dispatch actions */}
                    {pendingTransfer && (
                        <div className="card overflow-hidden border-accent/30" style={{ borderColor: 'var(--accent)' }}>
                            <div className="card-header">
                                <span className="flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-emerald-400" /> Transfer Saved
                                </span>
                                <span className="badge badge-neutral text-[10px]">{pendingTransfer}</span>
                            </div>
                            <div className="card-body">
                                <p className="text-xs text-[var(--text-secondary)] mb-4">
                                    {foundDevices.length} device(s) saved to draft transfer. Download the manifest first, then initiate the dispatch.
                                </p>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => downloadTransferPdf(pendingTransfer)}
                                        className="btn-secondary flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold"
                                    >
                                        <FileText size={16} /> Download Manifest
                                    </button>
                                    <button
                                        onClick={() => dispatchTransfer(pendingTransfer)}
                                        disabled={dispatching}
                                        className="bg-accent text-[var(--text-inverse)] hover:bg-accent-hover px-5 py-2.5 rounded-lg text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {dispatching ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                        Initiate Transfer
                                    </button>
                                    <button
                                        onClick={() => { setPendingTransfer(null); setError(null); }}
                                        className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                                    >
                                        Cancel Transfer
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Empty: no IMEIs entered yet */}
                    {batchDevices.size === 0 && !batchLoading && (
                        <div className="card">
                            <div className="card-body py-24 flex flex-col items-center justify-center space-y-3">
                                <Layers size={56} className="text-[var(--text-muted)]" />
                                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Batch Mode Ready</p>
                                <p className="text-[10px] text-[var(--text-tertiary)] text-center max-w-sm">
                                    Paste multiple IMEIs above and click "Look Up All" to inspect and route devices in bulk
                                </p>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
