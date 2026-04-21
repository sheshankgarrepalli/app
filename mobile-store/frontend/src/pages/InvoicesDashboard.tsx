import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
    FileText, Search, RefreshCw, Printer
} from 'lucide-react';

export default function InvoicesDashboard() {
    const { token } = useAuth();
    const [invoices, setInvoices] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchInvoices();
    }, []);

    const fetchInvoices = async () => {
        setIsLoading(true);
        try {
            const res = await axios.get('http://localhost:8000/api/pos/invoices', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setInvoices(res.data);
        } catch (err) {
            console.error("Fetch invoices error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredInvoices = invoices.filter(inv =>
        inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.customer?.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Paid':
                return <span className="badge-glow badge-success">Paid</span>;
            case 'Unpaid':
                return <span className="badge-glow badge-error">Unpaid</span>;
            case 'Partially_Paid':
                return <span className="badge-glow badge-warning">Partial</span>;
            default:
                return <span className="badge-glow badge-neutral">{status}</span>;
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50">
            <header className="p-6 bg-white border-b border-zinc-200 space-y-6">
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-lg font-bold text-zinc-900">Financial Ledger</h1>
                        <p className="text-xs text-zinc-500 mt-1">Invoice management & revenue tracking</p>
                    </div>
                    <div className="flex gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                            <input
                                type="text"
                                placeholder="Search invoices..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="input-stark pl-9 w-64"
                            />
                        </div>
                        <button onClick={fetchInvoices} className="btn-secondary flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-widest">
                            <RefreshCw size={14} /> Refresh
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-auto p-6">
                <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse table-fixed">
                        <thead className="bg-zinc-50/50 border-b border-zinc-200">
                            <tr className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">
                                <th className="px-6 py-4 w-40">Invoice #</th>
                                <th className="px-6 py-4 w-64">Customer</th>
                                <th className="px-6 py-4 w-32">Date</th>
                                <th className="px-6 py-4 w-32">Total</th>
                                <th className="px-6 py-4 w-32">Status</th>
                                <th className="px-6 py-4 w-24 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {isLoading ? (
                                <tr><td colSpan={6} className="py-32 text-center text-zinc-400 animate-pulse font-medium">Loading Ledger...</td></tr>
                            ) : filteredInvoices.map(inv => (
                                <tr key={inv.id} className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="text-zinc-900 font-bold uppercase tracking-widest text-xs">{inv.invoice_number}</div>
                                        <div className="text-[10px] text-zinc-400 font-semibold tracking-widest mt-0.5 uppercase">{inv.store_id}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-zinc-700 font-bold uppercase tracking-tight truncate text-xs">
                                            {inv.customer?.company_name || inv.customer?.name || 'Walk-in Customer'}
                                        </div>
                                        <div className="text-[10px] text-zinc-400 font-semibold tracking-widest mt-0.5 uppercase">{inv.customer?.crm_id || 'N/A'}</div>
                                    </td>
                                    <td className="px-6 py-4 text-zinc-500 font-medium">
                                        {new Date(inv.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-zinc-900 font-bold">
                                        ${inv.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-6 py-4">
                                        {getStatusBadge(inv.status)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="text-zinc-300 hover:text-zinc-900 transition-colors"><FileText size={18} /></button>
                                            <button className="text-zinc-300 hover:text-zinc-900 transition-colors"><Printer size={18} /></button>
                                        </div>
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
