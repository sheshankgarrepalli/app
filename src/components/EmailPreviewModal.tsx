import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { X, Send, Mail, ChevronDown, Paperclip, Loader2 } from 'lucide-react';

type Props = {
    open: boolean;
    onClose: () => void;
    invoice: {
        invoice_number: string;
        customer?: { name?: string; email?: string; company_name?: string };
        total: number;
        due_date?: string;
        status?: string;
    } | null;
};

export default function EmailPreviewModal({ open, onClose, invoice }: Props) {
    const { token } = useAuth();
    const [to, setTo] = useState('');
    const [showCC, setShowCC] = useState(false);
    const [cc, setCc] = useState('');
    const [bcc, setBcc] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open || !invoice) return;

        const name = invoice.customer?.company_name || invoice.customer?.name || 'Customer';
        setTo(invoice.customer?.email || '');
        setSubject(`Invoice ${invoice.invoice_number} from AMAFAH Electronics`);
        setBody(`Dear ${name},\n\nPlease find your invoice ${invoice.invoice_number} attached.\n\nAmount Due: $${invoice.total.toFixed(2)}\nDue Date: ${invoice.due_date || 'N/A'}\n\nThank you for your business.\n\nAMAFAH Electronics`);
        setMessage('');
        setError(null);
        setSent(false);
        setShowCC(false);
        setCc('');
        setBcc('');

        // Load PDF preview
        if (invoice.invoice_number) {
            const url = `/api/pos/invoices/${invoice.invoice_number}/pdf`;
            setPdfUrl(url);
        }
    }, [open, invoice]);

    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 100);
    }, [open]);

    const handleSend = async () => {
        if (!to || !invoice) return;
        setSending(true);
        setError(null);
        try {
            await axios.post(
                `/api/pos/invoices/${invoice.invoice_number}/send`,
                { to, cc: cc || undefined, bcc: bcc || undefined, subject, body, message },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSent(true);
            setTimeout(() => {
                onClose();
                setSent(false);
            }, 1500);
        } catch (e: any) {
            setError(e?.response?.data?.detail || 'Failed to send email');
        } finally {
            setSending(false);
        }
    };

    if (!open || !invoice) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />
            <div className="relative bg-white dark:bg-[#141416] rounded-xl shadow-2xl border border-zinc-200 dark:border-[#1f1f21] w-[960px] max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-[#1f1f21]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                            <Mail size={18} className="text-accent" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-zinc-900 dark:text-[#e4e4e7]">Send Invoice</h2>
                            <p className="text-[11px] text-zinc-500 dark:text-[#71717a]">{invoice.invoice_number}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-[#1a1a1c] text-zinc-400 dark:text-[#a1a1aa]">
                        <X size={18} />
                    </button>
                </div>

                {sent && (
                    <div className="mx-6 mt-4 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        Invoice sent successfully to {to}
                    </div>
                )}
                {error && (
                    <div className="mx-6 mt-4 px-4 py-2.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg text-xs font-medium text-red-700 dark:text-red-400">
                        {error}
                    </div>
                )}

                {/* Body: two panels */}
                <div className="flex-1 flex overflow-hidden min-h-0">
                    {/* Left: Email Form */}
                    <div className="w-[480px] flex-shrink-0 p-6 space-y-4 overflow-y-auto border-r border-zinc-200 dark:border-[#1f1f21]">
                        <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-[#71717a] mb-1.5">To</label>
                            <input
                                ref={inputRef}
                                type="email"
                                value={to}
                                onChange={e => setTo(e.target.value)}
                                placeholder="customer@example.com"
                                className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-[#0a0a0b] border border-zinc-200 dark:border-[#1f1f21] rounded-md text-zinc-900 dark:text-[#e4e4e7] focus:outline-none focus:ring-2 focus:ring-accent/50"
                            />
                        </div>

                        {!showCC && (
                            <button onClick={() => setShowCC(true)} className="flex items-center gap-1 text-[11px] text-zinc-400 dark:text-[#a1a1aa] hover:text-zinc-600 dark:hover:text-[#e4e4e7] font-medium">
                                <ChevronDown size={12} /> CC / BCC
                            </button>
                        )}

                        {showCC && (
                            <>
                                <div>
                                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-[#71717a] mb-1.5">CC</label>
                                    <input
                                        type="text"
                                        value={cc}
                                        onChange={e => setCc(e.target.value)}
                                        placeholder="cc@example.com"
                                        className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-[#0a0a0b] border border-zinc-200 dark:border-[#1f1f21] rounded-md text-zinc-900 dark:text-[#e4e4e7] focus:outline-none focus:ring-2 focus:ring-accent/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-[#71717a] mb-1.5">BCC</label>
                                    <input
                                        type="text"
                                        value={bcc}
                                        onChange={e => setBcc(e.target.value)}
                                        placeholder="bcc@example.com"
                                        className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-[#0a0a0b] border border-zinc-200 dark:border-[#1f1f21] rounded-md text-zinc-900 dark:text-[#e4e4e7] focus:outline-none focus:ring-2 focus:ring-accent/50"
                                    />
                                </div>
                            </>
                        )}

                        <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-[#71717a] mb-1.5">Subject</label>
                            <input
                                type="text"
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                                className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-[#0a0a0b] border border-zinc-200 dark:border-[#1f1f21] rounded-md text-zinc-900 dark:text-[#e4e4e7] focus:outline-none focus:ring-2 focus:ring-accent/50"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-[#71717a] mb-1.5">Message</label>
                            <textarea
                                value={body}
                                onChange={e => setBody(e.target.value)}
                                rows={10}
                                className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-[#0a0a0b] border border-zinc-200 dark:border-[#1f1f21] rounded-md text-zinc-900 dark:text-[#e4e4e7] focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none font-mono"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-[#71717a] mb-1.5">Additional note (appears on PDF)</label>
                            <input
                                type="text"
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                placeholder="Optional message for the invoice PDF"
                                className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-[#0a0a0b] border border-zinc-200 dark:border-[#1f1f21] rounded-md text-zinc-900 dark:text-[#e4e4e7] focus:outline-none focus:ring-2 focus:ring-accent/50"
                            />
                        </div>
                    </div>

                    {/* Right: PDF Preview */}
                    <div className="flex-1 flex flex-col bg-zinc-50 dark:bg-[#0a0a0b] min-w-0">
                        <div className="px-4 py-3 border-b border-zinc-200 dark:border-[#1f1f21] flex items-center gap-2">
                            <Paperclip size={14} className="text-zinc-400 dark:text-[#a1a1aa]" />
                            <span className="text-[11px] font-semibold text-zinc-500 dark:text-[#71717a] uppercase tracking-wider">Attachment: {invoice.invoice_number}.pdf</span>
                        </div>
                        <div className="flex-1 flex items-center justify-center p-4">
                            {pdfUrl ? (
                                <iframe
                                    src={pdfUrl}
                                    className="w-full h-full rounded-md border border-zinc-200 dark:border-[#1f1f21] bg-white"
                                    title="PDF Preview"
                                />
                            ) : (
                                <div className="text-center text-zinc-400 dark:text-[#a1a1aa]">
                                    <FileTextPlaceholder />
                                    <p className="text-xs font-medium mt-3">PDF preview loading...</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 dark:border-[#1f1f21] bg-zinc-50 dark:bg-[#0c0c0e]">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-[#a1a1aa] hover:text-zinc-900 dark:hover:text-[#e4e4e7] rounded-md hover:bg-zinc-200 dark:hover:bg-[#1a1a1c] transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={sending || !to}
                        className="flex items-center gap-2 px-5 py-2 bg-accent text-white text-xs font-semibold rounded-md hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {sending ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <Send size={14} />
                        )}
                        {sending ? 'Sending...' : 'Send'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function FileTextPlaceholder() {
    return (
        <svg width="64" height="80" viewBox="0 0 64 80" fill="none" className="opacity-30">
            <rect x="4" y="4" width="56" height="72" rx="4" stroke="currentColor" strokeWidth="2" />
            <line x1="16" y1="20" x2="48" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="16" y1="30" x2="48" y2="30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="16" y1="40" x2="40" y2="40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="16" y1="50" x2="44" y2="50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}
