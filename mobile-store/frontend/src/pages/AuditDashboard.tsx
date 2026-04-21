import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Check, X, AlertOctagon, RefreshCw, Zap, Save } from 'lucide-react';

export default function AuditDashboard() {
    const { token } = useAuth();
    const [location, setLocation] = useState('Warehouse_Alpha');
    const [scannedList, setScannedList] = useState<string[]>([]);
    const [currentScan, setCurrentScan] = useState('');

    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const interval = setInterval(() => {
            if (!report && inputRef.current && document.activeElement !== inputRef.current) {
                inputRef.current.focus();
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [report]);

    const handleScan = (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentScan.trim()) return;
        setScannedList(prev => [currentScan.trim(), ...prev]);
        setCurrentScan('');
    };

    const handleReconcile = async () => {
        if (scannedList.length === 0) {
            if (!confirm("You have scanned 0 devices. Do you want to run an audit anyway? All expected devices will be marked missing.")) return;
        }

        setLoading(true);
        try {
            const res = await axios.post(`http://localhost:8000/api/inventory/audit/reconcile`, {
                location_id: location,
                scanned_imeis_list: scannedList
            }, { headers: { Authorization: `Bearer ${token}` } });

            setReport(res.data);
        } catch (err: any) {
            alert(err.response?.data?.detail || "Error generating audit report");
        } finally {
            setLoading(false);
        }
    };

    const handleFinalize = async () => {
        if (!report) return;
        if (!confirm("Are you sure you want to finalize this audit? This action cannot be reversed.")) return;

        try {
            const res = await axios.post(`http://localhost:8000/api/inventory/audit/finalize`, {
                location_id: location,
                report: report
            }, { headers: { Authorization: `Bearer ${token}` } });

            alert(`Audit Finalized successfully! Audit ID: ${res.data.audit_id}`);
            setReport(null);
            setScannedList([]);
        } catch (err: any) {
            alert(err.response?.data?.detail || "Error finalizing audit");
        }
    };

    const cancelAudit = () => {
        if (confirm("Discard current scan batch?")) {
            setReport(null);
            setScannedList([]);
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50">
            <header className="p-6 bg-white border-b border-zinc-200 flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold text-zinc-900">Stock Audit Engine</h1>
                    <p className="text-xs text-zinc-500 mt-1">Physical reconciliation & variance detection</p>
                </div>

                <div className="flex items-center gap-4">
                    <select
                        disabled={!!report || scannedList.length > 0}
                        value={location}
                        onChange={e => setLocation(e.target.value)}
                        className="input-stark py-2 text-xs uppercase tracking-widest"
                    >
                        <option value="Warehouse_Alpha">Warehouse Alpha</option>
                        <option value="store_a">Store A</option>
                        <option value="store_b">Store B</option>
                        <option value="store_c">Store C</option>
                    </select>
                </div>
            </header>

            {!report ? (
                <div className="flex-1 grid grid-cols-12 overflow-hidden">
                    {/* LEFT: SCANNER ENGINE */}
                    <div className="col-span-8 bg-white border-r border-zinc-200 p-6 space-y-8 overflow-y-auto">
                        <form onSubmit={handleScan} className="space-y-4">
                            <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 ml-1">Scanner Input (Auto Submit)</label>
                            <div className="relative group">
                                <input
                                    ref={inputRef}
                                    autoFocus
                                    value={currentScan}
                                    onChange={e => setCurrentScan(e.target.value)}
                                    placeholder="Scan asset to batch..."
                                    className="input-stark w-full py-5 font-mono text-xl tracking-widest placeholder:font-sans placeholder:text-xs placeholder:tracking-normal"
                                />
                                <Zap size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-300 group-focus-within:text-zinc-900 transition-colors" />
                            </div>
                        </form>

                        <div className="border border-zinc-200 bg-white rounded-lg shadow-sm overflow-hidden flex flex-col min-h-[400px]">
                            <div className="p-4 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center">
                                <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">Scan Batch ({scannedList.length})</h3>
                                <button onClick={() => setScannedList([])} className="text-xs font-semibold uppercase tracking-widest text-zinc-400 hover:text-rose-600 transition-colors">Clear Batch</button>
                            </div>
                            <div className="flex-1 p-6 grid grid-cols-4 gap-2 overflow-y-auto">
                                {scannedList.length === 0 ? (
                                    <div className="col-span-full flex flex-col items-center justify-center text-zinc-300 space-y-4">
                                        <Zap size={48} className="opacity-10" />
                                        <div className="text-xs font-semibold uppercase tracking-[0.4em] opacity-40">Waiting for Scans...</div>
                                    </div>
                                ) : (
                                    scannedList.map((imei, idx) => (
                                        <div key={idx} className="text-[10px] font-bold font-mono p-3 border border-zinc-200 text-zinc-900 bg-zinc-50 uppercase text-center rounded">
                                            {imei}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: ACTIONS */}
                    <div className="col-span-4 p-8 space-y-12 bg-zinc-50">
                        <section className="space-y-6">
                            <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">Audit Protocol</label>
                            <p className="text-sm text-zinc-500 leading-relaxed">
                                Finalize physical scan for <b className="text-zinc-900">{location.replace('_', ' ')}</b> to generate variance telemetry.
                            </p>

                            <div className="p-10 bg-white border border-zinc-200 rounded-lg shadow-sm flex flex-col items-center justify-center gap-2">
                                <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Batch Count</span>
                                <span className="text-6xl font-bold text-zinc-900 tracking-tighter">{scannedList.length}</span>
                            </div>

                            <button
                                onClick={handleReconcile}
                                disabled={loading}
                                className="btn-primary w-full h-16 text-xs font-semibold uppercase tracking-[0.2em] flex items-center justify-center gap-3"
                            >
                                {loading ? <RefreshCw className="animate-spin" size={20} /> : <RefreshCw size={20} />} Run Reconciliation
                            </button>
                        </section>
                    </div>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto p-12 space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="flex justify-between items-end border-b border-zinc-200 pb-8">
                        <div>
                            <h2 className="text-4xl font-bold text-zinc-900 tracking-tighter mb-1">Variance Report</h2>
                            <div className="text-xs font-semibold text-zinc-500 tracking-widest uppercase flex items-center gap-2">
                                Location: {location.replace('_', ' ')} • Expected vs Physical Reconciliation
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={cancelAudit} className="btn-secondary px-8 py-4">Discard</button>
                            <button onClick={handleFinalize} className="btn-primary px-8 py-4 text-xs font-semibold uppercase tracking-[0.2em] flex items-center gap-3"><Save size={16} /> Finalize Audit</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-8">
                        <div className="p-8 bg-white border border-zinc-200 rounded-lg shadow-sm space-y-4">
                            <div className="text-xs font-semibold uppercase tracking-widest text-emerald-600 flex justify-between items-center">Matched <Check size={16} /></div>
                            <div className="text-6xl font-bold text-zinc-900 tracking-tighter">{report.matched.length}</div>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Physically verified assets.</p>
                        </div>

                        <div className="p-8 bg-white border border-zinc-200 rounded-lg shadow-sm space-y-4">
                            <div className="text-xs font-semibold uppercase tracking-widest text-rose-600 flex justify-between items-center">Missing <X size={16} /></div>
                            <div className="text-6xl font-bold text-zinc-900 tracking-tighter">{report.missing.length}</div>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Assets not found in physical scan.</p>
                        </div>

                        <div className="p-8 bg-white border border-zinc-200 rounded-lg shadow-sm space-y-4">
                            <div className="text-xs font-semibold uppercase tracking-widest text-amber-600 flex justify-between items-center">Unexpected <AlertOctagon size={16} /></div>
                            <div className="text-6xl font-bold text-zinc-900 tracking-tighter">{report.unexpected.length}</div>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Status or location mismatch detected.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-16">
                        <div className="space-y-8">
                            <label className="text-xs font-semibold uppercase tracking-[0.1em] text-rose-600 block border-b border-rose-100 pb-4">Missing Investigations</label>
                            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-4">
                                {report.missing.length === 0 ? (
                                    <div className="text-xs font-semibold uppercase tracking-widest text-zinc-300 py-10">No missing assets identified</div>
                                ) : (
                                    report.missing.map((md: any) => (
                                        <div key={md.imei} className="border border-zinc-200 bg-white p-6 rounded-lg shadow-sm hover:border-zinc-400 transition-colors">
                                            <div className="font-mono font-bold text-zinc-900 text-sm mb-4 tracking-widest uppercase">{md.imei}</div>
                                            <div className="flex justify-between items-end">
                                                <div className="space-y-1">
                                                    <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Last Custodian</div>
                                                    <div className="text-xs font-bold text-zinc-700 uppercase tracking-tight">{md.last_employee}</div>
                                                </div>
                                                <div className="text-right space-y-1">
                                                    <div className="text-[10px] font-semibold text-zinc-400">{new Date(md.last_timestamp).toLocaleDateString()}</div>
                                                    <div className="badge-glow badge-warning text-[10px]">{md.last_action}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="space-y-8">
                            <label className="text-xs font-semibold uppercase tracking-[0.1em] text-amber-600 block border-b border-amber-100 pb-4">Unexpected Overrides</label>
                            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-4">
                                {report.unexpected.length === 0 ? (
                                    <div className="text-xs font-semibold uppercase tracking-widest text-zinc-300 py-10">No unexpected assets found</div>
                                ) : (
                                    report.unexpected.map((imei: string) => (
                                        <div key={imei} className="border border-zinc-200 bg-white p-6 flex justify-between items-center rounded-lg shadow-sm hover:border-zinc-400 transition-colors">
                                            <div className="font-mono font-bold text-zinc-900 tracking-widest uppercase">{imei}</div>
                                            <div className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 bg-zinc-900 text-white rounded">Manual Review Required</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
