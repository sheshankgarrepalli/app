import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Loader2, AlertCircle, Search, FileText, Copy, ExternalLink, CheckCircle2 } from 'lucide-react';
import { fetchInvoices, generateShareLink, Invoice, extractError } from '../api/invoices';

function statusBadge(s: string) {
  if (s === 'Paid') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  if (s === 'Voided' || s === 'Refunded') return 'bg-red-500/10 text-red-400 border-red-500/30';
  if (s === 'Overdue') return 'bg-red-500/10 text-red-400 border-red-500/30';
  if (s === 'Partially_Paid') return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  if (s === 'Unpaid') return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30';
  return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30';
}

export default function InvoicesList() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchInvoices(q);
      setInvoices(data);
    } catch (err: any) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(search || undefined);
  };

  const handleShare = async (inv: Invoice) => {
    try {
      let token = inv.share_token;
      if (!token) {
        const result = await generateShareLink(inv.invoice_number);
        token = result.share_token;
      }
      const url = `${window.location.origin}/invoice/${token}`;
      await navigator.clipboard.writeText(url);
      setCopied(inv.invoice_number);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Invoices</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">Create, track, and share invoices</p>
        </div>
        <Link to="/admin/invoices/new" className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={16} />
          New Invoice
        </Link>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle size={16} />{error}
        </div>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="relative max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <input
          type="text"
          className="form-input pl-9"
          placeholder="Search by invoice #, customer, IMEI..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </form>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-[var(--text-tertiary)]" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="card text-center py-16">
          <FileText size={48} className="mx-auto text-[var(--text-tertiary)] mb-3 opacity-30" />
          <p className="text-[var(--text-secondary)] font-medium">No invoices found</p>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">Create your first invoice to get started</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider border-b border-[var(--border-primary)]">
                <th className="text-left p-3">Invoice #</th>
                <th className="text-left p-3">Customer</th>
                <th className="text-right p-3">Total</th>
                <th className="text-center p-3">Status</th>
                <th className="text-center p-3">Payment</th>
                <th className="text-right p-3">Date</th>
                <th className="text-center p-3 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-primary)]">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-[var(--bg-tertiary)]/50 transition-colors">
                  <td className="p-3">
                    <Link to={`/admin/invoices/${inv.invoice_number}`} className="font-mono text-xs font-semibold text-accent hover:underline">
                      {inv.invoice_number}
                    </Link>
                  </td>
                  <td className="p-3 text-[var(--text-secondary)] text-xs">
                    {inv.customer?.company_name || `${inv.customer?.first_name || ''} ${inv.customer?.last_name || ''}`.trim() || '—'}
                  </td>
                  <td className="p-3 text-right font-medium text-[var(--text-primary)] text-xs">
                    ${inv.total.toFixed(2)}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${statusBadge(inv.status)}`}>
                      {inv.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${statusBadge(inv.payment_status)}`}>
                      {inv.payment_status?.replace(/_/g, ' ') || '—'}
                    </span>
                  </td>
                  <td className="p-3 text-right text-[var(--text-tertiary)] text-xs">
                    {new Date(inv.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleShare(inv)}
                        className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-accent transition-colors"
                        title="Copy share link"
                      >
                        {copied === inv.invoice_number ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Link to={`/invoice/${inv.share_token}`} target="_blank" className="hidden" />}
                        <Copy size={14} />
                      </button>
                      {inv.share_token && (
                        <a
                          href={`/invoice/${inv.share_token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-accent transition-colors"
                          title="Open public view"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
