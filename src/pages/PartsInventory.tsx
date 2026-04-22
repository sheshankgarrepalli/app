import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Search, Plus } from 'lucide-react';

export default function PartsInventory() {
    const { token } = useAuth();
    const [parts, setParts] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchParts();
    }, []);

    const fetchParts = async () => {
        try {
            const res = await axios.get((import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/parts/', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setParts(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredParts = parts.filter(p =>
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.part_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusBadge = (qty: number, threshold: number) => {
        if (qty <= threshold) {
            return <span className="badge-glow badge-error">Low Stock</span>;
        }
        return <span className="badge-glow badge-neutral">Healthy</span>;
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50">
            <header className="p-6 bg-white border-b border-zinc-200 flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold text-zinc-900">Parts Ledger</h1>
                    <p className="text-xs text-zinc-500 mt-1">Moving average cost (MAC) & inventory valuation</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-zinc-900 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search SKU / part..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="input-stark pl-9 py-2.5 w-64"
                        />
                    </div>
                    <button
                        onClick={() => window.location.href = '/admin/receive-parts'}
                        className="btn-primary flex items-center gap-2 px-6 py-2.5 text-xs font-semibold uppercase tracking-widest"
                    >
                        <Plus size={16} /> Intake
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-auto p-6">
                <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse table-fixed">
                        <thead className="bg-zinc-50/50 border-b border-zinc-200">
                            <tr className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">
                                <th className="px-8 py-4 w-48">SKU Identifier</th>
                                <th className="px-8 py-4">Component Specification</th>
                                <th className="px-8 py-4 text-center w-24">Stock</th>
                                <th className="px-8 py-4 text-right w-32">MAC (Cost)</th>
                                <th className="px-8 py-4 text-right w-40">Total Valuation</th>
                                <th className="px-8 py-4 text-center w-32">Status</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {isLoading ? (
                                <tr><td colSpan={6} className="py-32 text-center text-zinc-400 animate-pulse font-medium">Synchronizing Ledger...</td></tr>
                            ) : filteredParts.length === 0 ? (
                                <tr><td colSpan={6} className="py-32 text-center text-zinc-300 font-semibold uppercase tracking-widest">No components identified</td></tr>
                            ) : filteredParts.map(part => (
                                <tr key={part.sku} className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors group">
                                    <td className="px-8 py-5 font-mono text-zinc-900 font-bold tracking-widest uppercase text-xs">{part.sku}</td>
                                    <td className="px-8 py-5 uppercase tracking-wider text-zinc-700 font-semibold">{part.part_name}</td>
                                    <td className="px-8 py-5 text-center text-zinc-900 font-bold">{part.current_stock_qty}</td>
                                    <td className="px-8 py-5 text-right text-zinc-500 font-medium">${part.moving_average_cost.toFixed(2)}</td>
                                    <td className="px-8 py-5 text-right text-zinc-900 font-bold">${(part.current_stock_qty * part.moving_average_cost).toFixed(2)}</td>
                                    <td className="px-8 py-5 text-center">
                                        {getStatusBadge(part.current_stock_qty, part.low_stock_threshold)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
