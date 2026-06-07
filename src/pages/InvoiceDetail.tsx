import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/api';
import { Loader2, AlertCircle, ArrowLeft, Copy, ExternalLink, CheckCircle2, Ban, Clock, Pencil, Printer } from 'lucide-react';
import { fetchInvoice, fetchInvoiceTimeline, generateShareLink, voidInvoice, Invoice, InvoiceTimeline, extractError } from '../api/invoices';

function statusBadge(s: string) {
  if (s === 'Paid') return 'badge-success';
  if (s === 'Draft') return 'badge-warning';
  if (s === 'Voided' || s === 'Refunded') return 'badge-error';
  if (s === 'Overdue') return 'badge-error';
  if (s === 'Partially_Paid') return 'badge-warning';
  if (s === 'Unpaid') return 'badge-neutral';
  if (s === 'Sent') return 'badge-info';
  if (s === 'Viewed') return 'badge-purple';
  return 'badge-neutral';
}

function paymentStatusBadge(s: string) {
  if (s === 'Paid') return 'badge-success';
  if (s === 'Voided') return 'badge-error';
  if (s === 'Partially_Paid') return 'badge-warning';
  if (s === 'Unpaid') return 'badge-neutral';
  return 'badge-neutral';
}

const actionLabels: Record<string, string> = {
  void_invoice: 'Invoice Voided',
  payment_received: 'Payment Received',
  created_invoice: 'Invoice Created',
  create_invoice: 'Invoice Created',
  invoice_sent: 'Invoice Sent',
  invoice_viewed: 'Invoice Viewed',
};

export default function InvoiceDetail() {
  const { invoiceNumber } = useParams<{ invoiceNumber: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [timeline, setTimeline] = useState<InvoiceTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voiding, setVoiding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!invoiceNumber) return;
    setLoading(true);
    setError(null);
    try {
      const [inv, tl] = await Promise.all([
        fetchInvoice(invoiceNumber),
        fetchInvoiceTimeline(invoiceNumber),
      ]);
      setInvoice(inv);
      setTimeline(tl);
      setShareToken(inv.share_token || null);
    } catch (err: any) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [invoiceNumber]);

  useEffect(() => { load(); }, [load]);

  const handleShare = async () => {
    if (!invoice) return;
    try {
      let token = shareToken;
      if (!token) {
        const result = await generateShareLink(invoice.invoice_number);
        token = result.share_token;
        setShareToken(token);
      }
      const url = `${window.location.origin}/invoice/${token}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const handleVoid = async () => {
    if (!invoice || !confirm('Void this invoice? Reserved devices will be released back to Sellable.')) return;
    setVoiding(true);
    try {
      await voidInvoice(invoice.invoice_number);
      await load();
    } catch (err: any) {
      setError(extractError(err));
    } finally {
      setVoiding(false);
    }
  };

  const handleRefund = async () => {
    if (!invoice || !confirm(`Refund entire invoice ${invoice.invoice_number}? All devices will be returned to inventory and status set to Refunded.`)) return;
    setError(null);
    try {
      await api.post(`/api/pos/invoices/${invoice.invoice_number}/refund`);
      await load();
    } catch (err: any) {
      setError(extractError(err));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={28} className="animate-spin text-[var(--text-tertiary)]" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="card text-center py-16">
        <p className="text-[var(--text-secondary)] font-medium">Invoice not found</p>
        <Link to="/admin/invoices" className="text-accent text-sm mt-2 inline-block">Back to invoices</Link>
      </div>
    );
  }

  const isDraft = invoice.status === 'Draft';
  const isVoided = invoice.status === 'Voided';
  const isRefunded = invoice.status === 'Refunded';
  const canVoid = isDraft && !isVoided;
  const canRefund = ['Paid', 'Partially_Paid', 'Unpaid'].includes(invoice.status) && !isRefunded;
  const totalPaid = invoice.payments?.reduce((s, p) => s + p.amount, 0) || 0;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-[var(--text-tertiary)] hover:text-[var(--text)]">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[var(--text)] font-mono">{invoice.invoice_number}</h1>
            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${statusBadge(invoice.status)}`}>
              {invoice.status.replace(/_/g, ' ')}
            </span>
            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${paymentStatusBadge(invoice.payment_status)}`}>
              {invoice.payment_status.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
            Created {new Date(invoice.created_at).toLocaleDateString()} at {new Date(invoice.created_at).toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/admin/invoices/${invoice.invoice_number}/edit`}
            className="btn-secondary flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
          >
            <Pencil size={14} /> Edit
          </Link>
          <button
            onClick={async () => {
              let token = shareToken;
              if (!token) {
                const res = await generateShareLink(invoice.invoice_number);
                token = res.share_token;
                setShareToken(token);
              }
              window.open(`/invoice/${token}?print=1`, '_blank');
            }}
            className="btn-secondary flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
          >
            <Printer size={14} /> Print
          </button>
          <button
            onClick={handleShare}
            className="btn-secondary flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
            title="Copy share link"
          >
            {copied ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Share'}
          </button>
          {shareToken && (
            <a
              href={`/invoice/${shareToken}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
            >
              <ExternalLink size={14} /> View
            </a>
          )}
          {canVoid && (
            <button
              onClick={handleVoid}
              disabled={voiding}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 disabled:opacity-50"
            >
              {voiding ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
              Void Draft
            </button>
          )}
          {canRefund && (
            <button
              onClick={handleRefund}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/30 hover:bg-orange-500/20"
            >
              Refund
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle size={16} />{error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-5">
        {/* Invoice Details */}
        <div className="col-span-2 space-y-5">
          {/* Customer */}
          <div className="card p-4">
            <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">Bill To</p>
            {invoice.customer ? (
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">
                  {invoice.customer.company_name || `${invoice.customer.first_name || ''} ${invoice.customer.last_name || ''}`.trim() || '—'}
                </p>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                  {invoice.customer.phone}{invoice.customer.email ? ` · ${invoice.customer.email}` : ''}
                </p>
                {invoice.customer.shipping_address && (
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{invoice.customer.shipping_address}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-tertiary)]">No customer assigned</p>
            )}
          </div>

          {/* Line Items */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 bg-[var(--bg-muted)]">
              <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Line Items</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider border-b border-[var(--border)]">
                  <th className="text-left p-3">Description</th>
                  <th className="text-center p-3">Qty</th>
                  <th className="text-right p-3">Rate</th>
                  <th className="text-right p-3">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-primary)]">
                {invoice.items?.map((item) => (
                  <tr key={item.id}>
                    <td className="p-3">
                      <p className="text-xs text-[var(--text)]">{item.description || '—'}</p>
                      {(item.imei || item.model_number) && (
                        <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                          {item.imei ? `IMEI: ${item.imei}` : ''}{item.imei && item.model_number ? ' · ' : ''}{item.model_number ? `Model: ${item.model_number}` : ''}
                        </p>
                      )}
                    </td>
                    <td className="p-3 text-center text-xs">{item.quantity}</td>
                    <td className="p-3 text-right text-xs font-mono">${item.rate.toFixed(2)}</td>
                    <td className="p-3 text-right text-xs font-mono">${item.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Payments */}
          {invoice.payments && invoice.payments.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 bg-[var(--bg-muted)]">
                <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Payments</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider border-b border-[var(--border)]">
                    <th className="text-left p-3">Method</th>
                    <th className="text-right p-3">Amount</th>
                    <th className="text-left p-3">Reference</th>
                    <th className="text-right p-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-primary)]">
                  {invoice.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="p-3 text-xs">{p.payment_method}</td>
                      <td className="p-3 text-right text-xs font-mono">${p.amount.toFixed(2)}</td>
                      <td className="p-3 text-xs text-[var(--text-tertiary)]">{p.reference_id || '—'}</td>
                      <td className="p-3 text-right text-xs text-[var(--text-tertiary)]">{new Date(p.timestamp).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Internal Notes */}
          {invoice.internal_notes && (
            <div className="card p-4">
              <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Internal Notes</p>
              <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">{invoice.internal_notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar: Summary + Timeline */}
        <div className="space-y-5">
          {/* Summary */}
          <div className="card p-4 space-y-2">
            <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Summary</p>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-tertiary)]">Subtotal</span>
              <span className="text-[var(--text)]">${invoice.subtotal.toFixed(2)}</span>
            </div>
            {invoice.discount_total > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-tertiary)]">Discount ({invoice.discount_percent}%)</span>
                <span className="text-red-400">-${invoice.discount_total.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-tertiary)]">Tax ({invoice.tax_percent}%)</span>
              <span className="text-[var(--text)]">${invoice.tax_amount.toFixed(2)}</span>
            </div>
            <hr className="border-[var(--border)]" />
            <div className="flex justify-between font-bold text-sm text-[var(--text)]">
              <span>Total</span>
              <span>${invoice.total.toFixed(2)}</span>
            </div>
            {totalPaid > 0 && (
              <>
                <div className="flex justify-between text-xs text-emerald-400">
                  <span>Paid</span>
                  <span>${totalPaid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-[var(--text-tertiary)]">Balance</span>
                  <span className={invoice.total - totalPaid > 0.01 ? 'text-red-400' : 'text-emerald-400'}>
                    ${(invoice.total - totalPaid).toFixed(2)}
                  </span>
                </div>
              </>
            )}
            <hr className="border-[var(--border)]" />
            {invoice.fulfillment_method && (
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-tertiary)]">Fulfillment</span>
                <span className="text-[var(--text)]">{invoice.fulfillment_method}</span>
              </div>
            )}
            {invoice.invoice_terms && (
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-tertiary)]">Terms</span>
                <span className="text-[var(--text)]">{invoice.invoice_terms}</span>
              </div>
            )}
          </div>

          {/* Activity Timeline */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className="text-[var(--text-tertiary)]" />
              <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Activity</p>
            </div>
            {timeline?.events && timeline.events.length > 0 ? (
              <div className="space-y-0 relative">
                <div className="absolute left-[9px] top-2 bottom-2 w-px bg-[var(--border-primary)]" />
                {timeline.events.map((event, i) => (
                  <div key={i} className="relative pl-6 pb-3 last:pb-0">
                    <div className="absolute left-[5px] top-1.5 w-2 h-2 rounded-full bg-[var(--border-primary)]" />
                    <p className="text-xs text-[var(--text)]">
                      {actionLabels[event.action] || event.action.replace(/_/g, ' ')}
                    </p>
                    {event.details && (
                      <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{event.details}</p>
                    )}
                    <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5 flex items-center gap-1">
                      <span>{event.actor}</span>
                      <span>·</span>
                      <span>{new Date(event.ts).toLocaleString()}</span>
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-tertiary)]">No activity recorded yet.</p>
            )}
          </div>

          {/* Messages */}
          {invoice.message_on_invoice && (
            <div className="card p-4">
              <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Message to Customer</p>
              <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">{invoice.message_on_invoice}</p>
            </div>
          )}
          {invoice.statement_memo && (
            <div className="card p-4">
              <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Statement Memo</p>
              <p className="text-xs text-[var(--text-secondary)]">{invoice.statement_memo}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
