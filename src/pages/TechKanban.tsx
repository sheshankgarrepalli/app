import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Scan, X, AlertTriangle, CheckCircle2, Package } from 'lucide-react';

const COLUMNS = [
    { key: 'Pending_Triage', label: 'Triage', color: 'bg-blue-50 text-blue-800', badge: 'badge-info' },
    { key: 'In_Repair', label: 'In Progress', color: 'bg-amber-50 text-amber-800', badge: 'badge-warning' },
    { key: 'Awaiting_Parts', label: 'Awaiting Parts', color: 'bg-purple-50 text-purple-800', badge: 'badge-purple' },
    { key: 'Completed', label: 'Completed', color: 'bg-emerald-50 text-emerald-800', badge: 'badge-success' },
    { key: 'Cancelled', label: 'Cancelled', color: 'bg-red-50 text-red-800', badge: 'badge-error' },
];

type Ticket = {
    id: number; imei: string; symptoms: string; notes: string;
    status: string; assigned_tech_id: string | null;
    device_model: string | null; device_status: string | null;
    created_at: string; completed_at: string | null;
};

export default function TechKanban() {
    const { token } = useAuth();
    const API = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000');
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [parts, setParts] = useState<any[]>([]);
    const [scanImei, setScanImei] = useState('');

    // Active ticket workspace
    const [active, setActive] = useState<Ticket | null>(null);
    const [workCompleted, setWorkCompleted] = useState<string[]>([]);
    const [consumeSku, setConsumeSku] = useState('');
    const [consumeQty, setConsumeQty] = useState('1');
    const [isProcessing, setIsProcessing] = useState(false);
    const [completionResult, setCompletionResult] = useState<any>(null);

    // New ticket modal
    const [showNew, setShowNew] = useState(false);
    const [newForm, setNewForm] = useState({ imei: '', symptoms: '', notes: '' });

    // Scrap confirm
    const [showScrap, setShowScrap] = useState(false);
    const [scrapReason, setScrapReason] = useState('');
    const [errorToast, setErrorToast] = useState<string | null>(null);

    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => { fetchTickets(); fetchParts(); }, []);

    useEffect(() => {
        if (errorToast) {
            const t = setTimeout(() => setErrorToast(null), 4000);
            return () => clearTimeout(t);
        }
    }, [errorToast]);

    const fetchTickets = async () => {
        try {
            const res = await axios.get(`${API}/api/repair/tickets`, { headers });
            setTickets(res.data);
        } catch (_) {}
    };

    const fetchParts = async () => {
        try {
            const res = await axios.get(`${API}/api/parts/`, { headers });
            setParts(res.data);
        } catch (_) {}
    };

    // Quick scan
    const handleScan = async (e: React.KeyboardEvent) => {
        if (e.key !== 'Enter' || !scanImei.trim()) return;
        const t = tickets.find(t => t.imei === scanImei.trim());
        if (t) {
            openTicket(t);
        } else {
            setNewForm({ imei: scanImei.trim(), symptoms: '', notes: '' });
            setShowNew(true);
        }
        setScanImei('');
    };

    const openTicket = (t: Ticket) => {
        setActive(t);
        setWorkCompleted(t.symptoms ? t.symptoms.split(', ') : []);
        setConsumeSku('');
        setConsumeQty('1');
        setCompletionResult(null);
    };

    // Status move
    const moveStatus = async (ticketId: number, newStatus: string) => {
        try {
            await axios.put(`${API}/api/repair/tickets/${ticketId}`, { status: newStatus }, { headers });
            fetchTickets();
            if (active?.id === ticketId) {
                const t = tickets.find(t => t.id === ticketId);
                if (t) setActive({ ...t, status: newStatus });
            }
        } catch (err: any) {
            setErrorToast(err.response?.data?.detail || 'Move failed');
        }
    };

    // Create ticket
    const handleCreate = async () => {
        try {
            await axios.post(`${API}/api/repair/tickets`, {
                imei: newForm.imei, symptoms: newForm.symptoms, notes: newForm.notes
            }, { headers });
            setShowNew(false);
            setNewForm({ imei: '', symptoms: '', notes: '' });
            fetchTickets();
        } catch (err: any) {
            setErrorToast(err.response?.data?.detail || 'Failed to create ticket');
        }
    };

    // Consume part
    const handleConsume = async () => {
        if (!active || !consumeSku) return;
        setIsProcessing(true);
        try {
            await axios.post(`${API}/api/repair/tickets/${active.id}/consume-part`, {
                part_sku: consumeSku, qty: parseInt(consumeQty) || 1
            }, { headers });
            setConsumeSku('');
            setConsumeQty('1');
            fetchTickets();
            fetchParts();
        } catch (err: any) {
            setErrorToast(err.response?.data?.detail || 'Consume failed');
        } finally { setIsProcessing(false); }
    };

    // Toggle work completed
    const toggleWork = (s: string) => {
        setWorkCompleted(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);
    };

    // Complete repair
    const handleComplete = async () => {
        if (!active) return;
        setIsProcessing(true);
        try {
            const res = await axios.post(`${API}/api/repair/tickets/${active.id}/complete`, {
                imei: active.imei, work_completed: workCompleted
            }, { headers });
            setCompletionResult(res.data);
            fetchTickets();
            fetchParts();
        } catch (err: any) {
            setErrorToast(err.response?.data?.detail || 'Completion failed');
        } finally { setIsProcessing(false); }
    };

    const handleScrap = async () => {
        if (!active) return;
        try {
            await axios.post(`${API}/api/repair/tickets/${active.id}/scrap`, {
                reason: scrapReason
            }, { headers });
            setShowScrap(false);
            setScrapReason('');
            setActive(null);
            fetchTickets();
        } catch (err: any) {
            setErrorToast(err.response?.data?.detail || 'Scrap failed');
        }
    };

    const ticketsByColumn = (col: string) => tickets.filter(t => t.status === col);

    return (
        <div className="flex flex-col h-full">
            <div className="page-header mb-4">
                <div>
                    <h1 className="page-title">Repair Kanban</h1>
                    <p className="text-sm text-[#6b7280] dark:text-[#71717a] mt-1">{tickets.length} active tickets</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Scan size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af] dark:text-[#52525b]" />
                        <input
                            value={scanImei} onChange={e => setScanImei(e.target.value)}
                            onKeyDown={handleScan} placeholder="Scan IMEI..."
                            className="input-stark pl-9 py-2 w-56 text-sm"
                        />
                    </div>
                    <button onClick={() => setShowNew(true)} className="btn-primary">
                        + New Ticket
                    </button>
                </div>
            </div>

            {/* Kanban columns */}
            <div className="flex-1 flex overflow-x-auto gap-4 pb-4">
                {COLUMNS.map(col => {
                    const items = ticketsByColumn(col.key);
                    return (
                        <div key={col.key} className="flex-1 min-w-[240px] flex flex-col bg-[#f0f0f4] rounded-card overflow-hidden">
                            <div className={`px-4 py-3 ${col.color} flex justify-between items-center font-semibold text-sm`}>
                                <span>{col.label}</span>
                                <span className="bg-black/10 text-xs px-2 py-0.5 rounded-full">{items.length}</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                                {items.map(t => (
                                    <div key={t.id}
                                        onClick={() => openTicket(t)}
                                        className={`p-3 card rounded-md cursor-pointer transition-all border-l-[3px] ${active?.id === t.id ? 'border-accent ring-1 ring-accent/20' : col.key === 'Pending_Triage' ? 'border-blue-400' : col.key === 'In_Repair' ? 'border-amber-400' : col.key === 'Awaiting_Parts' ? 'border-purple-400' : col.key === 'Completed' ? 'border-emerald-400' : 'border-red-400'}`}>
                                        <div className="text-xs font-mono text-[#6b7280] dark:text-[#71717a]">{t.imei}</div>
                                        <div className="text-sm font-semibold mt-1">{t.device_model || 'Unknown'}</div>
                                        <div className="text-xs text-[#6b7280] dark:text-[#71717a] mt-0.5 line-clamp-1">{t.symptoms || 'No symptoms'}</div>
                                        <div className="flex items-center justify-between mt-2 text-[11px] text-[#6b7280] dark:text-[#71717a]">
                                            <span className="bg-[#f5f5f5] dark:bg-[#0a0a0b] px-1.5 py-0.5 rounded">{t.assigned_tech_id || 'Unassigned'}</span>
                                        </div>
                                        {col.key === 'Pending_Triage' && (
                                            <div className="flex gap-1 mt-2">
                                                <button onClick={e => { e.stopPropagation(); moveStatus(t.id, 'In_Repair'); }}
                                                    className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-semibold">Start</button>
                                                <button onClick={e => { e.stopPropagation(); moveStatus(t.id, 'Cancelled'); }}
                                                    className="text-[10px] px-2 py-0.5 bg-zinc-100 text-zinc-500 dark:text-[#71717a] rounded font-semibold">Cancel</button>
                                            </div>
                                        )}
                                        {col.key === 'In_Repair' && (
                                            <div className="flex gap-1 mt-2">
                                                <button onClick={e => { e.stopPropagation(); moveStatus(t.id, 'Awaiting_Parts'); }}
                                                    className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-700 rounded font-semibold">Need Parts</button>
                                                <button onClick={e => { e.stopPropagation(); moveStatus(t.id, 'Completed'); }}
                                                    className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded font-semibold">Done</button>
                                            </div>
                                        )}
                                        {col.key === 'Awaiting_Parts' && (
                                            <button onClick={e => { e.stopPropagation(); moveStatus(t.id, 'In_Repair'); }}
                                                className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-semibold mt-2">Parts Arrived</button>
                                        )}
                                    </div>
                                ))}
                                {items.length === 0 && (
                                    <div className="py-8 text-center text-xs text-[#9ca3af] dark:text-[#52525b]">No tickets</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Slide-out workspace */}
            {active && (
                <div className="fixed right-0 top-0 h-full w-[480px] bg-white dark:bg-[#141416] border-l border-[#e5e7eb] dark:border-[#1f1f21] shadow-xl z-50 flex flex-col">
                    <div className="p-5 border-b border-[#e5e7eb] dark:border-[#1f1f21] flex justify-between items-center bg-navy text-white">
                        <div>
                            <h2 className="text-sm font-semibold font-mono">{active.imei}</h2>
                            <p className="text-xs text-white/60 mt-0.5">{active.device_model} &middot; {active.status.replace(/_/g, ' ')}</p>
                        </div>
                        <button onClick={() => { setActive(null); setCompletionResult(null); }} className="text-white/60 hover:text-white">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-6">
                        {completionResult ? (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-6 text-center">
                                <CheckCircle2 size={48} className="text-emerald-400 mx-auto mb-3" />
                                <p className="text-sm font-bold text-emerald-400 uppercase tracking-wide">Repair Complete</p>
                                <div className="mt-3 space-y-1 text-xs">
                                    <p className="text-emerald-400/70">Parts: ${completionResult.part_cost.toFixed(2)} &middot; Labor: ${completionResult.labor_cost.toFixed(2)}</p>
                                    <p className="text-emerald-400 font-bold">Total Cost: ${completionResult.total_cost.toFixed(2)}</p>
                                </div>
                                <button onClick={() => { setActive(null); setCompletionResult(null); }}
                                    className="mt-4 w-full py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 transition-colors">Close</button>
                            </div>
                        ) : (
                            <>
                                {/* Ticket info */}
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-[#6b7280] dark:text-[#71717a] uppercase">Symptoms</label>
                                    <p className="text-sm text-[#1f2937] dark:text-[#e4e4e7] font-medium">{active.symptoms || 'None recorded'}</p>
                                    {active.notes && <p className="text-xs text-[#6b7280] dark:text-[#71717a]">{active.notes}</p>}
                                </div>

                                {/* Work checklist */}
                                {active.symptoms && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-[#6b7280] dark:text-[#71717a] uppercase">Work Checklist</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {active.symptoms.split(', ').map((s: string) => (
                                                <button key={s} onClick={() => toggleWork(s)}
                                                    className={`p-3 text-left border rounded-md text-xs font-semibold ${workCompleted.includes(s) ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-white dark:bg-[#141416] border-[#e5e7eb] dark:border-[#1f1f21] text-[#6b7280] dark:text-[#71717a] hover:border-[#9ca3af]'}`}>
                                                    {workCompleted.includes(s) && <CheckCircle2 size={12} className="inline mr-1 text-emerald-500" />}
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Consume parts */}
                                <div className="space-y-2 bg-[#f5f5f5] dark:bg-[#0a0a0b] rounded-card p-4 border border-[#e5e7eb] dark:border-[#1f1f21]">
                                    <label className="text-xs font-semibold text-[#6b7280] dark:text-[#71717a] uppercase flex items-center gap-1">
                                        <Package size={12} /> Consume Part
                                    </label>
                                    <div className="flex gap-2">
                                        <select value={consumeSku} onChange={e => setConsumeSku(e.target.value)}
                                            className="form-select flex-1 text-xs">
                                            <option value="">Select part...</option>
                                            {parts.map(p => (
                                                <option key={p.sku} value={p.sku}>{p.sku} ({p.current_stock_qty} in stock)</option>
                                            ))}
                                        </select>
                                        <input type="number" value={consumeQty} onChange={e => setConsumeQty(e.target.value)}
                                            className="form-input w-16 text-center text-xs" min="1" />
                                        <button onClick={handleConsume} disabled={isProcessing || !consumeSku}
                                            className="btn-primary text-xs">Use</button>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="space-y-2">
                                    <button onClick={handleComplete} disabled={isProcessing}
                                        className="btn-primary w-full py-3 flex items-center justify-center gap-2">
                                        <CheckCircle2 size={16} /> Complete Repair
                                    </button>
                                    <button onClick={() => setShowScrap(true)}
                                        className="btn-danger w-full py-3 flex items-center justify-center gap-2">
                                        <AlertTriangle size={16} /> Scrap Device
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* New ticket modal */}
            {showNew && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#141416] w-full max-w-md rounded-lg shadow-2xl border border-zinc-200 dark:border-[#1f1f21] overflow-hidden">
                        <div className="p-5 border-b border-zinc-100 dark:border-[#1a1a1c] flex justify-between items-center">
                            <div>
                                <h2 className="text-sm font-bold text-zinc-900 dark:text-[#e4e4e7] uppercase tracking-wide">New Repair Ticket</h2>
                                <p className="text-[10px] font-semibold text-zinc-400 dark:text-[#71717a] uppercase tracking-widest mt-0.5">Register device for repair workflow</p>
                            </div>
                            <button onClick={() => setShowNew(false)} className="text-zinc-400 dark:text-[#71717a] hover:text-zinc-900 dark:hover:text-[#e4e4e7] transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#71717a] ml-1">IMEI / Serial</label>
                                <input
                                    value={newForm.imei}
                                    onChange={e => setNewForm({ ...newForm, imei: e.target.value })}
                                    placeholder="Scan or type device IMEI..."
                                    className="input-stark w-full py-3 text-xs font-mono font-bold tracking-wider placeholder:font-sans placeholder:text-[11px] placeholder:tracking-normal placeholder:text-zinc-400 dark:placeholder:text-[#52525b]"
                                    autoFocus
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#71717a] ml-1">Symptoms</label>
                                <input
                                    value={newForm.symptoms}
                                    onChange={e => setNewForm({ ...newForm, symptoms: e.target.value })}
                                    placeholder="Screen crack, Battery drain, Won't charge..."
                                    className="input-stark w-full py-3 text-xs font-semibold placeholder:text-[11px] placeholder:font-medium placeholder:text-zinc-400 dark:placeholder:text-[#52525b]"
                                />
                                <p className="text-[9px] font-semibold text-zinc-400 dark:text-[#52525b] ml-1">Comma-separated items become the work checklist</p>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#71717a] ml-1">Internal Notes</label>
                                <textarea
                                    value={newForm.notes}
                                    onChange={e => setNewForm({ ...newForm, notes: e.target.value })}
                                    placeholder="Customer description, technician instructions..."
                                    className="input-stark w-full py-3 text-xs h-20 resize-none placeholder:text-[11px] placeholder:font-medium placeholder:text-zinc-400 dark:placeholder:text-[#52525b]"
                                />
                            </div>
                        </div>

                        {/* Inline error state */}
                        {errorToast && (
                            <div className="mx-5 mb-1 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-[10px] font-bold uppercase tracking-widest">
                                <AlertTriangle size={14} /> {errorToast}
                            </div>
                        )}

                        <div className="p-5 border-t border-zinc-100 dark:border-[#1a1a1c] flex gap-3">
                            <button
                                onClick={() => { setShowNew(false); setErrorToast(null); }}
                                className="flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-zinc-200 dark:border-[#1f1f21] text-zinc-500 dark:text-[#71717a] hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={!newForm.imei.trim()}
                                className="flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-lg bg-accent hover:bg-accent/90 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                            >
                                <Package size={14} /> Create Ticket
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Scrap confirm */}
            {showScrap && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#141416] w-full max-w-md rounded-lg shadow-2xl border border-zinc-200 dark:border-[#1f1f21] overflow-hidden">
                        <div className="p-5 border-b border-zinc-100 dark:border-[#1a1a1c] flex justify-between items-center">
                            <div>
                                <h2 className="text-sm font-bold text-red-400 uppercase tracking-wide">Scrap Device</h2>
                                <p className="text-[10px] font-semibold text-zinc-400 dark:text-[#71717a] uppercase tracking-widest mt-0.5">This action is irreversible</p>
                            </div>
                            <button onClick={() => setShowScrap(false)} className="text-zinc-400 dark:text-[#71717a] hover:text-zinc-900 dark:hover:text-[#e4e4e7] transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-xs text-zinc-500 dark:text-[#71717a] font-medium">
                                This marks the device <span className="font-mono font-bold text-zinc-700 dark:text-[#e4e4e7]">{active?.imei}</span> as scrapped and cancels the repair ticket permanently.
                            </p>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#71717a] ml-1">Reason</label>
                                <input
                                    value={scrapReason}
                                    onChange={e => setScrapReason(e.target.value)}
                                    placeholder="Beyond repair, Cost prohibitive, Customer declined..."
                                    className="input-stark w-full py-3 text-xs font-semibold placeholder:text-[11px] placeholder:font-medium placeholder:text-zinc-400 dark:placeholder:text-[#52525b]"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="p-5 border-t border-zinc-100 dark:border-[#1a1a1c] flex gap-3">
                            <button
                                onClick={() => setShowScrap(false)}
                                className="flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-zinc-200 dark:border-[#1f1f21] text-zinc-500 dark:text-[#71717a] hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleScrap}
                                className="flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-lg bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25 transition-colors flex items-center justify-center gap-2"
                            >
                                <AlertTriangle size={14} /> Confirm Scrap
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {errorToast && (
                <div className="fixed bottom-6 right-6 px-5 py-3 rounded-xl shadow-2xl border border-red-500/20 bg-red-500/90 text-white text-xs font-semibold z-50 animate-in slide-in-from-bottom-4">
                    {errorToast}
                </div>
            )}
        </div>
    );
}
