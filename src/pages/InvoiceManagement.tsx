import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Search, FileText, User, Calendar, DollarSign, Edit3, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function InvoiceManagement() {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [invoices, setInvoices] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const fetchInvoices = async (q = '') => {
        setIsLoading(true);
        try {
            const res = await axios.get(`/api/pos/invoices?query=${q}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setInvoices(res.data);
        } catch (err) {
            console.error("Fetch invoices error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchInvoices();
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchInvoices(searchQuery);
    };

    const handleEdit = (invoice: any) => {
        navigate(`/admin/wholesale-checkout?edit=${invoice.invoice_number}`);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Paid':
                return <span className="badge-glow badge-success">Paid</span>;
            case 'Unpaid':
                return <span className="badge-glow badge-error">Unpaid</span>;
            default:
                return <span className="badge-glow badge-neutral">{status.toUpperCase()}</span>;
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50">
            <header className="p-6 bg-white border-b border-zinc-200 flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold text-zinc-900">Financial Ledger</h1>
                    <p className="text-xs text-zinc-500 mt-1">Deep-search invoice repository & audit trail</p>
                </div>
                <form onSubmit={handleSearch} className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-zinc-900 transition-colors" size={14} />
                    <input
                        type="text"
                        placeholder="Search inv#, customer, imei..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="input-stark pl-10 w-80 py-2.5 text-xs"
                    />
                </form>
            </header>

            <div className="flex-1 overflow-auto p-6">
                <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse table-fixed">
                        <thead className="bg-zinc-50/50 border-b border-zinc-200">
                            <tr className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">
                                <th className="px-8 py-4 w-64">Invoice Identifier</th>
                                <th className="px-8 py-4 w-64">Customer / Entity</th>
                                <th className="px-8 py-4 w-48">Date Issued</th>
                                <th className="px-8 py-4 w-48">Financial Total</th>
                                <th className="px-8 py-4 w-32">Status</th>
                                <th className="px-8 py-4 w-32 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {isLoading ? (
                                <tr><td colSpan={6} className="py-32 text-center text-zinc-400 animate-pulse font-medium">Querying Financial Records...</td></tr>
                            ) : invoices.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-32 text-center">
                                        <div className="text-xs font-semibold uppercase tracking-widest text-zinc-300">No matching records identified</div>
                                    </td>
                                </tr>
                            ) : (
                                invoices.map(inv => (
                                    <tr key={inv.id} className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors group">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2 text-zinc-900 font-bold uppercase tracking-widest text-xs">
                                                <FileText size={16} className="text-zinc-400" />
                                                {inv.invoice_number}
                                            </div>
                                            <div className="text-[10px] text-zinc-400 font-semibold tracking-widest mt-1 uppercase">Node: {inv.store_id}</div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2 text-zinc-700 font-bold uppercase tracking-tight text-xs">
                                                <User size={16} className="text-zinc-400" />
                                                {inv.customer?.company_name || inv.customer?.name || 'WALK-IN CUSTOMER'}
                                            </div>
                                            <div className="text-[10px] text-zinc-400 font-semibold tracking-widest mt-1 uppercase">{inv.customer?.crm_id || 'RETAIL-WALKIN'}</div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2 text-zinc-500 font-medium">
                                                <Calendar size={16} />
                                                {new Date(inv.created_at).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-1 text-zinc-900 font-bold">
                                                <DollarSign size={14} className="text-zinc-400" />
                                                {inv.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </div>
                                            <div className="text-[10px] text-zinc-400 font-semibold tracking-widest mt-1 uppercase">{inv.items.length} Assets Linked</div>
                                        </td>
                                        <td className="px-8 py-5">
                                            {getStatusBadge(inv.status)}
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {(inv.status === 'Unpaid' || inv.status === 'Draft') && (
                                                    <button onClick={() => handleEdit(inv)} className="text-zinc-300 hover:text-zinc-900 transition-colors" title="Edit Document">
                                                        <Edit3 size={18} />
                                                    </button>
                                                )}
                                                <button className="text-zinc-300 hover:text-zinc-900 transition-colors" title="View PDF">
                                                    <ExternalLink size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
