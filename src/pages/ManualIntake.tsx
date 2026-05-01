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
        <div className="space-y-4">
            <div className="page-header">
                <div>
                    <h1 className="page-title flex items-center gap-3">
                        Asset Intake
                        {mode === 'quick' && <span className="bg-accent text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Quick Scan</span>}
                    </h1>
                    <p className="text-xs text-[#6b7280] dark:text-[#71717a] mt-1">High-speed IMEI registration & metadata binding</p>
                </div>
                <div className="flex gap-4 items-center">
                    {success && (
                        <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold">
                            <CheckCircle2 size={14} /> Batch Saved
                        </div>
                    )}

                    <div className="flex bg-[#f5f5f5] dark:bg-[#0a0a0b] p-1 rounded-lg">
                        <button
                            onClick={() => setMode('quick')}
                            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${mode === 'quick' ? 'bg-white dark:bg-[#141416] shadow-sm text-[#1f2937] dark:text-[#e4e4e7]' : 'text-[#6b7280] dark:text-[#71717a]'}`}
                        >
                            <Zap size={14} /> Quick Intake
                        </button>
                        <button
                            onClick={() => setMode('batch')}
                            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${mode === 'batch' ? 'bg-white dark:bg-[#141416] shadow-sm text-[#1f2937] dark:text-[#e4e4e7]' : 'text-[#6b7280] dark:text-[#71717a]'}`}
                        >
                            <Layers size={14} /> Batch Model
                        </button>
                        <button
                            onClick={() => setMode('standard')}
                            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${mode === 'standard' ? 'bg-white dark:bg-[#141416] shadow-sm text-[#1f2937] dark:text-[#e4e4e7]' : 'text-[#6b7280] dark:text-[#71717a]'}`}
                        >
                            <LayoutList size={14} /> Standard
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto space-y-6">

                {mode === 'quick' && (
                    <div className="card p-8 flex flex-col items-center justify-center space-y-6">
                        <div className="w-20 h-20 bg-accent-light rounded-full flex items-center justify-center text-accent animate-pulse">
                            <Scan size={40} />
                        </div>
                        <div className="text-center space-y-1">
                            <h2 className="text-xl font-bold text-[#1f2937] dark:text-[#e4e4e7]">IMEI Blind Scan</h2>
                            <p className="text-sm text-[#6b7280] dark:text-[#71717a]">Specifications will be bound later via Auction/Invoice sheets</p>
                        </div>
                        <div className="w-full max-w-xl">
                            <input
                                ref={quickScanRef}
                                value={scanBuffer}
                                onChange={e => setScanBuffer(e.target.value)}
                                onKeyDown={handleQuickScan}
                                placeholder="Scan IMEI and press Enter..."
                                className="form-input w-full py-6 text-2xl text-center font-mono font-bold tracking-widest"
                            />
                        </div>
                        <div className="flex gap-8 text-center">
                            <div>
                                <div className="text-3xl font-bold text-[#1f2937] dark:text-[#e4e4e7]">{scannedItems.length}</div>
                                <div className="text-xs font-bold uppercase tracking-wider text-[#6b7280] dark:text-[#71717a]">Items in Buffer</div>
                            </div>
                        </div>
                    </div>
                )}

                {mode === 'batch' && (
                    <div className="card p-6 grid grid-cols-4 gap-6">
                        <div className="form-group">
                            <label className="form-label text-xs">Batch Model</label>
                            <select
                                className="form-select"
                                value={batchHeader.model_number}
                                onChange={e => setBatchHeader({...batchHeader, model_number: e.target.value})}
                            >
                                <option value="">Select Model...</option>
                                {models.map(m => <option key={m.model_number} value={m.model_number}>{m.name} ({m.model_number})</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label text-xs">Condition</label>
                            <select
                                className="form-select"
                                value={batchHeader.condition}
                                onChange={e => setBatchHeader({...batchHeader, condition: e.target.value})}
                            >
                                <option value="A">Grade A</option>
                                <option value="B">Grade B</option>
                                <option value="C">Grade C</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label text-xs">Unit Cost</label>
                            <input
                                type="number"
                                className="form-input"
                                value={batchHeader.acquisition_cost}
                                onChange={e => setBatchHeader({...batchHeader, acquisition_cost: parseFloat(e.target.value)})}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label text-xs">Scan to Hydrate</label>
                            <input
                                ref={batchScanRef}
                                value={scanBuffer}
                                onChange={e => setScanBuffer(e.target.value)}
                                onKeyDown={handleQuickScan}
                                placeholder="Auto-Focus Active..."
                                className="form-input font-mono font-bold"
                            />
                        </div>
                    </div>
                )}

                {(mode !== 'standard' || fields.length > 0) && (
                    <div className="card overflow-hidden">
                        <table className="table-standard">
                            <thead>
                                <tr>
                                    <th>IMEI</th>
                                    <th>Context</th>
                                    <th>Status</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {mode !== 'standard' ? (
                                    scannedItems.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="font-mono font-bold text-xs">{item.imei}</td>
                                            <td>
                                                <div className="text-xs font-bold text-[#6b7280] dark:text-[#71717a]">
                                                    {item.model_number ? `Batch: ${item.model_number} | ${item.condition}` : 'Raw IMEI registration'}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`badge ${item.model_number ? 'badge-success' : 'badge-neutral'}`}>
                                                    {item.model_number ? 'Hydrated' : 'Raw'}
                                                </span>
                                            </td>
                                            <td className="text-right">
                                                <button onClick={() => setScannedItems(scannedItems.filter((_, i) => i !== idx))} className="text-[#9ca3af] dark:text-[#52525b] hover:text-red-500"><Trash2 size={16} /></button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    fields.map((field, index) => (
                                        <tr key={field.id} className="group">
                                            <td>
                                                <input
                                                    {...register(`devices.${index}.imei` as const, { required: true })}
                                                    placeholder="IMEI..."
                                                    className="form-input w-full py-2 text-xs font-mono font-bold"
                                                />
                                            </td>
                                            <td>
                                                <select
                                                    {...register(`devices.${index}.model_number` as const)}
                                                    className="form-select w-full py-2 text-xs font-bold"
                                                >
                                                    <option value="">Model...</option>
                                                    {models.map(m => <option key={m.model_number} value={m.model_number}>{m.name}</option>)}
                                                </select>
                                            </td>
                                            <td>
                                                <span className="badge badge-neutral">Standard</span>
                                            </td>
                                            <td className="text-right">
                                                <button type="button" onClick={() => remove(index)} className="text-[#9ca3af] dark:text-[#52525b] hover:text-red-500"><Trash2 size={16} /></button>
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
                                className="w-full py-4 text-xs font-bold uppercase tracking-wider text-[#6b7280] dark:text-[#71717a] hover:bg-[#f9fafb] dark:bg-[#1a1a1c] transition-colors flex items-center justify-center gap-2 border-t border-dashed border-[#e5e7eb] dark:border-[#1f1f21]"
                            >
                                <Plus size={14} /> Insert Blank Row
                            </button>
                        )}
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-lg flex items-center gap-3 text-red-500 text-xs font-bold">
                        <AlertCircle size={18} /> {error}
                    </div>
                )}

                <div className="flex justify-end gap-6">
                    {(mode !== 'standard' && scannedItems.length > 0) && (
                        <button
                            onClick={() => setScannedItems([])}
                            className="text-xs font-bold uppercase tracking-wider text-[#6b7280] dark:text-[#71717a] hover:text-red-500 transition-colors"
                        >
                            Discard Buffer
                        </button>
                    )}
                    <button
                        onClick={() => onSubmit()}
                        disabled={isSubmitting || (mode !== 'standard' && scannedItems.length === 0)}
                        className="btn-primary px-12 h-14 text-sm font-bold flex items-center justify-center gap-3"
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
