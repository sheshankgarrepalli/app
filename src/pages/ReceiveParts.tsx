import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Package, CheckCircle2 } from 'lucide-react';

export default function ReceiveParts() {
    const { token } = useAuth();
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [models, setModels] = useState<any[]>([]);
    const [recentIntakes, setRecentIntakes] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        model_number: '',
        category: 'Screen',
        quality: 'OEM',
        supplier_id: '',
        qty: ''
    });

    const [isProcessing, setIsProcessing] = useState(false);
    const [success, setSuccess] = useState(false);

    const categories = ["Screen", "Battery", "Charge Port", "Camera", "Back Glass", "Speaker"];
    const qualities = ["OEM", "Aftermarket", "Premium"];

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const [supRes, modRes, invRes] = await Promise.all([
                axios.get((import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/parts/suppliers', { headers: { Authorization: `Bearer ${token}` } }),
                axios.get((import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/models/', { headers: { Authorization: `Bearer ${token}` } }),
                axios.get((import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/parts/', { headers: { Authorization: `Bearer ${token}` } })
            ]);
            setSuppliers(supRes.data);
            setModels(modRes.data);
            setRecentIntakes(invRes.data.slice(0, 10));
        } catch (err) {
            console.error(err);
        }
    };

    const handleReceive = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        try {
            await axios.post((import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/parts/receive', {
                ...formData,
                supplier_id: parseInt(formData.supplier_id),
                qty: parseInt(formData.qty)
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSuccess(true);
            setFormData({ ...formData, qty: '' });
            fetchInitialData();
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            console.error(err);
            alert("Intake failed");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50">
            <header className="p-6 bg-white border-b border-zinc-200 flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold text-zinc-900">Component Intake</h1>
                    <p className="text-xs text-zinc-500 mt-1">Physical intake & SKU resolution for technical parts</p>
                </div>
            </header>

            <div className="flex-1 grid grid-cols-12 overflow-hidden">
                {/* CONTROLS (1/3) */}
                <div className="col-span-4 bg-white border-r border-zinc-200 p-6 space-y-8 overflow-y-auto">
                    <form onSubmit={handleReceive} className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 ml-1">Device Model</label>
                                <select
                                    required
                                    value={formData.model_number}
                                    onChange={e => setFormData({ ...formData, model_number: e.target.value })}
                                    className="input-stark w-full py-3 text-xs font-bold uppercase tracking-widest"
                                >
                                    <option value="">Select Model...</option>
                                    {models.map(m => (
                                        <option key={m.model_number} value={m.model_number}>{m.model_number} - {m.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 ml-1">Part Category</label>
                                <select
                                    required
                                    value={formData.category}
                                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                                    className="input-stark w-full py-3 text-xs font-bold uppercase tracking-widest"
                                >
                                    {categories.map(c => (
                                        <option key={c} value={c}>{c.toUpperCase()}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 ml-1">Quality Grade</label>
                                <select
                                    required
                                    value={formData.quality}
                                    onChange={e => setFormData({ ...formData, quality: e.target.value })}
                                    className="input-stark w-full py-3 text-xs font-bold uppercase tracking-widest"
                                >
                                    {qualities.map(q => (
                                        <option key={q} value={q}>{q.toUpperCase()}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 ml-1">Supplier Node</label>
                                <select
                                    required
                                    value={formData.supplier_id}
                                    onChange={e => setFormData({ ...formData, supplier_id: e.target.value })}
                                    className="input-stark w-full py-3 text-xs font-bold uppercase tracking-widest"
                                >
                                    <option value="">Select Supplier...</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 ml-1">Quantity Received</label>
                                <input
                                    required
                                    type="number"
                                    value={formData.qty}
                                    onChange={e => setFormData({ ...formData, qty: e.target.value })}
                                    placeholder="0"
                                    className="input-stark w-full py-3 text-sm font-bold"
                                />
                            </div>
                        </div>

                        <button
                            disabled={isProcessing}
                            className="btn-primary w-full py-4 text-xs font-semibold uppercase tracking-[0.2em] flex items-center justify-center gap-3"
                        >
                            {isProcessing ? 'Synchronizing...' : (
                                <>
                                    <Package size={20} /> Log Physical Intake
                                </>
                            )}
                        </button>

                        {success && (
                            <div className="flex items-center justify-center gap-2 text-emerald-600 animate-in fade-in slide-in-from-bottom-2">
                                <CheckCircle2 size={16} />
                                <span className="text-xs font-bold uppercase tracking-widest">Intake Synchronized</span>
                            </div>
                        )}
                    </form>
                </div>

                {/* PREVIEW (2/3) */}
                <div className="col-span-8 flex flex-col bg-zinc-50 overflow-hidden">
                    <div className="p-4 border-b border-zinc-200 bg-white">
                        <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">Recent Inventory Updates</label>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-zinc-50/50 border-b border-zinc-200">
                                    <tr className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">
                                        <th className="px-8 py-4 w-48">SKU Identifier</th>
                                        <th className="px-8 py-4">Component Specification</th>
                                        <th className="px-8 py-4 text-center w-24">Stock</th>
                                        <th className="px-8 py-4 text-right w-32">MAC (Cost)</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {recentIntakes.map(item => (
                                        <tr key={item.sku} className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                                            <td className="px-8 py-4 font-mono text-zinc-900 font-bold tracking-widest uppercase text-xs">{item.sku}</td>
                                            <td className="px-8 py-4 uppercase tracking-wider text-zinc-700 font-semibold">{item.part_name}</td>
                                            <td className="px-8 py-4 text-center text-zinc-900 font-bold">{item.current_stock_qty}</td>
                                            <td className="px-8 py-4 text-right text-zinc-500 font-medium">${item.moving_average_cost.toFixed(2)}</td>
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
