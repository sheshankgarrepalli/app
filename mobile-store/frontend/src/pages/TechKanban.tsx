import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Scan, CheckCircle2, Wrench, Clock, AlertCircle } from 'lucide-react';

export default function TechKanban() {
    const { token } = useAuth();
    const [tickets, setTickets] = useState<any[]>([]);
    const [activeTicket, setActiveTicket] = useState<any>(null);
    const [workCompleted, setWorkCompleted] = useState<string[]>([]);
    const [skuInput, setSkuInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const scannerRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchTickets();
        scannerRef.current?.focus();
    }, []);

    const fetchTickets = async () => {
        try {
            const res = await axios.get('http://localhost:8000/api/repair/tickets', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTickets(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleScannerKeyDown = async (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && skuInput.trim()) {
            const ticket = tickets.find(t => t.imei === skuInput.trim());
            if (ticket) {
                setActiveTicket(ticket);
                setWorkCompleted(ticket.symptoms ? ticket.symptoms.split(', ') : []);
            } else {
                alert("No active repair ticket found for this IMEI");
            }
            setSkuInput('');
        }
    };

    const toggleWork = (s: string) => {
        setWorkCompleted(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
    };

    const handleComplete = async () => {
        if (!activeTicket) return;
        setIsProcessing(true);
        try {
            await axios.post('http://localhost:8000/api/repair/complete', {
                imei: activeTicket.imei,
                work_completed: workCompleted
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setActiveTicket(null);
            setWorkCompleted([]);
            fetchTickets();
        } catch (err) {
            alert("Completion failed");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50">
            <header className="p-6 bg-white border-b border-zinc-200 flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold text-zinc-900">Service Kanban</h1>
                    <p className="text-xs text-zinc-500 mt-1">Technical pipeline & inventory reconciliation</p>
                </div>

                <div className="relative group">
                    <input
                        ref={scannerRef}
                        value={skuInput}
                        onChange={e => setSkuInput(e.target.value)}
                        onKeyDown={handleScannerKeyDown}
                        placeholder="Scan asset..."
                        className="input-stark pl-9 w-64"
                    />
                    <Scan size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300 group-focus-within:text-zinc-900 transition-colors" />
                </div>
            </header>

            <div className="flex-1 grid grid-cols-12 overflow-hidden">
                {/* QUEUE COLUMN */}
                <div className="col-span-4 border-r border-zinc-200 flex flex-col bg-zinc-50">
                    <div className="p-4 bg-white border-b border-zinc-200">
                        <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">Active Queue ({tickets.length})</label>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {tickets.length === 0 ? (
                            <div className="py-20 text-center text-xs font-semibold uppercase tracking-widest text-zinc-300">Queue Empty</div>
                        ) : tickets.map(t => (
                            <button
                                key={t.id}
                                onClick={() => { setActiveTicket(t); setWorkCompleted(t.symptoms ? t.symptoms.split(', ') : []); }}
                                className={`w-full text-left p-4 rounded-lg border transition-all ${activeTicket?.id === t.id ? 'border-zinc-900 bg-white shadow-sm ring-1 ring-zinc-900' : 'border-zinc-200 bg-white hover:border-zinc-400'}`}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="text-xs font-mono font-bold text-zinc-900 uppercase tracking-widest">{t.imei}</div>
                                    <div className="flex items-center gap-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
                                        <Clock size={12} /> {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                                <div className="text-xs font-medium text-zinc-500 uppercase tracking-tight line-clamp-1">{t.symptoms}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* WORKSPACE COLUMN */}
                <div className="col-span-8 flex flex-col bg-zinc-50 overflow-hidden">
                    {activeTicket ? (
                        <div className="flex-1 flex flex-col p-12 space-y-12 animate-in fade-in duration-500 overflow-y-auto">
                            <div className="bg-white border border-zinc-200 rounded-lg p-8 shadow-sm">
                                <div className="flex justify-between items-start border-b border-zinc-100 pb-8">
                                    <div>
                                        <div className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-2">Active Service Ticket</div>
                                        <h2 className="text-4xl font-bold text-zinc-900 tracking-tighter">{activeTicket.imei}</h2>
                                        <div className="text-xs font-medium text-zinc-500 mt-2 uppercase tracking-widest">QC Notes: {activeTicket.notes || "No additional notes"}</div>
                                    </div>
                                    <div className="p-4 bg-zinc-50 rounded-full border border-zinc-100">
                                        <Wrench size={32} className="text-zinc-400" />
                                    </div>
                                </div>

                                <div className="py-8 space-y-6">
                                    <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">Service Protocol Checklist</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {activeTicket.symptoms?.split(', ').map((s: string) => (
                                            <button
                                                key={s}
                                                onClick={() => toggleWork(s)}
                                                className={`p-6 text-left border rounded-lg transition-all flex items-center justify-between group ${workCompleted.includes(s) ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-400'}`}
                                            >
                                                <span className="text-xs font-bold uppercase tracking-widest">{s}</span>
                                                {workCompleted.includes(s) && <CheckCircle2 size={16} className="text-emerald-600" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-8 border-t border-zinc-100">
                                    <button
                                        onClick={handleComplete}
                                        disabled={isProcessing || workCompleted.length === 0}
                                        className="btn-primary w-full h-16 text-xs font-semibold uppercase tracking-[0.2em] flex items-center justify-center gap-3"
                                    >
                                        {isProcessing ? 'Synchronizing...' : (
                                            <>
                                                <CheckCircle2 size={20} /> Finalize Service & Log Costs
                                            </>
                                        )}
                                    </button>
                                    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 text-center mt-4 flex items-center justify-center gap-2">
                                        <AlertCircle size={12} /> Automated stock deduction and cost ledger entry will be triggered.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-zinc-300 space-y-4">
                            <Wrench size={64} className="opacity-10" />
                            <div className="text-xs font-semibold uppercase tracking-[0.4em] opacity-40">Select Ticket to Initialize Workspace</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
