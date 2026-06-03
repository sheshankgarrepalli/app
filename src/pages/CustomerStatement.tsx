import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, AlertCircle, Printer, ArrowLeft } from 'lucide-react';
import api from '../api/api';

interface StatementInvoice {
  invoice_number: string;
  created_at: string | null;
  due_date: string | null;
  total: number;
  paid: number;
  balance: number;
  status: string;
}

interface Statement {
  customer_name: string;
  crm_id: string;
  customer_type: string;
  email: string;
  phone: string;
  current_balance: number;
  credit_limit: number;
  invoices: StatementInvoice[];
  total_outstanding: number;
  total_paid: number;
}

export default function CustomerStatement() {
  const { crmId } = useParams<{ crmId: string }>();
  const [data, setData] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!crmId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await api.get(`/api/reports/customer-statement/${crmId}`);
      setData(res);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load statement');
    } finally {
      setLoading(false);
    }
  }, [crmId]);

  useEffect(() => { load(); }, [load]);

  const handlePrint = () => window.print();

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-[var(--text-tertiary)]" /></div>;
  }

  if (error) {
    return <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4"><AlertCircle size={16} /> {error}</div>;
  }

  if (!data) return null;

  const getInitial = () => data.customer_name ? data.customer_name.charAt(0).toUpperCase() : '?';
  const fm = (n: number) => `$${n.toFixed(2)}`;

  return (
    <div className="space-y-5" id="statement-print">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/admin/customers/${data.crm_id}`} className="btn-ghost p-1.5 rounded-lg">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[var(--text)]">Customer Statement</h1>
            <p className="text-sm text-[var(--text-tertiary)] mt-0.5">Account summary for {data.customer_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      {/* Customer Card */}
      <div className="card">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center font-bold text-lg">
            {getInitial()}
          </div>
          <div>
            <div className="text-base font-bold text-[var(--text)]">{data.customer_name}</div>
            <div className="text-xs text-[var(--text-tertiary)]">
              {data.crm_id} · {data.customer_type}
              {data.email && ` · ${data.email}`}
              {data.phone && ` · ${data.phone}`}
            </div>
          </div>
        </div>
      </div>

      {/* Balance KPI cards */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <div className="kpi-card">
          <div className="kpi-label">Current Balance</div>
          <div className="kpi-value" style={{ color: data.current_balance > 0 ? 'var(--text)' : 'var(--success)' }}>
            {fm(data.current_balance)}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Outstanding</div>
          <div className="kpi-value" style={{ color: data.total_outstanding > 0 ? 'var(--destructive)' : 'var(--success)' }}>
            {fm(data.total_outstanding)}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Paid</div>
          <div className="kpi-value" style={{ color: 'var(--success)' }}>{fm(data.total_paid)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Credit Limit</div>
          <div className="kpi-value">{data.credit_limit > 0 ? fm(data.credit_limit) : 'None'}</div>
        </div>
      </div>

      {/* Invoices table */}
      {data.invoices.length === 0 ? (
        <div className="text-center py-10 text-[var(--text-tertiary)] text-sm">No invoices found</div>
      ) : (
        <div className="card">
          <table className="table-standard">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Date</th>
                <th>Due Date</th>
                <th className="text-right">Total</th>
                <th className="text-right">Paid</th>
                <th className="text-right">Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.invoices.map(inv => (
                <tr key={inv.invoice_number}>
                  <td>
                    <Link to={`/admin/invoices/${inv.invoice_number}`} className="text-[var(--accent)] hover:underline font-mono text-xs">
                      {inv.invoice_number}
                    </Link>
                  </td>
                  <td className="text-sm text-[var(--text-secondary)]">
                    {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="text-sm text-[var(--text-secondary)]">
                    {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '-'}
                  </td>
                  <td className="text-right font-medium">{fm(inv.total)}</td>
                  <td className="text-right text-[var(--success)]">{fm(inv.paid)}</td>
                  <td className="text-right font-bold" style={{ color: inv.balance > 0 ? 'var(--destructive)' : 'var(--success)' }}>
                    {fm(inv.balance)}
                  </td>
                  <td>
                    <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded ${inv.status === 'Paid' ? 'bg-green-50 text-green-700' : inv.status === 'Partially_Paid' ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'}`}>
                      {inv.status.replace(/_/g, ' ')}
                    </span>
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
