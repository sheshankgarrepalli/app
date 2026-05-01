import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Calendar, User, DollarSign, CheckCircle, XCircle,
    Plus, Send, ExternalLink, Loader2, Save, AlertCircle,
    ChevronLeft, Ban
} from 'lucide-react';
import EmailPreviewModal from '../components/EmailPreviewModal';

type EstimateLine = {
    id?: number;
    model_number: string;
    imei?: string;
    description: string;
    qty: number;
    rate: number;
    taxable: boolean;
    amount?: number;
};

type ProgressInvoice = {
    id: number;
    invoice_number: string;
    date: string;
    total: number;
    status: string;
};

type Estimate = {
    id: number;
    estimate_id: string;
    invoice_id?: string;
    date: string;
    valid_until: string;
    status: string;
    total: number;
    invoiced_total?: number;
    customer?: { name?: string; company_name?: string; email?: string };
    lines: EstimateLine[];
    progress_invoices?: ProgressInvoice[];
    notes?: string;
};

const EMPTY_ITEM: EstimateLine = {
    model_number: '',
    imei: '',
    description: '',
    qty: 1,
    rate: 0,
    taxable: true,
};

export default function EstimateWorkflow() {
    const { token } = useAuth();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [estimate, setEstimate] = useState<Estimate | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [showProgressForm, setShowProgressForm] = useState(false);
    const [progressItems, setProgressItems] = useState<EstimateLine[]>([{ ...EMPTY_ITEM }]);
    const [progressNotes, setProgressNotes] = useState('');
    const [progressPayment, setProgressPayment] = useState(0);
    const [progressMethod, setProgressMethod] = useState('Cash');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [emailModal, setEmailModal] = useState<any>(null);

    const fetchEstimate = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/pos/estimates/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEstimate(res.data);
        } catch (err) {
            console.error("Fetch estimate error:", err);
            setError("Failed to load estimate");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchEstimate(); }, [id]);

    const handleAccept = async () => {
        setActionLoading('accept');
        setError(null);
        try {
            await axios.post(`/api/pos/estimates/${estimate!.id}/accept`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchEstimate();
        } catch (e: any) {
            setError(e?.response?.data?.detail || 'Failed to accept estimate');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDecline = async () => {
        setActionLoading('decline');
        setError(null);
        try {
            await axios.post(`/api/pos/estimates/${estimate!.id}/decline`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchEstimate();
        } catch (e: any) {
            setError(e?.response?.data?.detail || 'Failed to decline estimate');
        } finally {
            setActionLoading(null);
        }
    };

    const handleMarkSent = async () => {
        setActionLoading('send');
        setError(null);
        try {
            await axios.post(`/api/pos/estimates/${estimate!.id}/mark-sent`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchEstimate();
        } catch (e: any) {
            setError(e?.response?.data?.detail || 'Failed to mark as sent');
        } finally {
            setActionLoading(null);
        }
    };

    const handleProgressInvoice = async () => {
        if (!estimate) return;
        setSaving(true);
        setError(null);
        try {
            await axios.post(
                `/api/pos/estimates/${estimate.id}/progress-invoice`,
                {
                    items: progressItems.map(i => ({
                        model_number: i.model_number,
                        imei: i.imei || undefined,
                        description: i.description,
                        qty: i.qty,
                        rate: i.rate,
                        taxable: i.taxable,
                    })),
                    payments: progressPayment > 0 ? [{ amount: progressPayment, method: progressMethod }] : [],
                    notes: progressNotes,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setShowProgressForm(false);
            setProgressItems([{ ...EMPTY_ITEM }]);
            setProgressPayment(0);
            setProgressNotes('');
            fetchEstimate();
        } catch (e: any) {
            setError(e?.response?.data?.detail || 'Failed to create progress invoice');
        } finally {
            setSaving(false);
        }
    };

    const addProgressLine = () => {
        setProgressItems(prev => [...prev, { ...EMPTY_ITEM }]);
    };

    const updateProgressLine = (idx: number, field: keyof EstimateLine, value: any) => {
        setProgressItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
    };

    const removeProgressLine = (idx: number) => {
        if (progressItems.length <= 1) return;
        setProgressItems(prev => prev.filter((_, i) => i !== idx));
    };

    const progressTotal = progressItems.reduce((sum, i) => sum + i.qty * i.rate, 0);
    const estimateTotal = estimate?.total || 0;
    const invoicedTotal = estimate?.invoiced_total || 0;
    const remaining = estimateTotal - invoicedTotal;
    const isFullyInvoiced = remaining <= 0;

    const statusBadge = (status: string) => {
        const map: Record<string, string> = {
            Draft: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/10 dark:text-zinc-400',
            Sent: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
            Accepted: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
            Declined: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
            Converted: 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400',
            Void: 'bg-zinc-50 text-zinc-400 dark:bg-zinc-500/10 dark:text-zinc-500',
        };
        return (
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${map[status] || map['Draft']}`}>
                {status}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center bg-zinc-50 dark:bg-[#0a0a0b]">
                <div className="text-zinc-400 dark:text-[#a1a1aa] animate-pulse text-xs font-medium">Loading estimate...</div>
            </div>
        );
    }

    if (!estimate) {
        return (
            <div className="flex h-full items-center justify-center bg-zinc-50 dark:bg-[#0a0a0b]">
                <div className="text-center">
                    <AlertCircle size={32} className="mx-auto text-zinc-300 dark:text-[#52525b] mb-3" />
                    <p className="text-xs font-semibold text-zinc-500 dark:text-[#71717a]">Estimate not found</p>
                    <button onClick={() => navigate('/invoices')} className="mt-3 text-xs text-accent font-semibold hover:underline">Back to Invoices</button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-zinc-50 dark:bg-[#0a0a0b]">
            {/* Header */}
            <header className="p-6 bg-white dark:bg-[#141416] border-b border-zinc-200 dark:border-[#1f1f21]">
                <div className="flex items-center gap-3 mb-3">
                    <button onClick={() => navigate('/invoices')} className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-[#1a1a1c] text-zinc-400 dark:text-[#a1a1aa]">
                        <ChevronLeft size={18} />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-lg font-bold text-zinc-900 dark:text-[#e4e4e7]">
                                Estimate {estimate.estimate_id || estimate.invoice_id}
                            </h1>
                            {statusBadge(estimate.status)}
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-[#71717a] mt-1">
                            {estimate.customer?.company_name || estimate.customer?.name || 'No customer'}
                        </p>
                    </div>
                </div>

                {error && (
                    <div className="px-3 py-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-md text-xs text-red-700 dark:text-red-400 mb-3">{error}</div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                    {estimate.status === 'Draft' && (
                        <>
                            <button onClick={handleMarkSent} disabled={actionLoading === 'send'}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-accent text-white rounded-md hover:brightness-110 disabled:opacity-50">
                                {actionLoading === 'send' ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                Mark as Sent
                            </button>
                            <button onClick={() => setEmailModal(estimate)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-white dark:bg-[#0a0a0b] border border-zinc-200 dark:border-[#1f1f21] rounded-md hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] text-zinc-700 dark:text-[#e4e4e7]">
                                <Send size={12} /> Email
                            </button>
                        </>
                    )}
                    {estimate.status === 'Sent' && (
                        <>
                            <button onClick={handleAccept} disabled={actionLoading === 'accept'}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-emerald-600 text-white rounded-md hover:brightness-110 disabled:opacity-50">
                                {actionLoading === 'accept' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                                Accept
                            </button>
                            <button onClick={handleDecline} disabled={actionLoading === 'decline'}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-md hover:bg-red-100 dark:hover:bg-red-500/20 disabled:opacity-50">
                                <XCircle size={12} /> Decline
                            </button>
                        </>
                    )}
                    {(estimate.status === 'Accepted' || estimate.status === 'Sent') && !isFullyInvoiced && (
                        <button onClick={() => setShowProgressForm(!showProgressForm)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-accent text-white rounded-md hover:brightness-110">
                            <Plus size={12} /> Progress Invoice
                        </button>
                    )}
                    <button onClick={() => window.open(`/api/pos/estimates/${estimate.id}/pdf`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-white dark:bg-[#0a0a0b] border border-zinc-200 dark:border-[#1f1f21] rounded-md hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] text-zinc-700 dark:text-[#e4e4e7]">
                        <ExternalLink size={12} /> View PDF
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-auto p-6 space-y-6">
                {/* Meta info */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#1f1f21] rounded-lg p-4">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-[#71717a] mb-2">
                            <Calendar size={12} /> Dates
                        </div>
                        <div className="space-y-1 text-xs text-zinc-700 dark:text-[#e4e4e7]">
                            <p>Created: {new Date(estimate.date).toLocaleDateString()}</p>
                            <p>Valid Until: {new Date(estimate.valid_until).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#1f1f21] rounded-lg p-4">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-[#71717a] mb-2">
                            <DollarSign size={12} /> Totals
                        </div>
                        <div className="space-y-1 text-xs">
                            <p className="text-zinc-700 dark:text-[#e4e4e7]">Estimate: <span className="font-bold">${estimateTotal.toFixed(2)}</span></p>
                            <p className="text-zinc-700 dark:text-[#e4e4e7]">Invoiced: <span className="font-bold">${invoicedTotal.toFixed(2)}</span></p>
                            <p className={remaining > 0 ? 'text-accent font-bold' : 'text-emerald-600 dark:text-emerald-400'}>
                                Remaining: ${remaining.toFixed(2)}
                                {isFullyInvoiced && ' (Fully invoiced)'}
                            </p>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#1f1f21] rounded-lg p-4">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-[#71717a] mb-2">
                            <User size={12} /> Customer
                        </div>
                        <div className="text-xs text-zinc-700 dark:text-[#e4e4e7]">
                            <p className="font-bold">{estimate.customer?.company_name || estimate.customer?.name || 'N/A'}</p>
                            {estimate.customer?.email && <p className="text-zinc-500 dark:text-[#71717a]">{estimate.customer.email}</p>}
                        </div>
                    </div>
                </div>

                {/* Line items */}
                <div className="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#1f1f21] rounded-lg overflow-hidden">
                    <div className="px-5 py-3 border-b border-zinc-200 dark:border-[#1f1f21]">
                        <h2 className="text-xs font-bold text-zinc-700 dark:text-[#e4e4e7] uppercase tracking-wider">Estimate Details</h2>
                    </div>
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-[#71717a] border-b border-zinc-200 dark:border-[#1f1f21]">
                                <th className="px-5 py-2">#</th>
                                <th className="px-5 py-2">Product/Service</th>
                                <th className="px-5 py-2">Description</th>
                                <th className="px-5 py-2 text-right">Qty</th>
                                <th className="px-5 py-2 text-right">Rate</th>
                                <th className="px-5 py-2 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {estimate.lines.map((line, idx) => {
                                const amt = (line.amount || line.qty * line.rate);
                                return (
                                    <tr key={idx} className="border-b border-zinc-100 dark:border-[#1a1a1c] text-xs">
                                        <td className="px-5 py-3 text-zinc-400 dark:text-[#a1a1aa]">{idx + 1}</td>
                                        <td className="px-5 py-3 text-zinc-700 dark:text-[#e4e4e7] font-medium">{line.model_number || '—'}</td>
                                        <td className="px-5 py-3 text-zinc-500 dark:text-[#71717a]">{line.description}</td>
                                        <td className="px-5 py-3 text-right text-zinc-700 dark:text-[#e4e4e7]">{line.qty}</td>
                                        <td className="px-5 py-3 text-right text-zinc-700 dark:text-[#e4e4e7]">${line.rate.toFixed(2)}</td>
                                        <td className="px-5 py-3 text-right text-zinc-900 dark:text-[#e4e4e7] font-bold">${amt.toFixed(2)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="bg-zinc-50 dark:bg-[#0a0a0b]">
                                <td colSpan={5} className="px-5 py-3 text-right text-xs font-bold text-zinc-700 dark:text-[#e4e4e7]">Total</td>
                                <td className="px-5 py-3 text-right text-xs font-bold text-accent">${estimateTotal.toFixed(2)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Progress invoices */}
                {estimate.progress_invoices && estimate.progress_invoices.length > 0 && (
                    <div className="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#1f1f21] rounded-lg overflow-hidden">
                        <div className="px-5 py-3 border-b border-zinc-200 dark:border-[#1f1f21]">
                            <h2 className="text-xs font-bold text-zinc-700 dark:text-[#e4e4e7] uppercase tracking-wider">Progress Invoices</h2>
                        </div>
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-[#71717a] border-b border-zinc-200 dark:border-[#1f1f21]">
                                    <th className="px-5 py-2">Invoice #</th>
                                    <th className="px-5 py-2">Date</th>
                                    <th className="px-5 py-2 text-right">Amount</th>
                                    <th className="px-5 py-2">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {estimate.progress_invoices.map(inv => (
                                    <tr key={inv.id} className="border-b border-zinc-100 dark:border-[#1a1a1c] text-xs hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] cursor-pointer"
                                        onClick={() => navigate(`/invoices/new?edit=${inv.invoice_number}`)}>
                                        <td className="px-5 py-3 text-accent font-bold">{inv.invoice_number}</td>
                                        <td className="px-5 py-3 text-zinc-500 dark:text-[#71717a]">{new Date(inv.date).toLocaleDateString()}</td>
                                        <td className="px-5 py-3 text-right text-zinc-900 dark:text-[#e4e4e7] font-bold">${inv.total.toFixed(2)}</td>
                                        <td className="px-5 py-3">{statusBadge(inv.status)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Progress Invoice Form */}
                {showProgressForm && (
                    <div className="bg-white dark:bg-[#141416] border border-accent/30 rounded-lg p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold text-zinc-900 dark:text-[#e4e4e7]">Create Progress Invoice</h2>
                            <button onClick={() => setShowProgressForm(false)} className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-[#1a1a1c] text-zinc-400 dark:text-[#a1a1aa]">
                                <XCircle size={16} />
                            </button>
                        </div>

                        <div className="text-xs text-zinc-500 dark:text-[#71717a]">
                            Progress: ${invoicedTotal.toFixed(2)} invoiced of ${estimateTotal.toFixed(2)} — ${remaining.toFixed(2)} remaining
                        </div>

                        {/* Line items editor */}
                        <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-[#71717a] mb-2">Items for this invoice</label>
                            <div className="space-y-2">
                                {progressItems.map((item, idx) => (
                                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                        <input
                                            type="text"
                                            placeholder="Model #"
                                            value={item.model_number}
                                            onChange={e => updateProgressLine(idx, 'model_number', e.target.value)}
                                            className="col-span-2 px-2 py-1.5 text-[11px] bg-zinc-50 dark:bg-[#0a0a0b] border border-zinc-200 dark:border-[#1f1f21] rounded text-zinc-900 dark:text-[#e4e4e7] focus:outline-none focus:ring-1 focus:ring-accent/50"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Description"
                                            value={item.description}
                                            onChange={e => updateProgressLine(idx, 'description', e.target.value)}
                                            className="col-span-4 px-2 py-1.5 text-[11px] bg-zinc-50 dark:bg-[#0a0a0b] border border-zinc-200 dark:border-[#1f1f21] rounded text-zinc-900 dark:text-[#e4e4e7] focus:outline-none focus:ring-1 focus:ring-accent/50"
                                        />
                                        <input
                                            type="number"
                                            placeholder="Qty"
                                            value={item.qty}
                                            onChange={e => updateProgressLine(idx, 'qty', parseInt(e.target.value) || 0)}
                                            className="col-span-1 px-2 py-1.5 text-[11px] bg-zinc-50 dark:bg-[#0a0a0b] border border-zinc-200 dark:border-[#1f1f21] rounded text-zinc-900 dark:text-[#e4e4e7] focus:outline-none focus:ring-1 focus:ring-accent/50 text-right"
                                        />
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="Rate"
                                            value={item.rate}
                                            onChange={e => updateProgressLine(idx, 'rate', parseFloat(e.target.value) || 0)}
                                            className="col-span-2 px-2 py-1.5 text-[11px] bg-zinc-50 dark:bg-[#0a0a0b] border border-zinc-200 dark:border-[#1f1f21] rounded text-zinc-900 dark:text-[#e4e4e7] focus:outline-none focus:ring-1 focus:ring-accent/50 text-right"
                                        />
                                        <div className="col-span-1 text-right text-[11px] font-bold text-zinc-700 dark:text-[#e4e4e7]">
                                            ${(item.qty * item.rate).toFixed(2)}
                                        </div>
                                        <button
                                            onClick={() => removeProgressLine(idx)}
                                            className="col-span-1 p-1 rounded text-zinc-400 dark:text-[#a1a1aa] hover:text-red-500"
                                        >
                                            <Ban size={12} />
                                        </button>
                                    </div>
                                ))}
                                <button onClick={addProgressLine} className="text-[11px] text-accent font-semibold hover:underline">
                                    + Add line
                                </button>
                            </div>
                        </div>

                        {/* Payment */}
                        <div className="flex items-center gap-3">
                            <div>
                                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-[#71717a] mb-1">Payment</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={progressPayment}
                                    onChange={e => setProgressPayment(parseFloat(e.target.value) || 0)}
                                    className="w-28 px-2 py-1.5 text-xs bg-zinc-50 dark:bg-[#0a0a0b] border border-zinc-200 dark:border-[#1f1f21] rounded text-zinc-900 dark:text-[#e4e4e7]"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-[#71717a] mb-1">Method</label>
                                <select value={progressMethod} onChange={e => setProgressMethod(e.target.value)}
                                    className="px-2 py-1.5 text-xs bg-zinc-50 dark:bg-[#0a0a0b] border border-zinc-200 dark:border-[#1f1f21] rounded text-zinc-900 dark:text-[#e4e4e7]">
                                    <option>Cash</option><option>Card</option><option>Bank Transfer</option><option>Check</option>
                                </select>
                            </div>
                            <div className="pt-5 text-xs text-zinc-500 dark:text-[#71717a]">
                                Invoice total: <span className="font-bold text-zinc-900 dark:text-[#e4e4e7]">${progressTotal.toFixed(2)}</span>
                                {progressTotal > remaining && (
                                    <span className="text-red-500 ml-2">Exceeds remaining ${remaining.toFixed(2)}!</span>
                                )}
                            </div>
                        </div>

                        {/* Notes */}
                        <div>
                            <textarea
                                value={progressNotes}
                                onChange={e => setProgressNotes(e.target.value)}
                                placeholder="Notes for this progress invoice..."
                                rows={2}
                                className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-[#0a0a0b] border border-zinc-200 dark:border-[#1f1f21] rounded-md text-zinc-900 dark:text-[#e4e4e7] resize-none"
                            />
                        </div>

                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowProgressForm(false)}
                                className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-[#a1a1aa] rounded-md hover:bg-zinc-100 dark:hover:bg-[#1a1a1c]">
                                Cancel
                            </button>
                            <button
                                onClick={handleProgressInvoice}
                                disabled={saving || progressTotal <= 0 || progressTotal > remaining}
                                className="flex items-center gap-2 px-5 py-2 bg-accent text-white text-xs font-semibold rounded-md hover:brightness-110 disabled:opacity-50 transition-all"
                            >
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                Create Progress Invoice
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <EmailPreviewModal
                open={!!emailModal}
                onClose={() => setEmailModal(null)}
                invoice={emailModal}
            />
        </div>
    );
}
