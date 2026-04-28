import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Scan, X, AlertTriangle, CheckCircle2, Package } from 'lucide-react';

const COLUMNS = [
    { key: 'Pending_Triage', label: 'Triage', color: 'border-amber-300 bg-amber-50' },
    { key: 'In_Repair', label: 'In Progress', color: 'border-blue-300 bg-blue-50' },
    { key: 'Awaiting_Parts', label: 'Awaiting Parts', color: 'border-orange-300 bg-orange-50' },
    { key: 'Completed', label: 'Completed', color: 'border-emerald-300 bg-emerald-50' },
    { key: 'Cancelled', label: 'Cancelled', color: 'border-zinc-300 bg-zinc-100' },
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

    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => { fetchTickets(); fetchParts(); }, []);

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
            alert(err.response?.data?.detail || 'Move failed');
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
            alert(err.response?.data?.detail || 'Failed to create ticket');
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
            alert(err.response?.data?.detail || 'Consume failed');
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
            alert(err.response?.data?.detail || 'Completion failed');
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
            alert(err.response?.data?.detail || 'Scrap failed');
        }
    };

    const ticketsByColumn = (col: string) => tickets.filter(t => t.status === col);

    return (
        <div className="flex flex-col h-full bg-zinc-50">
            <header className="p-4 bg-white border-b border-zinc-200 flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold text-zinc-900">Repair Kanban</h1>
                    <p className="text-xs text-zinc-500">{tickets.length} active tickets</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Scan size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                            value={scanImei} onChange={e => setScanImei(e.target.value)}
                            onKeyDown={handleScan} placeholder="Scan IMEI..."
                            className="input-stark pl-9 py-2 w-56 text-sm"
                        />
                    </div>
                    <button onClick={() => setShowNew(true)} className="btn-primary px-4 py-2 text-xs font-semibold uppercase tracking-widest">
                        + New Ticket
                    </button>
                </div>
            </header>

            {/* Kanban columns */}
            <div className="flex-1 flex overflow-x-auto p-4 gap-4">
                {COLUMNS.map(col => {
                    const items = ticketsByColumn(col.key);
                    return (
                        <div key={col.key} className="flex-1 min-w-[220px] flex flex-col bg-white border border-zinc-200 rounded-lg overflow-hidden">
                            <div className={`px-4 py-2 border-b ${col.color} flex justify-between items-center`}>
                                <span className="text-xs font-bold uppercase tracking-widest text-zinc-700">{col.label}</span>
                                <span className="text-xs font-bold text-zinc-400">{items.length}</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                {items.map(t => (
                                    <div key={t.id}
                                        onClick={() => openTicket(t)}
                                        className={`p-3 rounded border text-left cursor-pointer transition-all ${active?.id === t.id ? 'border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900' : 'border-zinc-200 hover:border-zinc-400 bg-white'}`}>
                                        <div className="text-xs font-mono font-bold text-zinc-900">{t.imei}</div>
                                        <div className="text-[10px] text-zinc-500 uppercase mt-1">{t.device_model || '—'}</div>
                                        <div className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">{t.symptoms || 'No symptoms'}</div>
                                        {/* Quick moves */}
                                        {col.key === 'Pending_Triage' && (
                                            <div className="flex gap-1 mt-2">
                                                <button onClick={e => { e.stopPropagation(); moveStatus(t.id, 'In_Repair'); }}
                                                    className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-bold">Start</button>
                                                <button onClick={e => { e.stopPropagation(); moveStatus(t.id, 'Cancelled'); }}
                                                    className="text-[10px] px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded font-bold">Cancel</button>
                                            </div>
                                        )}
                                        {col.key === 'In_Repair' && (
                                            <div className="flex gap-1 mt-2">
                                                <button onClick={e => { e.stopPropagation(); moveStatus(t.id, 'Awaiting_Parts'); }}
                                                    className="text-[10px] px-2 py-0.5 bg-orange-100 text-orange-700 rounded font-bold">Need Parts</button>
                                                <button onClick={e => { e.stopPropagation(); moveStatus(t.id, 'Completed'); }}
                                                    className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded font-bold">Done</button>
                                            </div>
                                        )}
                                        {col.key === 'Awaiting_Parts' && (
                                            <button onClick={e => { e.stopPropagation(); moveStatus(t.id, 'In_Repair'); }}
                                                className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-bold mt-2">Parts Arrived</button>
                                        )}
                                    </div>
                                ))}
                                {items.length === 0 && (
                                    <div className="py-8 text-center text-[10px] font-semibold uppercase text-zinc-300">Empty</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Slide-out workspace */}
            {active && (
                <div className="fixed right-0 top-0 h-full w-[480px] bg-white border-l border-zinc-200 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
                    <div className="p-4 border-b border-zinc-200 flex justify-between items-center">
                        <div>
                            <h2 className="text-sm font-bold text-zinc-900 font-mono">{active.imei}</h2>
                            <p className="text-[10px] text-zinc-500 uppercase">{active.device_model} — {active.status.replace('_', ' ')}</p>
                        </div>
                        <button onClick={() => { setActive(null); setCompletionResult(null); }}>
                            <X size={20} className="text-zinc-400 hover:text-zinc-900" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {completionResult ? (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 text-center">
                                <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-3" />
                                <p className="text-sm font-bold text-emerald-800 uppercase tracking-widest">Repair Complete</p>
                                <p className="text-xs text-emerald-600 mt-2">Parts: ${completionResult.part_cost.toFixed(2)} | Labor: ${completionResult.labor_cost.toFixed(2)}</p>
                                <p className="text-xs text-emerald-600 font-bold">Total: ${completionResult.total_cost.toFixed(2)}</p>
                                <button onClick={() => { setActive(null); setCompletionResult(null); }}
                                    className="btn-primary px-6 py-2 mt-4 text-xs uppercase tracking-widest">Close</button>
                            </div>
                        ) : (
                            <>
                                {/* Ticket info */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Symptoms</label>
                                    <p className="text-sm text-zinc-700 font-medium">{active.symptoms || 'None recorded'}</p>
                                    {active.notes && <p className="text-xs text-zinc-500">{active.notes}</p>}
                                </div>

                                {/* Work checklist */}
                                {active.symptoms && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Work Checklist</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {active.symptoms.split(', ').map((s: string) => (
                                                <button key={s} onClick={() => toggleWork(s)}
                                                    className={`p-3 text-left border rounded text-xs font-bold uppercase tracking-wider ${workCompleted.includes(s) ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-400'}`}>
                                                    {workCompleted.includes(s) && <CheckCircle2 size={12} className="inline mr-1 text-emerald-500" />}
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Consume parts */}
                                <div className="space-y-2 bg-zinc-50 rounded-lg p-4 border border-zinc-200">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-1">
                                        <Package size={12} /> Consume Part
                                    </label>
                                    <div className="flex gap-2">
                                        <select value={consumeSku} onChange={e => setConsumeSku(e.target.value)}
                                            className="input-stark flex-1 py-2 text-xs font-bold">
                                            <option value="">Select part...</option>
                                            {parts.map(p => (
                                                <option key={p.sku} value={p.sku}>{p.sku} ({p.current_stock_qty} in stock)</option>
                                            ))}
                                        </select>
                                        <input type="number" value={consumeQty} onChange={e => setConsumeQty(e.target.value)}
                                            className="input-stark w-16 py-2 text-xs text-center" min="1" />
                                        <button onClick={handleConsume} disabled={isProcessing || !consumeSku}
                                            className="btn-primary px-3 py-2 text-[10px] uppercase tracking-widest">
                                            Use
                                        </button>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="space-y-2">
                                    <button onClick={handleComplete} disabled={isProcessing}
                                        className="btn-primary w-full py-3 text-xs font-bold uppercase tracking-[0.15em] flex items-center justify-center gap-2">
                                        <CheckCircle2 size={16} /> Complete Repair
                                    </button>
                                    <button onClick={() => setShowScrap(true)}
                                        className="w-full py-3 text-xs font-bold uppercase tracking-[0.15em] border border-red-300 text-red-600 rounded-lg hover:bg-red-50 flex items-center justify-center gap-2">
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 p-8 w-full max-w-md">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-widest">New Repair Ticket</h2>
                            <button onClick={() => setShowNew(false)}><X size={20} className="text-zinc-400 hover:text-zinc-900" /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold uppercase text-zinc-500">IMEI</label>
                                <input value={newForm.imei} onChange={e => setNewForm({ ...newForm, imei: e.target.value })}
                                    className="input-stark w-full py-3 text-sm font-mono font-bold mt-1" required />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase text-zinc-500">Symptoms (comma-separated)</label>
                                <input value={newForm.symptoms} onChange={e => setNewForm({ ...newForm, symptoms: e.target.value })}
                                    placeholder="Screen, Battery, Charge Port"
                                    className="input-stark w-full py-3 text-sm font-bold mt-1" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase text-zinc-500">Notes</label>
                                <input value={newForm.notes} onChange={e => setNewForm({ ...newForm, notes: e.target.value })}
                                    className="input-stark w-full py-3 text-sm mt-1" />
                            </div>
                            <button onClick={handleCreate}
                                className="btn-primary w-full py-3 text-xs font-semibold uppercase tracking-[0.2em]">
                                Create Ticket
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Scrap confirm */}
            {showScrap && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 p-8 w-full max-w-md">
                        <h2 className="text-sm font-bold text-red-600 uppercase tracking-widest mb-4">Scrap Device</h2>
                        <p className="text-xs text-zinc-500 mb-4">This marks the device as scrapped and cancels the repair ticket.</p>
                        <input value={scrapReason} onChange={e => setScrapReason(e.target.value)}
                            placeholder="Reason for scrapping..." className="input-stark w-full py-3 text-sm mb-4" />
                        <div className="flex gap-2">
                            <button onClick={() => setShowScrap(false)}
                                className="flex-1 py-3 text-xs font-bold uppercase border border-zinc-300 rounded-lg text-zinc-600">Cancel</button>
                            <button onClick={handleScrap}
                                className="flex-1 py-3 text-xs font-bold uppercase bg-red-600 text-white rounded-lg">Confirm Scrap</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
