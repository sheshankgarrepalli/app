import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Loader2, AlertCircle, Search, FileText, Copy, ExternalLink, CheckCircle2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { fetchInvoices, generateShareLink, Invoice, extractError } from '../api/invoices';
import { useLocationFilter } from '../context/LocationContext';

const PER_PAGE = 25;

type SortField = 'invoice_number' | 'customer' | 'total' | 'status' | 'payment_status' | 'date';
type SortDir = 'asc' | 'desc';

function statusBadge(s: string) {
  if (s === 'Paid') return 'badge-success';
  if (s === 'Voided' || s === 'Refunded') return 'badge-neutral';
  if (s === 'Overdue') return 'badge-error';
  if (s === 'Partially_Paid') return 'badge-warning';
  if (s === 'Unpaid') return 'badge-neutral';
  return 'badge-neutral';
}

export default function InvoicesList() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);
  const { selectedLocationId } = useLocationFilter();

  const load = useCallback(async (q?: string, locId?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchInvoices(q, locId);
      setInvoices(data);
      setPage(0);
    } catch (err: any) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(search || undefined, selectedLocationId); }, [load, selectedLocationId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(search || undefined);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'date' ? 'desc' : 'asc');
    }
    setPage(0);
  };

  const sorted = useMemo(() => {
    const sorted = [...invoices];
    sorted.sort((a, b) => {
      let va: any, vb: any;
      switch (sortField) {
        case 'invoice_number':
          va = a.invoice_number; vb = b.invoice_number;
          break;
        case 'customer':
          va = (a.customer?.company_name || `${a.customer?.first_name || ''} ${a.customer?.last_name || ''}`.trim() || '').toLowerCase();
          vb = (b.customer?.company_name || `${b.customer?.first_name || ''} ${b.customer?.last_name || ''}`.trim() || '').toLowerCase();
          break;
        case 'total':
          va = a.total; vb = b.total;
          break;
        case 'status':
          va = a.status; vb = b.status;
          break;
        case 'payment_status':
          va = a.payment_status || ''; vb = b.payment_status || '';
          break;
        case 'date':
          va = new Date(a.created_at).getTime(); vb = new Date(b.created_at).getTime();
          break;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [invoices, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const paged = sorted.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown size={12} className="opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
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
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="text-[13px] text-[var(--text-tertiary)] mt-1">Create, track, and share invoices</p>
        </div>
        <Link to="/admin/invoices/new" className="btn-primary">
          <Plus size={16} />
          New Invoice
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-lg flex items-center gap-3 text-[var(--destructive)] text-[13px] font-bold" style={{ background: '#FEE2E2' }}>
          <AlertCircle size={16} />{error}
        </div>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          type="text"
          className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md pl-10 pr-4 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--text-muted)]"
          style={{ fontFamily: 'var(--font-body)' }}
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
          <FileText size={48} className="mx-auto text-[var(--text-muted)] mb-3 opacity-40" />
          <h3 className="text-base font-bold text-[var(--text)]" style={{ fontFamily: 'var(--font-heading)' }}>No invoices found</h3>
          <p className="text-[13px] text-[var(--text-tertiary)] mt-1">Create your first invoice to get started</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th onClick={() => handleSort('invoice_number')} className="text-left px-[14px] py-[10px] text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] bg-[var(--bg-muted)] border-b border-[var(--border)] cursor-pointer select-none">
                    <div className="flex items-center gap-1">Invoice # <SortIcon field="invoice_number" /></div>
                  </th>
                  <th onClick={() => handleSort('customer')} className="text-left px-[14px] py-[10px] text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] bg-[var(--bg-muted)] border-b border-[var(--border)] cursor-pointer select-none">
                    <div className="flex items-center gap-1">Customer <SortIcon field="customer" /></div>
                  </th>
                  <th onClick={() => handleSort('total')} className="text-right px-[14px] py-[10px] text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] bg-[var(--bg-muted)] border-b border-[var(--border)] cursor-pointer select-none">
                    <div className="flex items-center justify-end gap-1">Total <SortIcon field="total" /></div>
                  </th>
                  <th onClick={() => handleSort('status')} className="text-left px-[14px] py-[10px] text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] bg-[var(--bg-muted)] border-b border-[var(--border)] cursor-pointer select-none">
                    <div className="flex items-center gap-1">Status <SortIcon field="status" /></div>
                  </th>
                  <th onClick={() => handleSort('payment_status')} className="text-left px-[14px] py-[10px] text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] bg-[var(--bg-muted)] border-b border-[var(--border)] cursor-pointer select-none">
                    <div className="flex items-center gap-1">Payment <SortIcon field="payment_status" /></div>
                  </th>
                  <th onClick={() => handleSort('date')} className="text-right px-[14px] py-[10px] text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] bg-[var(--bg-muted)] border-b border-[var(--border)] cursor-pointer select-none">
                    <div className="flex items-center justify-end gap-1">Date <SortIcon field="date" /></div>
                  </th>
                  <th className="text-right px-[14px] py-[10px] text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] bg-[var(--bg-muted)] border-b border-[var(--border)]"></th>
                </tr>
              </thead>
              <tbody>
                {paged.map(inv => (
                  <tr key={inv.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-muted)] transition-colors">
                    <td className="px-[14px] py-[10px] text-[13px]">
                      <Link to={`/admin/invoices/${inv.invoice_number}`} className="font-semibold text-[var(--accent)]" style={{ fontFamily: 'monospace' }}>
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="px-[14px] py-[10px] text-[13px] text-[var(--text)] font-semibold">
                      {inv.customer?.company_name || `${inv.customer?.first_name || ''} ${inv.customer?.last_name || ''}`.trim() || '—'}
                    </td>
                    <td className="px-[14px] py-[10px] text-[13px] text-right text-[var(--text)]" style={{ fontFamily: 'monospace' }}>
                      ${inv.total.toFixed(2)}
                    </td>
                    <td className="px-[14px] py-[10px] text-[13px]">
                      <span className={`badge ${statusBadge(inv.status)}`}>
                        {inv.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-[14px] py-[10px] text-[13px]">
                      <span className={`badge ${statusBadge(inv.payment_status)}`}>
                        {inv.payment_status?.replace(/_/g, ' ') || '—'}
                      </span>
                    </td>
                    <td className="px-[14px] py-[10px] text-[13px] text-right text-[var(--text-secondary)]">
                      {new Date(inv.created_at).toLocaleDateString()}
                    </td>
                  <td className="px-[14px] py-[10px] text-[13px] text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleShare(inv)}
                        className="p-1.5 rounded hover:bg-[var(--bg-muted)] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
                        title="Copy share link"
                      >
                        {copied === inv.invoice_number ? <CheckCircle2 size={14} className="text-[var(--success)]" /> : <Copy size={14} />}
                      </button>
                        <a
                          onClick={async (e) => {
                            e.preventDefault();
                            const res = await generateShareLink(inv.invoice_number);
                            window.open(`/invoice/${res.share_token}?print=1`, '_blank');
                          }}
                          href="#"
                          className="p-1.5 rounded hover:bg-[var(--bg-muted)] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
                          title="Print PDF"
                        >
                          <Printer size={14} />
                        </a>
                        {inv.share_token && (
                          <a
                          href={`/invoice/${inv.share_token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded hover:bg-[var(--bg-muted)] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
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
          {totalPages > 1 && (
            <div className="px-[18px] py-3 border-t border-[var(--border)] flex items-center justify-between text-[13px]">
              <span className="text-[var(--text-tertiary)]">
                {sorted.length} invoices &middot; Page {page + 1} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1.5 rounded hover:bg-[var(--bg-muted)] disabled:opacity-30">
                  <ChevronLeft size={14} className="text-[var(--text)]" />
                </button>
                <span className="px-2 text-[var(--text)] font-bold">{page + 1}</span>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-1.5 rounded hover:bg-[var(--bg-muted)] disabled:opacity-30">
                  <ChevronRight size={14} className="text-[var(--text)]" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
