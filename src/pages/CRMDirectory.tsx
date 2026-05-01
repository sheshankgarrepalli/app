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
        axios.get((import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/crm/', { headers: { Authorization: `Bearer ${token}` } })
            .then(res => setCustomers(res.data))
            .catch(err => console.error(err));
    };

    const handleDeactivate = async (e: any, crm_id: string) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to deactivate this customer?")) return;
        try {
            await axios.delete(`/api/crm/${crm_id}`, { headers: { Authorization: `Bearer ${token}` } });
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
        <div className="space-y-4">
            <div className="page-header">
                <div>
                    <h1 className="page-title">CRM Database</h1>
                    <p className="text-xs text-[#6b7280] dark:text-[#71717a] mt-1">Customer relationship & credit management</p>
                </div>
                <button
                    onClick={openAdd}
                    className="btn-primary"
                >
                    <UserPlus size={16} /> New Entity
                </button>
            </div>

            <div className="card p-4">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af] dark:text-[#52525b]" size={16} />
                    <input
                        placeholder="Search by name, company, or phone..."
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        className="form-input w-full pl-10 py-3"
                    />
                </div>
            </div>

            <div className="card overflow-hidden">
                <table className="table-standard">
                    <thead>
                        <tr>
                            <th>Entity Name / Company</th>
                            <th>Classification</th>
                            <th>Contact Node</th>
                            <th>Ledger Status</th>
                            <th className="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="py-32 text-center text-[#9ca3af] dark:text-[#52525b]">No matching records identified</td>
                            </tr>
                        ) : (
                            filtered.map(c => (
                                <tr key={c.crm_id} onClick={() => openDetail(c)} className="cursor-pointer group">
                                    <td className="py-5">
                                        <div className="font-bold text-[#1f2937] dark:text-[#e4e4e7] uppercase text-xs">
                                            {c.customer_type === 'Wholesale' ? (c.company_name || c.name) : `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.name}
                                        </div>
                                        {c.customer_type === 'Wholesale' && c.contact_person && (
                                            <div className="text-[10px] font-semibold uppercase tracking-widest text-[#9ca3af] dark:text-[#52525b] mt-1">Attn: {c.contact_person}</div>
                                        )}
                                    </td>
                                    <td className="py-5">
                                        <span className="badge badge-neutral">
                                            {c.customer_type}
                                        </span>
                                    </td>
                                    <td className="py-5 font-bold text-[#1f2937] dark:text-[#e4e4e7] text-xs">{c.phone || <span className="text-[#9ca3af] dark:text-[#52525b] italic">N/A</span>}</td>
                                    <td className="py-5">
                                        <div className="flex flex-col gap-1">
                                            <span className={`text-xs font-bold uppercase ${c.current_balance > 0 ? 'text-red-500' : 'text-[#1f2937] dark:text-[#e4e4e7]'}`}>
                                                ${c.current_balance?.toLocaleString()} Balance
                                            </span>
                                            <span className="text-[10px] text-[#6b7280] dark:text-[#71717a] font-semibold uppercase">
                                                Limit: ${c.credit_limit?.toLocaleString()}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-5 text-right">
                                        <div className="flex items-center justify-end gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={(e) => openEdit(e, c)} className="text-[#9ca3af] dark:text-[#52525b] hover:text-[#1f2937] dark:text-[#e4e4e7] transition-colors" title="Edit Entity"><Edit2 size={18} /></button>
                                            <button onClick={(e) => handleDeactivate(e, c.crm_id)} className="text-[#9ca3af] dark:text-[#52525b] hover:text-red-500 transition-colors" title="Deactivate"><Trash2 size={18} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
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
