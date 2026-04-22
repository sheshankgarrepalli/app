import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Scan, AlertCircle, ArrowRight, ClipboardList } from 'lucide-react';

export default function QCTriage() {
    const { token } = useAuth();
    const [skuInput, setSkuInput] = useState('');
    const [device, setDevice] = useState<any>(null);
    const [symptoms, setSymptoms] = useState<string[]>([]);
    const [notes, setNotes] = useState('');
    const [errorStatus, setErrorStatus] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const scannerRef = useRef<HTMLInputElement>(null);

    const symptomOptions = ["Screen", "Battery", "Charging Port", "Camera", "Back Glass", "Speaker", "Water Damage"];

    useEffect(() => {
        scannerRef.current?.focus();
    }, []);

    const handleScannerKeyDown = async (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && skuInput.trim()) {
            fetchDevice(skuInput.trim());
            setSkuInput('');
        }
    };

    const fetchDevice = async (imei: string) => {
        setErrorStatus('');
        setDevice(null);
        try {
            const res = await axios.get(`http://localhost:8000/api/inventory/${imei}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDevice(res.data);
        } catch (err) {
            setErrorStatus("Device not found");
        }
    };

    const toggleSymptom = (s: string) => {
        setSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
    };

    const handleSendToRepair = async () => {
        if (!device) return;
        setIsProcessing(true);
        try {
            await axios.post((import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/repair/triage', {
                imei: device.imei,
                symptoms: symptoms.join(', '),
                notes: notes
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert("Device sent to Repair Kanban");
            setDevice(null);
            setSymptoms([]);
            setNotes('');
        } catch (err) {
            alert("Triage failed");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50">
            <header className="p-6 bg-white border-b border-zinc-200 flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold text-zinc-900">QC Triage Engine</h1>
                    <p className="text-xs text-zinc-500 mt-1">Intake assessment & symptom mapping</p>
                </div>
            </header>

            <div className="flex-1 grid grid-cols-12 overflow-hidden">
                {/* LEFT PANEL: SCANNER */}
                <div className="col-span-4 bg-white border-r border-zinc-200 p-6 space-y-8 overflow-y-auto">
                    <section className="space-y-4">
                        <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">Scanner Input</label>
                        <div className="relative group">
                            <input
                                ref={scannerRef}
                                value={skuInput}
                                onChange={e => setSkuInput(e.target.value)}
                                onKeyDown={handleScannerKeyDown}
                                placeholder="Scan asset to triage..."
                                className="input-stark w-full py-5 font-mono text-xl tracking-widest placeholder:font-sans placeholder:text-xs placeholder:tracking-normal"
                            />
                            <Scan size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-300 group-focus-within:text-zinc-900 transition-colors" />
                        </div>
                        {errorStatus && (
                            <div className="text-[10px] font-semibold text-rose-600 uppercase tracking-widest flex items-center gap-2 px-1">
                                <AlertCircle size={14} /> {errorStatus}
                            </div>
                        )}
                    </section>
                </div>

                {/* RIGHT PANEL: TRIAGE WORKSPACE */}
                <div className="col-span-8 flex flex-col bg-zinc-50 overflow-hidden">
                    {device ? (
                        <div className="flex-1 flex flex-col p-12 space-y-12 animate-in fade-in duration-500 overflow-y-auto">
                            <div className="bg-white border border-zinc-200 rounded-lg p-8 shadow-sm">
                                <div className="border-b border-zinc-100 pb-8">
                                    <div className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-2">Identified Asset</div>
                                    <h2 className="text-4xl font-bold text-zinc-900 tracking-tighter">
                                        {device.model.brand} {device.model.name}
                                    </h2>
                                    <div className="text-xs font-medium text-zinc-500 mt-2 uppercase tracking-widest">
                                        IMEI: {device.imei} | Status: <span className="text-zinc-900 font-bold">{device.device_status}</span>
                                    </div>
                                </div>

                                <div className="py-8 space-y-6">
                                    <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">Symptom Mapping</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {symptomOptions.map(s => (
                                            <button
                                                key={s}
                                                onClick={() => toggleSymptom(s)}
                                                className={`p-4 text-[10px] font-bold uppercase tracking-widest border rounded-lg transition-all ${symptoms.includes(s) ? 'bg-zinc-900 border-zinc-900 text-white shadow-sm' : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-400'}`}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">Internal Directives</label>
                                    <textarea
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        placeholder="Additional repair instructions..."
                                        rows={4}
                                        className="input-stark w-full py-4 text-sm tracking-tight resize-none"
                                    />
                                </div>

                                <div className="pt-8 border-t border-zinc-100">
                                    <button
                                        onClick={handleSendToRepair}
                                        disabled={isProcessing || symptoms.length === 0}
                                        className="btn-primary w-full h-16 text-xs font-semibold uppercase tracking-[0.2em] flex items-center justify-center gap-3"
                                    >
                                        {isProcessing ? 'Synchronizing...' : (
                                            <>
                                                <ArrowRight size={20} /> Route to Repair Kanban
                                            </>
                                        )}
                                    </button>
                                    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 text-center mt-4 flex items-center justify-center gap-2">
                                        <AlertCircle size={12} /> Asset will be queued for technical service in the technician terminal.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-zinc-300 space-y-4">
                            <ClipboardList size={64} className="opacity-10" />
                            <div className="text-xs font-semibold uppercase tracking-[0.4em] opacity-40">Waiting for Asset Scan...</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
