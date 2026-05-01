import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    Search, FileText, Calendar, DollarSign, Edit3, ExternalLink,
    Send, Printer, MoreHorizontal, CheckSquare, Square,
    Clock, AlertCircle, CheckCircle, XCircle,
    Copy, Mail, Ban
} from 'lucide-react';
import EmailPreviewModal from '../components/EmailPreviewModal';

type Invoice = {
    id: number;
    invoice_number: string;
    customer?: { name?: string; company_name?: string; email?: string; crm_id?: string };
    created_at: string;
    invoice_date: string;
    due_date: string;
    total: number;
    status: string;
    store_id?: string;
    items?: any[];
};

const STATUSES = ['All', 'Draft', 'Unpaid', 'Partially_Paid', 'Paid', 'Void', 'Overdue'] as const;

export default function InvoiceManagement() {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [activeFilter, setActiveFilter] = useState<string>('All');
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; invoice: Invoice } | null>(null);
    const [emailModal, setEmailModal] = useState<Invoice | null>(null);

    const contextRef = useRef<HTMLDivElement>(null);

    const fetchInvoices = async (q = '', status = '') => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (q) params.set('query', q);
            if (status && status !== 'All') params.set('status', status);
            const res = await axios.get(`/api/pos/invoices?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setInvoices(res.data);
        } catch (err) {
            console.error("Fetch invoices error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchInvoices(); }, []);
    useEffect(() => { fetchInvoices(searchQuery, activeFilter); }, [activeFilter]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchInvoices(searchQuery, activeFilter);
    };

    const toggleSelect = (id: number) => {
        const next = new Set(selected);
        next.has(id) ? next.delete(id) : next.add(id);
        setSelected(next);
    };

    const toggleAll = () => {
        if (selected.size === invoices.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(invoices.map(i => i.id)));
        }
    };

    const batchAction = async (action: string) => {
        if (selected.size === 0) return;
        const ids = Array.from(selected);
        try {
            if (action === 'send') {
                await axios.post('/api/pos/invoices/batch-send', { invoice_ids: ids }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else if (action === 'print') {
                const resp = await axios.post('/api/pos/invoices/batch-print', { invoice_ids: ids }, {
                    headers: { Authorization: `Bearer ${token}` },
                    responseType: 'blob'
                });
                const url = URL.createObjectURL(resp.data);
                window.open(url);
            } else if (action === 'void') {
                for (const id of ids) {
                    await axios.post(`/api/pos/invoices/${id}/void`, {}, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                }
            }
            setSelected(new Set());
            fetchInvoices(searchQuery, activeFilter);
        } catch (err) {
            console.error(`Batch ${action} error:`, err);
        }
    };

    const handleContextMenu = (e: React.MouseEvent, invoice: Invoice) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, invoice });
    };

    useEffect(() => {
        const close = () => setContextMenu(null);
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, []);

    const getStatusBadge = (status: string) => {
        const map: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
            Draft: { cls: 'badge-glow badge-neutral', icon: <Clock size={10} />, label: 'Draft' },
            Unpaid: { cls: 'badge-glow badge-error', icon: <AlertCircle size={10} />, label: 'Unpaid' },
            Partially_Paid: { cls: 'badge-glow bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20', icon: <Clock size={10} />, label: 'Partial' },
            Paid: { cls: 'badge-glow badge-success', icon: <CheckCircle size={10} />, label: 'Paid' },
            Void: { cls: 'badge-glow bg-zinc-50 text-zinc-500 border border-zinc-200 dark:bg-zinc-500/10 dark:text-zinc-400 dark:border-zinc-500/20', icon: <XCircle size={10} />, label: 'Void' },
            Overdue: { cls: 'badge-glow bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20', icon: <AlertCircle size={10} />, label: 'Overdue' },
        };
        const s = map[status] || map['Draft'];
        return (
            <span className={`${s.cls} flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold`}>
                {s.icon} {s.label}
            </span>
        );
    };

    const contextActions = (invoice: Invoice) => [
        { label: 'Edit', icon: Edit3, action: () => navigate(`/invoices/new?edit=${invoice.invoice_number}`) },
        { label: 'View PDF', icon: ExternalLink, action: () => window.open(`/api/pos/invoices/${invoice.invoice_number}/pdf`) },
        { label: 'Send Email', icon: Mail, action: () => setEmailModal(invoice) },
        { label: 'Duplicate', icon: Copy, action: () => navigate(`/invoices/new?copy=${invoice.invoice_number}`) },
        { label: 'Void', icon: Ban, action: async () => {
            await axios.post(`/api/pos/invoices/${invoice.id}/void`, {}, { headers: { Authorization: `Bearer ${token}` } });
            fetchInvoices(searchQuery, activeFilter);
        }},
    ];

    return (
        <div className="flex flex-col h-full bg-zinc-50 dark:bg-[#0a0a0b]">
            {/* Header */}
            <header className="p-6 bg-white dark:bg-[#141416] border-b border-zinc-200 dark:border-[#1f1f21] space-y-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-lg font-bold text-zinc-900 dark:text-[#e4e4e7]">Invoices</h1>
                        <p className="text-xs text-zinc-500 dark:text-[#71717a] mt-1">{invoices.length} invoices</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <form onSubmit={handleSearch} className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-[#a1a1aa] group-focus-within:text-accent transition-colors" size={14} />
                            <input
                                type="text"
                                placeholder="Search invoice #, customer, IMEI..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="input-stark pl-10 w-72 py-2 text-xs"
                            />
                        </form>
                        <button
                            onClick={() => navigate('/invoices/new')}
                            className="px-4 py-2 bg-accent text-white text-xs font-semibold rounded-md hover:brightness-110 transition-all"
                        >
                            + New Invoice
                        </button>
                    </div>
                </div>

                {/* Filter chips */}
                <div className="flex items-center gap-2 flex-wrap">
                    {STATUSES.map(s => (
                        <button
                            key={s}
                            onClick={() => setActiveFilter(s)}
                            className={`px-3 py-1.5 text-[11px] font-semibold rounded-full transition-all ${
                                activeFilter === s
                                    ? 'bg-accent text-white'
                                    : 'bg-zinc-100 dark:bg-[#0a0a0b] text-zinc-600 dark:text-[#a1a1aa] hover:bg-zinc-200 dark:hover:bg-[#1a1a1c]'
                            }`}
                        >
                            {s.replace('_', ' ')}
                        </button>
                    ))}
                </div>

                {/* Batch bar */}
                {selected.size > 0 && (
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-accent/5 border border-accent/20 rounded-lg">
                        <span className="text-xs font-semibold text-accent">{selected.size} selected</span>
                        <div className="flex-1" />
                        <button onClick={() => batchAction('send')} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#1f1f21] rounded-md hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] text-zinc-700 dark:text-[#e4e4e7]">
                            <Send size={12} /> Send
                        </button>
                        <button onClick={() => batchAction('print')} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#1f1f21] rounded-md hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] text-zinc-700 dark:text-[#e4e4e7]">
                            <Printer size={12} /> Print
                        </button>
                        <button onClick={() => batchAction('void')} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#1f1f21] rounded-md hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] text-red-600 dark:text-red-400">
                            <Ban size={12} /> Void
                        </button>
                    </div>
                )}
            </header>

            {/* Table */}
            <div className="flex-1 overflow-auto p-6">
                <div className="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#1f1f21] rounded-lg shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse table-fixed">
                        <thead className="bg-zinc-50 dark:bg-[#0a0a0b]/50 border-b border-zinc-200 dark:border-[#1f1f21]">
                            <tr className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 dark:text-[#71717a]">
                                <th className="px-4 py-4 w-10">
                                    <button onClick={toggleAll} className="text-zinc-400 dark:text-[#a1a1aa] hover:text-accent">
                                        {selected.size === invoices.length && invoices.length > 0 ? <CheckSquare size={16} /> : <Square size={16} />}
                                    </button>
                                </th>
                                <th className="px-4 py-4 w-36">Invoice #</th>
                                <th className="px-4 py-4 w-48">Customer</th>
                                <th className="px-4 py-4 w-28">Date</th>
                                <th className="px-4 py-4 w-28">Due Date</th>
                                <th className="px-4 py-4 w-28">Total</th>
                                <th className="px-4 py-4 w-24">Status</th>
                                <th className="px-4 py-4 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {isLoading ? (
                                <tr><td colSpan={8} className="py-32 text-center text-zinc-400 dark:text-[#a1a1aa] animate-pulse font-medium">Loading invoices...</td></tr>
                            ) : invoices.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-32 text-center">
                                        <div className="text-xs font-semibold uppercase tracking-widest text-zinc-300 dark:text-[#52525b]">No invoices found</div>
                                        <button onClick={() => navigate('/invoices/new')} className="mt-3 text-xs text-accent font-semibold hover:underline">Create your first invoice</button>
                                    </td>
                                </tr>
                            ) : (
                                invoices.map(inv => (
                                    <tr
                                        key={inv.id}
                                        onContextMenu={e => handleContextMenu(e, inv)}
                                        className={`border-b border-zinc-100 dark:border-[#1a1a1c] hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] dark:bg-[#0a0a0b]/50 transition-colors cursor-pointer ${selected.has(inv.id) ? 'bg-accent/5 dark:bg-accent/5' : ''}`}
                                        onClick={() => navigate(`/invoices/new?edit=${inv.invoice_number}`)}
                                    >
                                        <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                                            <button onClick={() => toggleSelect(inv.id)} className="text-zinc-400 dark:text-[#a1a1aa] hover:text-accent">
                                                {selected.has(inv.id) ? <CheckSquare size={16} className="text-accent" /> : <Square size={16} />}
                                            </button>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-2 text-zinc-900 dark:text-[#e4e4e7] font-bold text-xs">
                                                <FileText size={14} className="text-zinc-400 dark:text-[#a1a1aa]" />
                                                {inv.invoice_number}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="text-zinc-700 dark:text-[#e4e4e7] font-bold text-xs">
                                                {inv.customer?.company_name || inv.customer?.name || 'Walk-in Customer'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-1.5 text-zinc-500 dark:text-[#71717a] font-medium text-xs">
                                                <Calendar size={12} />
                                                {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString() : new Date(inv.created_at).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="text-zinc-500 dark:text-[#71717a] font-medium text-xs">
                                                {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-1 text-zinc-900 dark:text-[#e4e4e7] font-bold text-xs">
                                                <DollarSign size={12} className="text-zinc-400 dark:text-[#a1a1aa]" />
                                                ${inv.total.toFixed(2)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            {getStatusBadge(inv.status)}
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <button
                                                onClick={e => { e.stopPropagation(); handleContextMenu(e, inv); }}
                                                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-[#1a1a1c] text-zinc-400 dark:text-[#a1a1aa]"
                                            >
                                                <MoreHorizontal size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    ref={contextRef}
                    className="fixed z-50 w-48 bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#1f1f21] rounded-lg shadow-xl py-1 overflow-hidden"
                    style={{ left: Math.min(contextMenu.x, window.innerWidth - 200), top: Math.min(contextMenu.y, window.innerHeight - 250) }}
                >
                    {contextActions(contextMenu.invoice).map((item, i) => (
                        <button
                            key={i}
                            onClick={() => { item.action(); setContextMenu(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-[#e4e4e7] hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] transition-colors"
                        >
                            <item.icon size={14} className="text-zinc-400 dark:text-[#a1a1aa]" />
                            {item.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Email Modal */}
            <EmailPreviewModal
                open={!!emailModal}
                onClose={() => setEmailModal(null)}
                invoice={emailModal}
            />
        </div>
    );
}
