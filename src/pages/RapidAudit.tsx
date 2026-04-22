import { useState, useRef, useEffect, FormEvent } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
    Scan, RefreshCw, AlertCircle,
    Trash2, ChevronRight, Info
} from 'lucide-react';

export default function RapidAudit() {
    const { token, user } = useAuth();
    const [scannedImeis, setScannedImeis] = useState<string[]>([]);
    const [currentInput, setCurrentInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [report, setReport] = useState<any>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleScan = (e: FormEvent) => {
        e.preventDefault();
        if (!currentInput.trim()) return;
        if (!scannedImeis.includes(currentInput.trim())) {
            setScannedImeis([currentInput.trim(), ...scannedImeis]);
        }
        setCurrentInput('');
        inputRef.current?.focus();
    };

    const removeImei = (imei: string) => {
        setScannedImeis(scannedImeis.filter(i => i !== imei));
    };

    const runAudit = async () => {
        setIsProcessing(true);
        try {
            const res = await axios.post((import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/inventory/rapid-audit', {
                imeis: scannedImeis
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setReport(res.data);
        } catch (err: any) {
            alert(err.response?.data?.detail || "Audit failed");
        } finally {
            setIsProcessing(false);
        }
    };

    const resetAudit = () => {
        setScannedImeis([]);
        setReport(null);
        setCurrentInput('');
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    if (report) {
        return (
            <div className="flex flex-col h-full bg-zinc-50 animate-in fade-in duration-500">
                <header className="p-8 bg-white border-b border-zinc-200 flex justify-between items-end">
                    <div>
                        <h1 className="text-2xl font-black text-zinc-900 tracking-tighter uppercase">Audit Variance Report</h1>
                        <p className="text-[10px] font-bold text-zinc-400 tracking-[0.2em] uppercase mt-1">
                            Location: {user?.store_id || 'Warehouse Alpha'} • {new Date().toLocaleDateString()}
                        </p>
                    </div>
                    <button onClick={resetAudit} className="btn-secondary px-8 py-3 text-xs font-bold uppercase tracking-widest">
                        New Audit
                    </button>
                </header>

                <div className="flex-1 overflow-auto p-8 space-y-12">
                    {/* SUMMARY CARDS */}
                    <div className="grid grid-cols-3 gap-6">
                        <div className="bg-white border border-zinc-200 p-8 rounded-lg shadow-sm">
                            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-2">Matched Assets</div>
                            <div className="text-5xl font-bold text-zinc-900 tracking-tighter">{report.matched.length}</div>
                        </div>
                        <div className="bg-rose-50/50 border border-rose-100 p-8 rounded-lg shadow-sm">
                            <div className="text-[10px] font-black uppercase tracking-widest text-rose-600 mb-2">Missing Assets</div>
                            <div className="text-5xl font-bold text-rose-600 tracking-tighter">{report.missing.length}</div>
                        </div>
                        <div className="bg-amber-50/50 border border-amber-100 p-8 rounded-lg shadow-sm">
                            <div className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-2">Unexpected Assets</div>
                            <div className="text-5xl font-bold text-amber-600 tracking-tighter">{report.unexpected.length}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        {/* MISSING TABLE */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                                <AlertCircle size={14} className="text-rose-500" /> Missing from Physical Scan
                            </h3>
                            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-zinc-50 border-b border-zinc-200">
                                        <tr className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                            <th className="px-6 py-4">IMEI / Serial</th>
                                            <th className="px-6 py-4">Last Action</th>
                                            <th className="px-6 py-4 text-right">Custodian</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100">
                                        {report.missing.length === 0 ? (
                                            <tr><td colSpan={3} className="px-6 py-12 text-center text-[10px] font-bold text-zinc-300 uppercase tracking-widest">No missing assets</td></tr>
                                        ) : report.missing.map((m: any) => (
                                            <tr key={m.imei} className="bg-rose-50/20">
                                                <td className="px-6 py-4 font-mono text-xs font-bold text-zinc-900">{m.imei}</td>
                                                <td className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-tight">{m.last_action}</td>
                                                <td className="px-6 py-4 text-right text-[10px] font-bold text-zinc-400 uppercase">{m.last_employee.split('@')[0]}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* UNEXPECTED TABLE */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                                <Info size={14} className="text-amber-500" /> Unexpected at this Location
                            </h3>
                            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-zinc-50 border-b border-zinc-200">
                                        <tr className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                            <th className="px-6 py-4">IMEI / Serial</th>
                                            <th className="px-6 py-4 text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100">
                                        {report.unexpected.length === 0 ? (
                                            <tr><td colSpan={2} className="px-6 py-12 text-center text-[10px] font-bold text-zinc-300 uppercase tracking-widest">No unexpected assets</td></tr>
                                        ) : report.unexpected.map((imei: string) => (
                                            <tr key={imei} className="bg-amber-50/20">
                                                <td className="px-6 py-4 font-mono text-xs font-bold text-zinc-900">{imei}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="text-[9px] font-black bg-zinc-900 text-white px-2 py-1 uppercase tracking-widest rounded">Review Req</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-zinc-50">
            <header className="p-8 bg-white border-b border-zinc-200 flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-black text-zinc-900 tracking-tight uppercase">Rapid Inventory Audit</h1>
                    <p className="text-[10px] font-bold text-zinc-400 tracking-[0.2em] uppercase mt-1">Continuous scanner mode enabled</p>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Devices Scanned</div>
                        <div className="text-2xl font-bold text-zinc-900">{scannedImeis.length}</div>
                    </div>
                    <button
                        onClick={runAudit}
                        disabled={isProcessing || scannedImeis.length === 0}
                        className="btn-primary px-10 py-4 text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3 shadow-xl shadow-zinc-200"
                    >
                        {isProcessing ? <RefreshCw className="animate-spin" size={18} /> : <ChevronRight size={18} />}
                        Run Audit Variance Report
                    </button>
                </div>
            </header>

            <div className="flex-1 grid grid-cols-12 overflow-hidden">
                <div className="col-span-12 p-8 space-y-8 overflow-y-auto">
                    {/* SCANNER INPUT */}
                    <div className="max-w-3xl mx-auto w-full">
                        <form onSubmit={handleScan} className="relative group">
                            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-300 group-focus-within:text-zinc-900 transition-colors">
                                <Scan size={32} strokeWidth={1.5} />
                            </div>
                            <input
                                ref={inputRef}
                                type="text"
                                value={currentInput}
                                onChange={e => setCurrentInput(e.target.value)}
                                placeholder="Awaiting Scan..."
                                className="w-full bg-white border-2 border-zinc-100 focus:border-zinc-900 rounded-2xl pl-20 pr-8 py-8 text-3xl font-mono font-bold tracking-[0.2em] outline-none transition-all shadow-sm placeholder:font-sans placeholder:text-sm placeholder:tracking-widest"
                            />
                        </form>
                    </div>

                    {/* BATCH LIST */}
                    <div className="max-w-5xl mx-auto w-full space-y-4">
                        <div className="flex justify-between items-center px-2">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Current Scan Batch</h3>
                            {scannedImeis.length > 0 && (
                                <button onClick={() => setScannedImeis([])} className="text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-700 transition-colors">Clear All</button>
                            )}
                        </div>

                        <div className="grid grid-cols-4 gap-3">
                            {scannedImeis.length === 0 ? (
                                <div className="col-span-4 py-24 border-2 border-dashed border-zinc-200 rounded-2xl flex flex-col items-center justify-center text-zinc-300 space-y-4">
                                    <Scan size={48} strokeWidth={1} className="opacity-20" />
                                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40 text-center">No assets in current batch.<br />Please begin scanning.</p>
                                </div>
                            ) : scannedImeis.map((imei, index) => (
                                <div key={imei} className="bg-white border border-zinc-200 p-4 rounded-xl shadow-sm flex justify-between items-center group animate-in slide-in-from-top-2 duration-300">
                                    <div className="space-y-1">
                                        <div className="text-[8px] font-black text-zinc-300 uppercase tracking-widest">#{scannedImeis.length - index}</div>
                                        <div className="text-xs font-mono font-bold text-zinc-900 tracking-widest">{imei}</div>
                                    </div>
                                    <button onClick={() => removeImei(imei)} className="text-zinc-200 hover:text-rose-500 transition-colors">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
