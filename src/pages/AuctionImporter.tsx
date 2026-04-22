import { useState } from 'react';
import axios from 'axios';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { Upload, FileText, CheckCircle2, AlertCircle, ArrowRight, X } from 'lucide-react';

export default function AuctionImporter() {
    const { token } = useAuth();
    const [fileHeaders, setFileHeaders] = useState<string[]>([]);
    const [fileData, setFileData] = useState<any[]>([]);
    const [mappings, setMappings] = useState<{ [key: string]: string }>({});
    const [summary, setSummary] = useState<any>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const systemFields = [
        { id: 'imei', label: 'IMEI / Serial' },
        { id: 'model_number', label: 'Model Number / MPN' },
        { id: 'cost', label: 'Cost / Bid Price' },
        { id: 'grade', label: 'Grade / Condition' }
    ];

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            if (file.name.endsWith('.csv')) {
                Papa.parse(file, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results: any) => {
                        setFileHeaders(Object.keys(results.data[0] as any));
                        setFileData(results.data);
                    }
                });
            } else {
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);
                if (data.length > 0) {
                    setFileHeaders(Object.keys(data[0] as any));
                    setFileData(data);
                }
            }
        };
        if (file.name.endsWith('.csv')) {
            reader.readAsText(file);
        } else {
            reader.readAsBinaryString(file);
        }
    };

    const handleMappingChange = (systemField: string, fileHeader: string) => {
        setMappings(prev => ({ ...prev, [systemField]: fileHeader }));
    };

    const handleImport = async () => {
        setIsProcessing(true);
        setSummary(null);

        const devices = fileData.map(row => ({
            imei: String(row[mappings['imei']]),
            model_number: String(row[mappings['model_number']]),
            cost: parseFloat(row[mappings['cost']]),
            grade: String(row[mappings['grade']])
        }));

        try {
            const res = await axios.post((import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/import/auction-devices', { devices }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSummary(res.data);
            setFileData([]);
            setFileHeaders([]);
            setMappings({});
        } catch (err) {
            console.error(err);
            alert("Import failed");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50">
            <header className="p-6 bg-white border-b border-zinc-200 flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold text-zinc-900">Bulk Intake Engine</h1>
                    <p className="text-xs text-zinc-500 mt-1">Smart manifest intake & specification resolution</p>
                </div>
            </header>

            <div className="flex-1 grid grid-cols-12 overflow-hidden">
                {/* UPLOADER & MAPPING (1/3) */}
                <div className="col-span-5 bg-white border-r border-zinc-200 p-6 space-y-12 overflow-y-auto">
                    {!fileHeaders.length ? (
                        <div className="border-2 border-dashed border-zinc-200 p-20 flex flex-col items-center justify-center space-y-4 hover:border-zinc-400 transition-colors cursor-pointer relative rounded-lg bg-zinc-50/50">
                            <Upload size={48} className="text-zinc-300" />
                            <div className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">Drop Manifest (CSV/XLSX)</div>
                            <input
                                type="file"
                                accept=".csv,.xlsx"
                                onChange={handleFileUpload}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                        </div>
                    ) : (
                        <div className="space-y-8 animate-in fade-in slide-in-from-left-4">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">Column Mapping</label>
                                <button onClick={() => { setFileHeaders([]); setFileData([]); }} className="text-zinc-400 hover:text-zinc-900 transition-colors">
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="space-y-3">
                                {systemFields.map(field => (
                                    <div key={field.id} className="flex items-center justify-between p-4 border border-zinc-200 bg-white rounded-lg shadow-sm">
                                        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-700">{field.label}</span>
                                        <select
                                            value={mappings[field.id] || ''}
                                            onChange={e => handleMappingChange(field.id, e.target.value)}
                                            className="bg-transparent border-b border-zinc-200 text-xs font-bold uppercase tracking-widest text-zinc-900 outline-none focus:border-zinc-900 transition-colors p-1"
                                        >
                                            <option value="">Map Column...</option>
                                            {fileHeaders.map(h => (
                                                <option key={h} value={h}>{h}</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={handleImport}
                                disabled={isProcessing || Object.keys(mappings).length < 4}
                                className="btn-primary w-full py-5 text-xs font-semibold uppercase tracking-[0.2em] flex items-center justify-center gap-3"
                            >
                                {isProcessing ? 'Synchronizing...' : (
                                    <>
                                        <ArrowRight size={16} /> Execute Bulk Import
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>

                {/* SUMMARY & ERRORS (2/3) */}
                <div className="col-span-7 flex flex-col bg-zinc-50 overflow-hidden">
                    {summary ? (
                        <div className="flex-1 overflow-y-auto p-12 space-y-12 animate-in fade-in zoom-in-95">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="p-8 bg-white border border-zinc-200 rounded-lg shadow-sm">
                                    <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-2">Success</div>
                                    <div className="text-5xl font-bold text-zinc-900">{summary.success_count}</div>
                                    <div className="text-xs font-semibold uppercase tracking-widest text-emerald-600 mt-4 flex items-center gap-2">
                                        <CheckCircle2 size={14} /> Assets Synchronized
                                    </div>
                                </div>
                                <div className="p-8 bg-white border border-zinc-200 rounded-lg shadow-sm">
                                    <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-2">Failed</div>
                                    <div className="text-5xl font-bold text-zinc-900">{summary.failed_count}</div>
                                    <div className="text-xs font-semibold uppercase tracking-widest text-rose-600 mt-4 flex items-center gap-2">
                                        <AlertCircle size={14} /> Rows Skipped
                                    </div>
                                </div>
                            </div>

                            {summary.errors.length > 0 && (
                                <div className="space-y-4">
                                    <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">Import Telemetry / Exceptions</label>
                                    <div className="border border-zinc-200 bg-white p-6 rounded-lg shadow-sm max-h-[400px] overflow-y-auto space-y-3">
                                        {summary.errors.map((err: string, i: number) => (
                                            <div key={i} className="text-xs font-medium text-zinc-600 uppercase tracking-tight flex items-start gap-3 border-l border-zinc-100 pl-4 py-1">
                                                <span className="text-zinc-400 font-mono">[{i + 1}]</span> {err}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-zinc-300 space-y-4">
                            <FileText size={64} className="opacity-10" />
                            <div className="text-xs font-semibold uppercase tracking-[0.4em] opacity-40">Awaiting Manifest Initialization</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
