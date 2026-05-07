import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, AlertCircle, FileText, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { fetchPublicInvoice, Invoice } from '../api/invoices';

function statusIcon(s: string) {
  const cls = "w-4 h-4";
  if (s === 'Paid') return <CheckCircle2 className={`${cls} text-emerald-400`} />;
  if (s === 'Voided' || s === 'Refunded') return <XCircle className={`${cls} text-red-400`} />;
  if (s === 'Overdue') return <XCircle className={`${cls} text-red-400`} />;
  return <Clock className={`${cls} text-amber-400`} />;
}

function statusBadge(s: string) {
  if (s === 'Paid') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  if (s === 'Voided' || s === 'Refunded') return 'bg-red-500/10 text-red-400 border-red-500/30';
  if (s === 'Overdue') return 'bg-red-500/10 text-red-400 border-red-500/30';
  if (s === 'Partially_Paid') return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30';
}

export default function PublicInvoice() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareToken) return;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchPublicInvoice(shareToken);
        setInvoice(data);
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Invoice not found');
      } finally {
        setLoading(false);
      }
    })();
  }, [shareToken]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <Loader2 size={32} className="animate-spin text-[var(--text-tertiary)]" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto text-red-400 mb-3" />
          <p className="text-[var(--text-primary)] font-medium">{error || 'Invoice not found'}</p>
          <Link to="/" className="text-sm text-accent mt-2 inline-block">Back to Home</Link>
        </div>
      </div>
    );
  }

  const customerName = invoice.customer
    ? (invoice.customer.company_name || `${invoice.customer.first_name || ''} ${invoice.customer.last_name || ''}`.trim())
    : 'Walk-in Customer';

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText size={20} className="text-accent" />
            <h1 className="text-lg font-bold text-[var(--text-primary)]">Invoice #{invoice.invoice_number}</h1>
          </div>
          <div className={`px-2.5 py-1 rounded text-xs font-semibold border flex items-center gap-1.5 ${statusBadge(invoice.status)}`}>
            {statusIcon(invoice.status)}
            {invoice.status.replace(/_/g, ' ')}
          </div>
        </div>

        {/* Company & Customer Info */}
        <div className="card p-5 space-y-4">
          <div className="flex justify-between">
            <div>
              <p className="font-bold text-[var(--text-primary)]">AMAFAH Electronics</p>
              <p className="text-sm text-[var(--text-tertiary)]">Wholesale Electronics — Inventory & POS</p>
            </div>
            <div className="text-right text-sm text-[var(--text-tertiary)]">
              <p>Invoice #: <span className="text-[var(--text-primary)] font-mono font-medium">{invoice.invoice_number}</span></p>
              <p>Date: {new Date(invoice.created_at).toLocaleDateString()}</p>
              {invoice.due_date && <p>Due: {new Date(invoice.due_date).toLocaleDateString()}</p>}
            </div>
          </div>

          <hr className="border-[var(--border-primary)]" />

          <div>
            <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Bill To</p>
            <p className="font-medium text-[var(--text-primary)]">{customerName}</p>
            {invoice.customer?.phone && <p className="text-sm text-[var(--text-secondary)]">{invoice.customer.phone}</p>}
            {invoice.customer?.email && <p className="text-sm text-[var(--text-secondary)]">{invoice.customer.email}</p>}
            {invoice.customer?.shipping_address && <p className="text-sm text-[var(--text-secondary)]">{invoice.customer.shipping_address}</p>}
          </div>
        </div>

        {/* Line Items */}
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--bg-tertiary)] text-xs text-[var(--text-tertiary)] uppercase tracking-wider">
                <th className="text-left p-3">Description</th>
                <th className="text-center p-3 w-16">Qty</th>
                <th className="text-right p-3 w-24">Rate</th>
                <th className="text-right p-3 w-24">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-primary)]">
              {invoice.items.map((item, i) => (
                <tr key={i} className="text-[var(--text-primary)]">
                  <td className="p-3">
                    <div>{item.description || `${item.model_number} - IMEI: ${item.imei}`}</div>
                    {item.imei && <div className="text-[10px] text-[var(--text-tertiary)] font-mono mt-0.5">IMEI: {item.imei}</div>}
                  </td>
                  <td className="p-3 text-center">{item.quantity}</td>
                  <td className="p-3 text-right">${item.rate.toFixed(2)}</td>
                  <td className="p-3 text-right">${item.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="card p-5 ml-auto w-64 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-tertiary)]">Subtotal</span>
            <span className="text-[var(--text-primary)]">${invoice.subtotal.toFixed(2)}</span>
          </div>
          {invoice.discount_amount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-tertiary)]">Discount</span>
              <span className="text-red-400">-${invoice.discount_amount.toFixed(2)}</span>
            </div>
          )}
          {invoice.tax_amount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-tertiary)]">Tax</span>
              <span className="text-[var(--text-primary)]">${invoice.tax_amount.toFixed(2)}</span>
            </div>
          )}
          <hr className="border-[var(--border-primary)]" />
          <div className="flex justify-between font-bold text-[var(--text-primary)]">
            <span>Total</span>
            <span>${invoice.total.toFixed(2)}</span>
          </div>
          {invoice.payments.length > 0 && (
            <>
              <div className="flex justify-between text-sm text-emerald-400">
                <span>Paid</span>
                <span>${invoice.payments.reduce((s, p) => s + p.amount, 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium text-red-400">
                <span>Balance Due</span>
                <span>${(invoice.total - invoice.payments.reduce((s, p) => s + p.amount, 0)).toFixed(2)}</span>
              </div>
            </>
          )}
        </div>

        {/* Terms */}
        {invoice.invoice_terms && (
          <div className="card p-4">
            <p className="text-xs text-[var(--text-tertiary)] font-semibold uppercase tracking-wider mb-1">Terms</p>
            <p className="text-sm text-[var(--text-secondary)]">{invoice.invoice_terms}</p>
          </div>
        )}

        <div className="text-center text-xs text-[var(--text-tertiary)] pb-8">
          Powered by AMAFAH Electronics
        </div>
      </div>
    </div>
  );
}
