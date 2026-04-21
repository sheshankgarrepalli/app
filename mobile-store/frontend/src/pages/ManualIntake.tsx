import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash2, Save, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ManualIntakeForm {
    devices: {
        imei: string;
        serial_number: string;
        model_number: string;
        condition: string;
        acquisition_cost: number;
    }[];
}

export default function ManualIntake() {
    const { token } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [models, setModels] = useState<any[]>([]);

    const { register, control, handleSubmit, reset, formState: { errors } } = useForm<ManualIntakeForm>({
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
                const res = await axios.get('http://localhost:8000/api/models/', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setModels(res.data);
            } catch (err) {
                console.error("Fetch models error:", err);
            }
        };
        fetchModels();
    }, [token]);

    const onSubmit = async (data: ManualIntakeForm) => {
        setIsSubmitting(true);
        setError(null);
        setSuccess(false);
        try {
            await axios.post('http://localhost:8000/api/inventory/batch-manual', data, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSuccess(true);
            reset({
                devices: [{ imei: '', serial_number: '', model_number: '', condition: 'A', acquisition_cost: 0 }]
            });
        } catch (err: any) {
            setError(err.response?.data?.detail || "An error occurred during batch ingestion.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50">
            <header className="p-6 bg-white border-b border-zinc-200 flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold text-zinc-900">Manual Device Intake</h1>
                    <p className="text-xs text-zinc-500 mt-1">Direct asset ingestion & cost reconciliation</p>
                </div>
                <div className="flex gap-3">
                    {success && (
                        <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-widest animate-in fade-in slide-in-from-right-2">
                            <CheckCircle2 size={16} /> Batch Synchronized
                        </div>
                    )}
                    <button
                        onClick={() => append({ imei: '', serial_number: '', model_number: '', condition: 'A', acquisition_cost: 0 })}
                        className="btn-secondary flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest"
                    >
                        <Plus size={14} /> Add Row
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-auto p-6">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-zinc-50/50 border-b border-zinc-200">
                                <tr className="text-xs font-bold uppercase tracking-[0.1em] text-zinc-500">
                                    <th className="px-6 py-4 w-48">IMEI (Required)</th>
                                    <th className="px-6 py-4 w-48">Serial Number</th>
                                    <th className="px-6 py-4">Model Number</th>
                                    <th className="px-6 py-4 w-32">Condition</th>
                                    <th className="px-6 py-4 w-40">Cost ($)</th>
                                    <th className="px-6 py-4 w-16"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {fields.map((field: any, index: number) => (
                                    <tr key={field.id} className="hover:bg-zinc-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <input
                                                {...register(`devices.${index}.imei` as const, { required: true })}
                                                placeholder="IMEI..."
                                                className={`input-stark w-full py-2 text-xs font-mono font-bold tracking-widest ${errors.devices?.[index]?.imei ? 'border-rose-500' : ''}`}
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <input
                                                {...register(`devices.${index}.serial_number` as const)}
                                                placeholder="S/N..."
                                                className="input-stark w-full py-2 text-xs font-mono font-bold tracking-widest"
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <select
                                                {...register(`devices.${index}.model_number` as const, { required: true })}
                                                className={`input-stark w-full py-2 text-xs font-bold uppercase tracking-widest ${errors.devices?.[index]?.model_number ? 'border-rose-500' : ''}`}
                                            >
                                                <option value="">Select Model...</option>
                                                {Array.isArray(models) && models.map(m => (
                                                    <option key={m.model_number} value={m.model_number}>{m.model_number} - {m.name}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-6 py-4">
                                            <select
                                                {...register(`devices.${index}.condition` as const)}
                                                className="input-stark w-full py-2 text-xs font-bold uppercase tracking-widest"
                                            >
                                                <option value="A">Grade A</option>
                                                <option value="B">Grade B</option>
                                                <option value="C">Grade C</option>
                                                <option value="D">Grade D</option>
                                                <option value="F">Grade F</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">$</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    {...register(`devices.${index}.acquisition_cost` as const, { valueAsNumber: true })}
                                                    className="input-stark w-full pl-7 py-2 text-xs font-bold"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {fields.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => remove(index)}
                                                    className="text-zinc-300 hover:text-rose-600 transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {error && (
                        <div className="p-4 bg-rose-50 border border-rose-100 rounded-lg flex items-center gap-3 text-rose-600 text-xs font-bold uppercase tracking-widest animate-in shake duration-300">
                            <AlertCircle size={18} /> {error}
                        </div>
                    )}

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="btn-primary w-64 h-12 text-xs font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-3"
                        >
                            {isSubmitting ? 'Synchronizing...' : (
                                <>
                                    <Save size={18} /> Save Batch to Inventory
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
