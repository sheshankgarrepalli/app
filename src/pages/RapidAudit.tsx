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
            <div className="space-y-6">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Audit Variance Report</h1>
                        <p className="text-xs text-[#6b7280] dark:text-[#71717a] mt-1">
                            Location: {user?.store_id || 'Warehouse Alpha'} • {new Date().toLocaleDateString()}
                        </p>
                    </div>
                    <button onClick={resetAudit} className="btn-secondary">
                        New Audit
                    </button>
                </div>

                <div className="space-y-8">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="kpi-card">
                            <div className="kpi-label text-emerald-600">Matched Assets</div>
                            <div className="kpi-value">{report.matched.length}</div>
                        </div>
                        <div className="kpi-card border border-red-100">
                            <div className="kpi-label text-red-500">Missing Assets</div>
                            <div className="kpi-value text-red-500">{report.missing.length}</div>
                        </div>
                        <div className="kpi-card border border-amber-100">
                            <div className="kpi-label text-amber-600">Unexpected Assets</div>
                            <div className="kpi-value text-amber-600">{report.unexpected.length}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[#6b7280] dark:text-[#71717a] flex items-center gap-2">
                                <AlertCircle size={14} className="text-red-500" /> Missing from Physical Scan
                            </h3>
                            <div className="card overflow-hidden">
                                <table className="table-standard">
                                    <thead>
                                        <tr>
                                            <th>IMEI / Serial</th>
                                            <th>Last Action</th>
                                            <th className="text-right">Custodian</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {report.missing.length === 0 ? (
                                            <tr><td colSpan={3} className="py-12 text-center text-[#9ca3af] dark:text-[#52525b]">No missing assets</td></tr>
                                        ) : report.missing.map((m: any) => (
                                            <tr key={m.imei}>
                                                <td className="font-mono text-xs font-bold">{m.imei}</td>
                                                <td className="text-xs text-[#6b7280] dark:text-[#71717a]">{m.last_action}</td>
                                                <td className="text-right text-xs text-[#6b7280] dark:text-[#71717a]">{m.last_employee.split('@')[0]}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[#6b7280] dark:text-[#71717a] flex items-center gap-2">
                                <Info size={14} className="text-amber-500" /> Unexpected at this Location
                            </h3>
                            <div className="card overflow-hidden">
                                <table className="table-standard">
                                    <thead>
                                        <tr>
                                            <th>IMEI / Serial</th>
                                            <th className="text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {report.unexpected.length === 0 ? (
                                            <tr><td colSpan={2} className="py-12 text-center text-[#9ca3af] dark:text-[#52525b]">No unexpected assets</td></tr>
                                        ) : report.unexpected.map((imei: string) => (
                                            <tr key={imei}>
                                                <td className="font-mono text-xs font-bold">{imei}</td>
                                                <td className="text-right">
                                                    <span className="badge badge-neutral">Review Req</span>
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
        <div className="space-y-6">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Rapid Inventory Audit</h1>
                    <p className="text-xs text-[#6b7280] dark:text-[#71717a] mt-1">Continuous scanner mode enabled</p>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <div className="text-xs text-[#6b7280] dark:text-[#71717a] uppercase tracking-wider">Devices Scanned</div>
                        <div className="text-2xl font-bold text-[#1f2937] dark:text-[#e4e4e7]">{scannedImeis.length}</div>
                    </div>
                    <button
                        onClick={runAudit}
                        disabled={isProcessing || scannedImeis.length === 0}
                        className="btn-primary"
                    >
                        {isProcessing ? <RefreshCw className="animate-spin" size={18} /> : <ChevronRight size={18} />}
                        Run Audit Variance Report
                    </button>
                </div>
            </div>

            <div className="space-y-8">
                <div className="max-w-3xl mx-auto w-full">
                    <form onSubmit={handleScan} className="relative">
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 text-[#9ca3af] dark:text-[#52525b]">
                            <Scan size={32} />
                        </div>
                        <input
                            ref={inputRef}
                            type="text"
                            value={currentInput}
                            onChange={e => setCurrentInput(e.target.value)}
                            placeholder="Awaiting Scan..."
                            className="w-full bg-white dark:bg-[#141416] border-2 border-[#e5e7eb] dark:border-[#1f1f21] focus:border-accent rounded-xl pl-20 pr-8 py-8 text-3xl font-mono font-bold tracking-widest outline-none transition-all shadow-sm placeholder:font-sans placeholder:text-sm placeholder:tracking-normal"
                        />
                    </form>
                </div>

                <div className="max-w-5xl mx-auto w-full space-y-4">
                    <div className="flex justify-between items-center px-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#6b7280] dark:text-[#71717a]">Current Scan Batch</h3>
                        {scannedImeis.length > 0 && (
                            <button onClick={() => setScannedImeis([])} className="text-xs font-bold uppercase tracking-wider text-red-500 hover:text-red-700 transition-colors">Clear All</button>
                        )}
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                        {scannedImeis.length === 0 ? (
                            <div className="col-span-4 py-24 border-2 border-dashed border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl flex flex-col items-center justify-center text-[#d1d5db] space-y-4">
                                <Scan size={48} className="opacity-20" />
                                <p className="text-xs font-bold uppercase tracking-wider text-center">No assets in current batch.<br />Please begin scanning.</p>
                            </div>
                        ) : scannedImeis.map((imei, index) => (
                            <div key={imei} className="card p-4 flex justify-between items-center group">
                                <div className="space-y-1">
                                    <div className="text-xs text-[#9ca3af] dark:text-[#52525b] uppercase tracking-wider">#{scannedImeis.length - index}</div>
                                    <div className="text-xs font-mono font-bold text-[#1f2937] dark:text-[#e4e4e7]">{imei}</div>
                                </div>
                                <button onClick={() => removeImei(imei)} className="text-[#d1d5db] hover:text-red-500 transition-colors">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
