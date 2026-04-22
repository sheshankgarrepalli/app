import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Scan, ArrowRight, X, Trash2 } from 'lucide-react';

export default function BulkTransfer() {
    const { token } = useAuth();
    const [scannedImeis, setScannedImeis] = useState<string[]>([]);
    const [currentInput, setCurrentInput] = useState('');
    const [destination, setDestination] = useState('Transit_to_QC');
    const [notes, setNotes] = useState('');
    const [defects, setDefects] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [summary, setSummary] = useState<any>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const defectOptions = ["Battery", "Screen", "FaceID", "Camera", "Back Glass", "Housing"];

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleScan = (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentInput) return;
        if (!scannedImeis.includes(currentInput)) {
            setScannedImeis([currentInput, ...scannedImeis]);
        }
        setCurrentInput('');
        inputRef.current?.focus();
    };

    const removeImei = (imei: string) => {
        setScannedImeis(scannedImeis.filter(i => i !== imei));
    };

    const toggleDefect = (defect: string) => {
        setDefects(prev => prev.includes(defect) ? prev.filter(d => d !== defect) : [...prev, defect]);
    };

    const handleExecute = async () => {
        setIsProcessing(true);
        try {
            const res = await axios.post((import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/transfers/bulk-route', {
                imeis: scannedImeis,
                destination,
                notes,
                defects
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSummary(res.data);
            setScannedImeis([]);
            setNotes('');
            setDefects([]);
        } catch (err) {
            console.error(err);
            alert("Transfer failed");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50">
            <header className="p-6 bg-white border-b border-zinc-200 flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold text-zinc-900">Logistics Dispatch</h1>
                    <p className="text-xs text-zinc-500 mt-1">Chain of custody & inter-node routing</p>
                </div>
            </header>

            <div className="flex-1 grid grid-cols-12 overflow-hidden">
                {/* CONTROLS (1/3) */}
                <div className="col-span-4 bg-white border-r border-zinc-200 p-6 space-y-8 overflow-y-auto">
                    <form onSubmit={handleScan} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">Scanner Input (IMEI/Serial)</label>
                            <div className="relative group">
                                <Scan size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300 group-focus-within:text-zinc-900 transition-colors" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={currentInput}
                                    onChange={e => setCurrentInput(e.target.value)}
                                    placeholder="Scan asset..."
                                    className="input-stark w-full pl-10 py-4 font-mono text-sm tracking-widest placeholder:font-sans placeholder:text-xs placeholder:tracking-normal"
                                />
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 ml-1">Destination Node</label>
                                <select
                                    value={destination}
                                    onChange={e => setDestination(e.target.value)}
                                    className="input-stark w-full py-3 text-xs font-bold uppercase tracking-widest"
                                >
                                    <option value="Transit_to_QC">QC / TESTING</option>
                                    <option value="Transit_to_Repair">REPAIR LAB</option>
                                    <option value="Transit_to_Main_Bin">MAIN BIN / SALES FLOOR</option>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 ml-1">Identified Defects</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {defectOptions.map(d => (
                                        <button
                                            key={d}
                                            type="button"
                                            onClick={() => toggleDefect(d)}
                                            className={`p-3 text-[10px] font-bold uppercase tracking-widest border rounded-lg transition-all ${defects.includes(d) ? 'bg-zinc-900 border-zinc-900 text-white shadow-sm' : 'bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50'}`}
                                        >
                                            {d}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 ml-1">Dispatch Directives</label>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Additional context..."
                                    className="input-stark w-full py-3 h-24 resize-none text-sm tracking-tight"
                                />
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleExecute}
                            disabled={isProcessing || scannedImeis.length === 0}
                            className="btn-primary w-full py-4 text-xs font-semibold uppercase tracking-[0.2em] flex items-center justify-center gap-3"
                        >
                            {isProcessing ? 'Synchronizing...' : (
                                <>
                                    <ArrowRight size={20} /> Dispatch Batch
                                </>
                            )}
                        </button>
                    </form>

                    {summary && (
                        <div className={`p-6 border rounded-lg space-y-4 animate-in fade-in slide-in-from-bottom-4 shadow-sm ${summary.errors.length > 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
                            <div className="flex justify-between items-center">
                                <span className={`text-xs font-bold uppercase tracking-widest ${summary.errors.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>Dispatch Summary</span>
                                <button onClick={() => setSummary(null)} className="text-zinc-400 hover:text-zinc-900 transition-colors"><X size={16} /></button>
                            </div>
                            <div className={`text-3xl font-bold ${summary.errors.length > 0 ? 'text-rose-900' : 'text-emerald-900'}`}>{summary.success_count} <span className="text-xs uppercase tracking-widest font-bold opacity-60">Success</span></div>
                            {summary.errors.length > 0 && (
                                <div className="space-y-1">
                                    <div className="text-[10px] font-bold text-rose-600 uppercase tracking-widest">Exceptions Detected:</div>
                                    {summary.errors.map((err: string, i: number) => (
                                        <div key={i} className="text-[10px] font-semibold text-rose-600/70 border-l border-rose-200 pl-2">{err}</div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* SCANNED LIST (2/3) */}
                <div className="col-span-8 flex flex-col bg-zinc-50 overflow-hidden">
                    <div className="p-4 bg-white border-b border-zinc-200 flex justify-between items-center">
                        <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">Dispatch Batch ({scannedImeis.length})</label>
                        {scannedImeis.length > 0 && (
                            <button onClick={() => setScannedImeis([])} className="text-xs font-semibold uppercase tracking-widest text-rose-600 hover:text-rose-700 transition-colors">Clear Batch</button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        {scannedImeis.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-zinc-300 space-y-4">
                                <Scan size={64} className="opacity-10" />
                                <div className="text-xs font-semibold uppercase tracking-[0.4em] opacity-40">Waiting for Scans...</div>
                            </div>
                        ) : (
                            <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-zinc-50/50 border-b border-zinc-200">
                                        <tr className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">
                                            <th className="px-8 py-4 w-20">Seq</th>
                                            <th className="px-8 py-4">Asset Identifier</th>
                                            <th className="px-8 py-4 text-right w-24">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {scannedImeis.map((imei, index) => (
                                            <tr key={imei} className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors group animate-in fade-in slide-in-from-top-2">
                                                <td className="px-8 py-4 text-zinc-400 font-semibold">{scannedImeis.length - index}</td>
                                                <td className="px-8 py-4 font-mono text-zinc-900 font-bold tracking-widest uppercase text-xs">{imei}</td>
                                                <td className="px-8 py-4 text-right">
                                                    <button onClick={() => removeImei(imei)} className="text-zinc-300 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
