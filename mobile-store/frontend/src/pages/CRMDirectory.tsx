import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Search, Edit2, Trash2, UserPlus } from 'lucide-react';
import CustomerModal from '../components/CustomerModal';
import CustomerDetailModal from '../components/CustomerDetailModal';

export default function CRMDirectory() {
    const { token } = useAuth();
    const [customers, setCustomers] = useState<any[]>([]);
    const [filter, setFilter] = useState('');

    const [isModalOpen, setModalOpen] = useState(false);
    const [isDetailOpen, setDetailOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = () => {
        axios.get('http://localhost:8000/api/crm/', { headers: { Authorization: `Bearer ${token}` } })
            .then(res => setCustomers(res.data))
            .catch(err => console.error(err));
    };

    const handleDeactivate = async (e: any, crm_id: string) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to deactivate this customer?")) return;
        try {
            await axios.delete(`http://localhost:8000/api/crm/${crm_id}`, { headers: { Authorization: `Bearer ${token}` } });
            fetchCustomers();
        } catch (err) {
            alert("Error deactivating customer");
        }
    };

    const openEdit = (e: any, c: any) => {
        e.stopPropagation();
        setSelectedCustomer(c);
        setModalOpen(true);
    };

    const openDetail = (c: any) => {
        setSelectedCustomer(c);
        setDetailOpen(true);
    };

    const openAdd = () => {
        setSelectedCustomer(null);
        setModalOpen(true);
    };

    const filtered = customers.filter(c => {
        const searchTerm = filter.toLowerCase();
        const nameMatches = c.first_name?.toLowerCase().includes(searchTerm) ||
            c.last_name?.toLowerCase().includes(searchTerm) ||
            c.company_name?.toLowerCase().includes(searchTerm) ||
            c.name?.toLowerCase().includes(searchTerm) || '';
        const phoneMatches = c.phone?.includes(searchTerm);
        return nameMatches || phoneMatches;
    });

    return (
        <div className="flex flex-col h-full bg-zinc-50">
            <header className="p-6 bg-white border-b border-zinc-200 flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold text-zinc-900">CRM Database</h1>
                    <p className="text-xs text-zinc-500 mt-1">Customer relationship & credit management</p>
                </div>
                <button
                    onClick={openAdd}
                    className="btn-primary flex items-center gap-2 px-6 py-2.5 text-xs font-semibold uppercase tracking-widest"
                >
                    <UserPlus size={16} /> New Entity
                </button>
            </header>

            <div className="p-6 bg-white border-b border-zinc-200">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                    <input
                        placeholder="Search by name, company, or phone..."
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        className="input-stark w-full pl-10 py-3"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
                <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse table-fixed">
                        <thead className="bg-zinc-50/50 border-b border-zinc-200">
                            <tr className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">
                                <th className="px-8 py-4 w-64">Entity Name / Company</th>
                                <th className="px-8 py-4 w-32">Classification</th>
                                <th className="px-8 py-4 w-40">Contact Node</th>
                                <th className="px-8 py-4 w-48">Ledger Status</th>
                                <th className="px-8 py-4 w-24 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-32 text-center">
                                        <div className="text-xs font-semibold uppercase tracking-widest text-zinc-300">No matching records identified</div>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(c => (
                                    <tr key={c.crm_id} onClick={() => openDetail(c)} className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors cursor-pointer group">
                                        <td className="px-8 py-5">
                                            <div className="font-bold text-zinc-900 uppercase text-xs tracking-widest group-hover:text-zinc-600 transition-colors">
                                                {c.customer_type === 'Wholesale' ? (c.company_name || c.name) : `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.name}
                                            </div>
                                            {c.customer_type === 'Wholesale' && c.contact_person && (
                                                <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mt-1">Attn: {c.contact_person}</div>
                                            )}
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="badge-glow badge-neutral">
                                                {c.customer_type}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 font-bold text-zinc-700 tracking-widest text-xs">{c.phone || <span className="text-zinc-300 italic">N/A</span>}</td>
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col gap-1">
                                                <span className={`text-xs font-bold uppercase tracking-widest ${c.current_balance > 0 ? 'text-rose-600' : 'text-zinc-900'}`}>
                                                    ${c.current_balance?.toLocaleString()} Balance
                                                </span>
                                                <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-widest">
                                                    Limit: ${c.credit_limit?.toLocaleString()}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex items-center justify-end gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={(e) => openEdit(e, c)} className="text-zinc-300 hover:text-zinc-900 transition-colors" title="Edit Entity"><Edit2 size={18} /></button>
                                                <button onClick={(e) => handleDeactivate(e, c.crm_id)} className="text-zinc-300 hover:text-rose-600 transition-colors" title="Deactivate"><Trash2 size={18} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <CustomerModal
                isOpen={isModalOpen}
                onClose={() => setModalOpen(false)}
                customer={selectedCustomer}
                onSuccess={() => {
                    setModalOpen(false);
                    fetchCustomers();
                }}
            />

            <CustomerDetailModal
                isOpen={isDetailOpen}
                onClose={() => setDetailOpen(false)}
                customer={selectedCustomer}
                onUpdate={fetchCustomers}
            />
        </div>
    );
}
