import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Scan, X, Trash2, PackageCheck } from 'lucide-react';

export default function ReceiveInventory() {
    const { token } = useAuth();
    const [scannedImeis, setScannedImeis] = useState<string[]>([]);
    const [currentInput, setCurrentInput] = useState('');
    const [notes, setNotes] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [summary, setSummary] = useState<any>(null);
    const inputRef = useRef<HTMLInputElement>(null);

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

    const handleExecute = async () => {
        setIsProcessing(true);
        try {
            const res = await axios.post((import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/transfers/bulk-receive', {
                imeis: scannedImeis,
                notes
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSummary(res.data);
            setScannedImeis([]);
            setNotes('');
        } catch (err) {
            console.error(err);
            alert("Receipt failed");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50 dark:bg-[#0a0a0b]">
            <header className="p-6 bg-white dark:bg-[#141416] border-b border-zinc-200 dark:border-[#1f1f21] flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold text-zinc-900 dark:text-[#e4e4e7]">Asset Intake</h1>
                    <p className="text-xs text-zinc-500 dark:text-[#71717a] mt-1">Chain of custody & inventory synchronization</p>
                </div>
            </header>

            <div className="flex-1 grid grid-cols-12 overflow-hidden">
                {/* CONTROLS (1/3) */}
                <div className="col-span-4 bg-white dark:bg-[#141416] border-r border-zinc-200 dark:border-[#1f1f21] p-6 space-y-8 overflow-y-auto">
                    <form onSubmit={handleScan} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 dark:text-[#71717a]">Scanner Input (IMEI/Serial)</label>
                            <div className="relative group">
                                <Scan size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300 dark:text-[#52525b] group-focus-within:text-zinc-900 dark:text-[#e4e4e7] transition-colors" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={currentInput}
                                    onChange={e => setCurrentInput(e.target.value)}
                                    placeholder="Scan device..."
                                    className="input-stark w-full pl-10 py-4 font-mono text-sm tracking-widest placeholder:font-sans placeholder:text-xs placeholder:tracking-normal"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 dark:text-[#71717a]">Intake Notes</label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Additional context..."
                                className="input-stark w-full py-3 h-24 resize-none text-sm tracking-tight"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleExecute}
                            disabled={isProcessing || scannedImeis.length === 0}
                            className="btn-primary w-full py-4 text-xs font-semibold uppercase tracking-[0.2em] flex items-center justify-center gap-3"
                        >
                            {isProcessing ? 'Synchronizing...' : (
                                <>
                                    <PackageCheck size={20} /> Acknowledge Receipt
                                </>
                            )}
                        </button>
                    </form>

                    {summary && (
                        <div className="p-6 bg-zinc-50 dark:bg-[#0a0a0b] border border-zinc-200 dark:border-[#1f1f21] rounded-lg space-y-4 animate-in fade-in slide-in-from-bottom-4 shadow-sm">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-[#a1a1aa]">Receipt Summary</span>
                                <button onClick={() => setSummary(null)} className="text-zinc-400 dark:text-[#a1a1aa] hover:text-zinc-900 dark:text-[#e4e4e7] transition-colors"><X size={16} /></button>
                            </div>
                            <div className="text-3xl font-bold text-zinc-900 dark:text-[#e4e4e7]">{summary.success_count} <span className="text-xs text-zinc-400 dark:text-[#a1a1aa] uppercase tracking-widest">Success</span></div>
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
                <div className="col-span-8 flex flex-col bg-zinc-50 dark:bg-[#0a0a0b] overflow-hidden">
                    <div className="p-4 border-b border-zinc-200 dark:border-[#1f1f21] bg-white dark:bg-[#141416] flex justify-between items-center">
                        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-[#71717a]">Intake Batch ({scannedImeis.length})</label>
                        {scannedImeis.length > 0 && (
                            <button onClick={() => setScannedImeis([])} className="text-xs font-semibold uppercase tracking-widest text-rose-600 hover:text-rose-700 transition-colors">Clear Batch</button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        {scannedImeis.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-zinc-300 dark:text-[#52525b] space-y-4">
                                <Scan size={64} className="opacity-10" />
                                <div className="text-xs font-semibold uppercase tracking-[0.4em] opacity-40">Waiting for Scans...</div>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#1f1f21] rounded-lg shadow-sm overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-zinc-50 dark:bg-[#0a0a0b]/50 border-b border-zinc-200 dark:border-[#1f1f21]">
                                        <tr className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 dark:text-[#71717a]">
                                            <th className="px-8 py-4 w-20">Seq</th>
                                            <th className="px-8 py-4">Asset Identifier</th>
                                            <th className="px-8 py-4 text-right w-24">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {scannedImeis.map((imei, index) => (
                                            <tr key={imei} className="border-b border-zinc-100 dark:border-[#1a1a1c] hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] dark:bg-[#0a0a0b]/50 transition-colors group animate-in fade-in slide-in-from-top-2">
                                                <td className="px-8 py-4 text-zinc-400 dark:text-[#a1a1aa] font-semibold">{scannedImeis.length - index}</td>
                                                <td className="px-8 py-4 font-mono text-zinc-900 dark:text-[#e4e4e7] font-bold tracking-widest uppercase text-xs">{imei}</td>
                                                <td className="px-8 py-4 text-right">
                                                    <button onClick={() => removeImei(imei)} className="text-zinc-300 dark:text-[#52525b] hover:text-rose-600 transition-colors">
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
