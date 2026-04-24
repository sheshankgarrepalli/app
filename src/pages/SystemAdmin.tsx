import { useState, useEffect } from 'react';
import UserManagement from './UserManagement';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Users, DollarSign, Edit2 } from 'lucide-react';

export default function SystemAdmin() {
    const [activeTab, setActiveTab] = useState('users');

    const tabs = [
        { id: 'users', label: 'User Management', icon: Users },
        { id: 'labor', label: 'Labor & Fees Setup', icon: DollarSign }
    ];

    return (
        <div className="flex flex-col h-full bg-zinc-50">
            <header className="p-6 bg-white border-b border-zinc-200 flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold text-zinc-900">System Administration</h1>
                    <p className="text-xs text-zinc-500 mt-1">Global configurations & access control</p>
                </div>
            </header>

            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-8 bg-white border-b border-zinc-200">
                    <div className="flex gap-12">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`pt-6 pb-4 text-xs font-semibold uppercase tracking-[0.1em] transition-all relative flex items-center gap-2 ${activeTab === tab.id ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'
                                    }`}
                            >
                                <tab.icon size={14} />
                                {tab.label}
                                {activeTab === tab.id && (
                                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-zinc-900 animate-in fade-in slide-in-from-bottom-1" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-auto">
                    {activeTab === 'users' && <UserManagement />}
                    {activeTab === 'labor' && <LaborRatesSetup />}
                </div>
            </div>
        </div>
    );
}

function LaborRatesSetup() {
    const { token } = useAuth();
    const [rates, setRates] = useState<any[]>([]);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValue, setEditValue] = useState('');

    useEffect(() => {
        fetchRates();
    }, []);

    const fetchRates = async () => {
        try {
            const res = await axios.get((import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/admin/rates', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRates(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleUpdate = async (actionName: string) => {
        const payload = {
            action_name: actionName,
            fee_amount: parseFloat(editValue)
        };

        try {
            await axios.put(`/api/admin/rates/upsert`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEditingId(null);
            fetchRates();
        } catch (err: any) {
            alert(`Failed to save: ${err.response?.data?.detail || err.message}`);
        }
    };

    return (
        <div className="p-8 max-w-5xl">
            <header className="mb-8">
                <h2 className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 mb-1">Dynamic Labor Fees</h2>
                <p className="text-sm text-zinc-400">Configure technician and QC rates per action</p>
            </header>

            <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-zinc-50/50 border-b border-zinc-200">
                        <tr className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">
                            <th className="px-8 py-4">Action Specification</th>
                            <th className="px-8 py-4 text-right w-48">Fee Amount</th>
                            <th className="px-8 py-4 text-right w-32">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {rates.map(rate => (
                            <tr key={rate.id} className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors group">
                                <td className="px-8 py-5 uppercase tracking-wider text-zinc-900 font-semibold">{rate.action_name.replace('_', ' ')}</td>
                                <td className="px-8 py-5 text-right">
                                    {editingId === rate.id ? (
                                        <div className="flex justify-end items-center gap-2">
                                            <span className="text-zinc-400 text-sm">$</span>
                                            <input
                                                type="number"
                                                value={editValue}
                                                onChange={e => setEditValue(e.target.value)}
                                                className="w-24 bg-transparent border-b border-zinc-900 outline-none text-right font-bold text-zinc-900 text-sm py-0.5"
                                                autoFocus
                                            />
                                        </div>
                                    ) : (
                                        <span className="text-zinc-900 font-bold text-sm">${rate.fee_amount.toFixed(2)}</span>
                                    )}
                                </td>
                                <td className="px-8 py-5 text-right">
                                    {editingId === rate.id ? (
                                        <button onClick={() => handleUpdate(rate.action_name)} className="text-emerald-600 hover:text-emerald-700 transition-colors font-bold uppercase tracking-widest text-[10px]">Save</button>
                                    ) : (
                                        <button onClick={() => { setEditingId(rate.id); setEditValue(rate.fee_amount.toString()); }} className="text-zinc-300 hover:text-zinc-900 transition-colors opacity-0 group-hover:opacity-100"><Edit2 size={16} /></button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <button
                onClick={() => axios.post((import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/admin/rates/seed', {}, { headers: { Authorization: `Bearer ${token}` } }).then(fetchRates)}
                className="mt-8 text-xs font-semibold uppercase tracking-widest text-zinc-400 hover:text-zinc-900 transition-colors"
            >
                Initialize Default Rates
            </button>
        </div>
    );
}
