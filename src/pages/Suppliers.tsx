import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Plus, X } from 'lucide-react';

export default function Suppliers() {
    const { token } = useAuth();
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const API = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000');

    useEffect(() => { fetchSuppliers(); }, []);

    const fetchSuppliers = async () => {
        try {
            const res = await axios.get(`${API}/api/parts/suppliers`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSuppliers(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setIsSubmitting(true);
        setError('');
        try {
            await axios.post(`${API}/api/parts/suppliers?name=${encodeURIComponent(newName.trim())}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNewName('');
            setShowForm(false);
            fetchSuppliers();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to create supplier');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50">
            <header className="p-6 bg-white border-b border-zinc-200 flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold text-zinc-900">Suppliers</h1>
                    <p className="text-xs text-zinc-500 mt-1">Part suppliers and vendors</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="btn-primary flex items-center gap-2 px-6 py-2.5 text-xs font-semibold uppercase tracking-widest"
                >
                    <Plus size={16} /> Add Supplier
                </button>
            </header>

            <div className="flex-1 overflow-auto p-6">
                <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-zinc-50/50 border-b border-zinc-200">
                            <tr className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">
                                <th className="px-8 py-4 w-24">ID</th>
                                <th className="px-8 py-4">Name</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {isLoading ? (
                                <tr><td colSpan={2} className="py-32 text-center text-zinc-400 animate-pulse font-medium">Loading suppliers...</td></tr>
                            ) : suppliers.length === 0 ? (
                                <tr><td colSpan={2} className="py-32 text-center text-zinc-300 font-semibold uppercase tracking-widest">No suppliers configured</td></tr>
                            ) : suppliers.map(s => (
                                <tr key={s.id} className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                                    <td className="px-8 py-5 text-zinc-400 font-mono text-xs">{s.id}</td>
                                    <td className="px-8 py-5 text-zinc-900 font-bold uppercase tracking-wider">{s.name}</td>
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
                            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-widest">New Supplier</h2>
                            <button onClick={() => { setShowForm(false); setError(''); }} className="text-zinc-400 hover:text-zinc-900">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">Supplier Name</label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    placeholder="e.g. MobileSentrix"
                                    className="input-stark w-full py-3 text-sm font-bold mt-1"
                                    autoFocus
                                    required
                                />
                            </div>
                            {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
                            <button
                                disabled={isSubmitting}
                                className="btn-primary w-full py-3 text-xs font-semibold uppercase tracking-[0.2em]"
                            >
                                {isSubmitting ? 'Creating...' : 'Create Supplier'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
