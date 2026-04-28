import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Plus, X } from 'lucide-react';

export default function LaborRates() {
    const { token } = useAuth();
    const [rates, setRates] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editAmount, setEditAmount] = useState('');
    const [formData, setFormData] = useState({ action_name: '', fee_amount: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const API = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000');

    useEffect(() => { fetchRates(); }, []);

    const fetchRates = async () => {
        try {
            const res = await axios.get(`${API}/api/parts/labor-rates`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRates(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.action_name || !formData.fee_amount) return;
        setIsSubmitting(true);
        try {
            await axios.post(`${API}/api/parts/labor-rates`, {
                action_name: formData.action_name,
                fee_amount: parseFloat(formData.fee_amount)
            }, { headers: { Authorization: `Bearer ${token}` } });
            setFormData({ action_name: '', fee_amount: '' });
            setShowForm(false);
            fetchRates();
        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdate = async (id: number) => {
        if (!editAmount) return;
        try {
            await axios.put(`${API}/api/parts/labor-rates/${id}`, {
                fee_amount: parseFloat(editAmount)
            }, { headers: { Authorization: `Bearer ${token}` } });
            setEditingId(null);
            setEditAmount('');
            fetchRates();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50">
            <header className="p-6 bg-white border-b border-zinc-200 flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold text-zinc-900">Labor Rate Configuration</h1>
                    <p className="text-xs text-zinc-500 mt-1">Per-action labor fees charged during repair and QC</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="btn-primary flex items-center gap-2 px-6 py-2.5 text-xs font-semibold uppercase tracking-widest"
                >
                    <Plus size={16} /> Add Rate
                </button>
            </header>

            <div className="flex-1 overflow-auto p-6">
                <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-zinc-50/50 border-b border-zinc-200">
                            <tr className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">
                                <th className="px-8 py-4 w-24">ID</th>
                                <th className="px-8 py-4">Action</th>
                                <th className="px-8 py-4 text-right w-40">Fee Amount</th>
                                <th className="px-8 py-4 text-center w-32">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {isLoading ? (
                                <tr><td colSpan={4} className="py-32 text-center text-zinc-400 animate-pulse font-medium">Loading rates...</td></tr>
                            ) : rates.length === 0 ? (
                                <tr><td colSpan={4} className="py-32 text-center text-zinc-300 font-semibold uppercase tracking-widest">No labor rates configured</td></tr>
                            ) : rates.map(r => (
                                <tr key={r.id} className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                                    <td className="px-8 py-5 text-zinc-400 font-mono text-xs">{r.id}</td>
                                    <td className="px-8 py-5 text-zinc-900 font-bold uppercase tracking-wider">{r.action_name.replace(/_/g, ' ')}</td>
                                    <td className="px-8 py-5 text-right">
                                        {editingId === r.id ? (
                                            <div className="flex items-center justify-end gap-2">
                                                <span className="text-zinc-400">$</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={editAmount}
                                                    onChange={e => setEditAmount(e.target.value)}
                                                    className="w-24 border-b border-zinc-900 outline-none text-right font-bold text-sm py-0.5 bg-transparent"
                                                    autoFocus
                                                />
                                            </div>
                                        ) : (
                                            <span className="text-zinc-900 font-bold">${r.fee_amount.toFixed(2)}</span>
                                        )}
                                    </td>
                                    <td className="px-8 py-5 text-center">
                                        {editingId === r.id ? (
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => handleUpdate(r.id)} className="btn-primary px-3 py-1.5 text-xs uppercase tracking-widest">Save</button>
                                                <button onClick={() => { setEditingId(null); setEditAmount(''); }} className="text-zinc-400 hover:text-zinc-900">
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => { setEditingId(r.id); setEditAmount(String(r.fee_amount)); }}
                                                className="text-xs font-semibold uppercase tracking-widest text-zinc-400 hover:text-zinc-900 transition-colors"
                                            >
                                                Edit
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 w-full max-w-md p-8">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-widest">New Labor Rate</h2>
                            <button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-zinc-900">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">Action Name</label>
                                <input
                                    type="text"
                                    value={formData.action_name}
                                    onChange={e => setFormData({ ...formData, action_name: e.target.value })}
                                    placeholder="e.g. Repair_Screen"
                                    className="input-stark w-full py-3 text-sm font-bold mt-1"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">Fee Amount ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.fee_amount}
                                    onChange={e => setFormData({ ...formData, fee_amount: e.target.value })}
                                    placeholder="0.00"
                                    className="input-stark w-full py-3 text-sm font-bold mt-1"
                                    required
                                />
                            </div>
                            <button
                                disabled={isSubmitting}
                                className="btn-primary w-full py-3 text-xs font-semibold uppercase tracking-[0.2em]"
                            >
                                {isSubmitting ? 'Creating...' : 'Create Rate'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
