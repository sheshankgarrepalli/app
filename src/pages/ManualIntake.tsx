import { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import api from '../api/api';
import { useAuth } from '@clerk/react';
import { Plus, Trash2, Save, AlertCircle, CheckCircle2, Scan, Layers, LayoutList, Zap } from 'lucide-react';

interface ManualIntakeForm {
    devices: {
        imei: string;
        serial_number: string;
        model_number: string;
        condition: string;
        acquisition_cost: number;
    }[];
}

type IntakeMode = 'standard' | 'batch' | 'quick';

export default function ManualIntake() {
    const { getToken } = useAuth();
    const [mode, setMode] = useState<IntakeMode>('quick'); // Default to Quick Intake (Blind Scan)
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [models, setModels] = useState<any[]>([]);
    
    // Refs for continuous focus
    const batchScanRef = useRef<HTMLInputElement>(null);
    const quickScanRef = useRef<HTMLInputElement>(null);

    // Batch Mode Header State
    const [batchHeader, setBatchHeader] = useState({
        model_number: '',
        condition: 'A',
        acquisition_cost: 0
    });

    // Raw/Batch Scan Accumulator
    const [scanBuffer, setScanBuffer] = useState('');
    const [scannedItems, setScannedItems] = useState<any[]>([]);

    const { register, control, handleSubmit, reset } = useForm<ManualIntakeForm>({
        defaultValues: {
            devices: [{ imei: '', serial_number: '', model_number: '', condition: 'A', acquisition_cost: 0 }]
        }
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "devices"
    });

    useEffect(() => {
        const fetchModels = async () => {
            try {
                const token = await getToken();
                const res = await api.get('/api/models/', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setModels(res.data);
            } catch (err) {
                console.error("Fetch models error:", err);
            }
        };
        fetchModels();
    }, [getToken]);

    // Re-focus logic
    useEffect(() => {
        if (mode === 'batch') batchScanRef.current?.focus();
        if (mode === 'quick') quickScanRef.current?.focus();
    }, [mode, scannedItems]);

    const handleQuickScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = scanBuffer.trim();
            if (!val) return;

            // Check for duplicates in the current buffer
            if (scannedItems.some(i => i.imei === val)) {
                setError(`IMEI ${val} already in scan buffer`);
                setScanBuffer('');
                return;
            }

            const newItem = {
                imei: val,
                model_number: mode === 'batch' ? batchHeader.model_number : null,
                condition: mode === 'batch' ? batchHeader.condition : null,
                acquisition_cost: mode === 'batch' ? batchHeader.acquisition_cost : 0
            };

            setScannedItems([newItem, ...scannedItems]);
            setScanBuffer('');
            setError(null);
        }
    };

    const onSubmit = async () => {
        setIsSubmitting(true);
        setError(null);
        setSuccess(false);
        try {
            if (mode === 'quick') {
                // High-speed blind intake
                const token = await getToken();
                await api.post('/api/inventory/bulk-intake', {
                    imeis: scannedItems.map(i => i.imei)
                }, { headers: { Authorization: `Bearer ${token}` } });
            } else if (mode === 'batch') {
                // Batch metadata intake
                const token = await getToken();
                await api.post('/api/inventory/batch-manual', {
                    devices: scannedItems.map(i => ({
                        imei: i.imei,
                        model_number: i.model_number,
                        condition: i.condition,
                        acquisition_cost: i.acquisition_cost
                    }))
                }, { headers: { Authorization: `Bearer ${token}` } });
            } else {
                // Standard mode (from form)
                const token = await getToken();
                const data = handleSubmit((d) => d)();
                if (!data) return;
                await api.post('/api/inventory/batch-manual', data, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }

            setSuccess(true);
            setScannedItems([]);
            reset({
                devices: [{ imei: '', serial_number: '', model_number: '', condition: 'A', acquisition_cost: 0 }]
            });
        } catch (err: any) {
            setError(err.response?.data?.detail || "An error occurred during intake.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50">
            <header className="p-6 bg-white border-b border-zinc-200 flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold text-zinc-900 flex items-center gap-3">
                        Asset Intake 
                        {mode === 'quick' && <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest font-black">Quick Scan</span>}
                    </h1>
                    <p className="text-xs text-zinc-500 mt-1">High-speed IMEI registration & metadata binding</p>
                </div>
                <div className="flex gap-4 items-center">
                    {success && (
                        <div className="flex items-center gap-2 text-emerald-600 text-[10px] font-black uppercase tracking-widest animate-in fade-in slide-in-from-right-2">
                            <CheckCircle2 size={14} /> Batch Saved
                        </div>
                    )}
                    
                    <div className="flex bg-zinc-100 p-1 rounded-lg">
                        <button 
                            onClick={() => setMode('quick')}
                            className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${mode === 'quick' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-400'}`}
                        >
                            <Zap size={14} /> Quick Intake
                        </button>
                        <button 
                            onClick={() => setMode('batch')}
                            className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${mode === 'batch' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-400'}`}
                        >
                            <Layers size={14} /> Batch Model
                        </button>
                        <button 
                            onClick={() => setMode('standard')}
                            className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${mode === 'standard' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-400'}`}
                        >
                            <LayoutList size={14} /> Standard
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-auto p-6 space-y-6">
                
                {mode === 'quick' && (
                    <div className="bg-white p-8 border border-zinc-200 rounded-2xl shadow-sm flex flex-col items-center justify-center space-y-6 animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 animate-pulse">
                            <Scan size={40} />
                        </div>
                        <div className="text-center space-y-1">
                            <h2 className="text-xl font-bold text-zinc-900">IMEI Blind Scan</h2>
                            <p className="text-sm text-zinc-400">Specifications will be bound later via Auction/Invoice sheets</p>
                        </div>
                        <div className="w-full max-w-xl">
                            <input 
                                ref={quickScanRef}
                                value={scanBuffer}
                                onChange={e => setScanBuffer(e.target.value)}
                                onKeyDown={handleQuickScan}
                                placeholder="Scan IMEI and press Enter..."
                                className="input-stark w-full py-6 text-2xl text-center font-mono font-bold tracking-widest border-blue-200 bg-blue-50/20 focus:ring-4 focus:ring-blue-100 transition-all"
                            />
                        </div>
                        <div className="flex gap-8 text-center">
                            <div>
                                <div className="text-3xl font-black text-zinc-900">{scannedItems.length}</div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Items in Buffer</div>
                            </div>
                        </div>
                    </div>
                )}

                {mode === 'batch' && (
                    <div className="bg-white p-6 border border-zinc-200 rounded-lg shadow-sm grid grid-cols-4 gap-6 animate-in slide-in-from-top-2">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Batch Model</label>
                            <select 
                                className="input-stark w-full py-3"
                                value={batchHeader.model_number}
                                onChange={e => setBatchHeader({...batchHeader, model_number: e.target.value})}
                            >
                                <option value="">Select Model...</option>
                                {models.map(m => <option key={m.model_number} value={m.model_number}>{m.name} ({m.model_number})</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Condition</label>
                            <select 
                                className="input-stark w-full py-3"
                                value={batchHeader.condition}
                                onChange={e => setBatchHeader({...batchHeader, condition: e.target.value})}
                            >
                                <option value="A">Grade A</option>
                                <option value="B">Grade B</option>
                                <option value="C">Grade C</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Unit Cost</label>
                            <input 
                                type="number"
                                className="input-stark w-full py-3"
                                value={batchHeader.acquisition_cost}
                                onChange={e => setBatchHeader({...batchHeader, acquisition_cost: parseFloat(e.target.value)})}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-blue-600 font-bold">Scan to Hydrate</label>
                            <input 
                                ref={batchScanRef}
                                value={scanBuffer}
                                onChange={e => setScanBuffer(e.target.value)}
                                onKeyDown={handleQuickScan}
                                placeholder="Auto-Focus Active..."
                                className="input-stark w-full py-3 border-blue-200 bg-blue-50/30 font-mono font-bold"
                            />
                        </div>
                    </div>
                )}

                {/* Buffer/Data Table */}
                {(mode !== 'standard' || fields.length > 0) && (
                    <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden animate-in fade-in">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-zinc-50/50 border-b border-zinc-200">
                                <tr className="text-xs font-bold uppercase tracking-[0.1em] text-zinc-500">
                                    <th className="px-6 py-4 w-48">IMEI</th>
                                    <th className="px-6 py-4">Context</th>
                                    <th className="px-6 py-4 w-40">Status</th>
                                    <th className="px-6 py-4 w-16"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {mode !== 'standard' ? (
                                    scannedItems.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-zinc-50/50 transition-colors">
                                            <td className="px-6 py-4 font-mono font-bold tracking-widest text-xs">{item.imei}</td>
                                            <td className="px-6 py-4">
                                                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                                                    {item.model_number ? `Batch: ${item.model_number} | ${item.condition}` : 'Raw IMEI registration'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`badge-glow ${item.model_number ? 'badge-success' : 'badge-neutral'}`}>
                                                    {item.model_number ? 'Hydrated' : 'Raw'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => setScannedItems(scannedItems.filter((_, i) => i !== idx))} className="text-zinc-300 hover:text-rose-600"><Trash2 size={16} /></button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    fields.map((field, index) => (
                                        <tr key={field.id} className="hover:bg-zinc-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <input
                                                    {...register(`devices.${index}.imei` as const, { required: true })}
                                                    placeholder="IMEI..."
                                                    className="input-stark w-full py-2 text-xs font-mono font-bold tracking-widest"
                                                />
                                            </td>
                                            <td className="px-6 py-4 flex gap-2">
                                                <select
                                                    {...register(`devices.${index}.model_number` as const)}
                                                    className="input-stark w-full py-2 text-[10px] font-bold uppercase tracking-widest"
                                                >
                                                    <option value="">Model...</option>
                                                    {models.map(m => <option key={m.model_number} value={m.model_number}>{m.name}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="badge-glow badge-neutral">Standard</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button type="button" onClick={() => remove(index)} className="text-zinc-300 hover:text-rose-600"><Trash2 size={16} /></button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        {mode === 'standard' && (
                            <button 
                                type="button" 
                                onClick={() => append({ imei: '', serial_number: '', model_number: '', condition: 'A', acquisition_cost: 0 })}
                                className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:bg-zinc-50 transition-colors flex items-center justify-center gap-2 border-t border-dashed border-zinc-200"
                            >
                                <Plus size={14} /> Insert Blank Row
                            </button>
                        )}
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-rose-50 border border-rose-100 rounded-lg flex items-center gap-3 text-rose-600 text-[10px] font-black uppercase tracking-widest animate-in shake">
                        <AlertCircle size={18} /> {error}
                    </div>
                )}

                <div className="flex justify-end gap-6">
                    {(mode !== 'standard' && scannedItems.length > 0) && (
                        <button 
                            onClick={() => setScannedItems([])}
                            className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-rose-600 transition-colors"
                        >
                            Discard Buffer
                        </button>
                    )}
                    <button
                        onClick={() => onSubmit()}
                        disabled={isSubmitting || (mode !== 'standard' && scannedItems.length === 0)}
                        className="btn-primary w-80 h-16 text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 rounded-2xl shadow-xl shadow-blue-500/20"
                    >
                        {isSubmitting ? 'Synchronizing...' : (
                            <>
                                <Save size={18} /> Register {scannedItems.length || fields.length} Assets
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
