import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle, DollarSign, FileText, Printer } from 'lucide-react';
import api from '../api/api';
import { useLocationFilter } from '../context/LocationContext';
import MetricCard from '../components/MetricCard';

interface DailyClose {
  date: string;
  total_invoices: number;
  total_revenue: number;
  total_paid: number;
  total_outstanding: number;
  total_tax: number;
  total_discounts: number;
  by_payment_method: Record<string, number>;
}

const PAYMENT_METHODS = ['Cash', 'Credit Card', 'Wire', 'Store Credit', 'On Terms', 'Zelle'];

export default function DailyClose() {
  const { selectedLocationId } = useLocationFilter();
  const [data, setData] = useState<DailyClose | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await api.get('/api/reports/daily-close', { params: { store_id: selectedLocationId || undefined } });
      setData(res);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load daily close');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePrint = () => window.print();
  const fmt = (n: number) => `$${n.toFixed(2)}`;

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-[var(--text-tertiary)]" /></div>;
  if (error) return <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4"><AlertCircle size={16} /> {error}</div>;
  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Daily Close</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">{new Date(data.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <button onClick={handlePrint} className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"><Printer size={16} /> Print</button>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        <MetricCard label="Total Revenue" value={fmt(data.total_revenue)} accent="accent" emphasis />
        <MetricCard label="Total Paid" value={fmt(data.total_paid)} accent="success" />
        <MetricCard
          label="Outstanding"
          value={fmt(data.total_outstanding)}
          accent={data.total_outstanding > 0 ? 'destructive' : 'success'}
        />
        <MetricCard label="Tax Collected" value={fmt(data.total_tax)} />
        <MetricCard label="Discounts Given" value={fmt(data.total_discounts)} />
        <MetricCard label="Invoices" value={data.total_invoices.toLocaleString()} />
      </div>

      <div className="card max-w-lg">
        <div className="card-header flex items-center gap-2"><DollarSign size={16} className="text-[var(--accent)]" />Payment Breakdown</div>
        <div className="card-body">
          <table className="table-standard">
            <thead><tr><th>Payment Method</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {PAYMENT_METHODS.filter(m => (data.by_payment_method[m] || 0) > 0).map(m => (
                <tr key={m}><td className="font-medium">{m}</td><td className="text-right font-mono">{fmt(data.by_payment_method[m] || 0)}</td></tr>
              ))}
              {PAYMENT_METHODS.every(m => !data.by_payment_method[m]) && (
                <tr><td colSpan={2} className="text-center text-[var(--text-tertiary)] py-4">No payments today</td></tr>
              )}
              <tr className="border-t-2 border-[var(--border)] font-bold"><td>Total</td><td className="text-right font-mono">{fmt(data.total_paid)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card max-w-lg">
        <div className="card-header flex items-center gap-2"><FileText size={16} className="text-[var(--accent)]" />Cash Drawer Reconciliation</div>
        <div className="card-body space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Cash sales (system)</span><span className="font-mono font-bold">{fmt(data.by_payment_method['Cash'] || 0)}</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Card sales (system)</span><span className="font-mono font-bold">{fmt(data.by_payment_method['Credit Card'] || 0)}</span></div>
          <div className="border-t border-[var(--border)] pt-3 flex justify-between"><span className="font-semibold">Expected total</span><span className="font-mono font-bold">{fmt(data.total_paid)}</span></div>
          <div className="bg-[var(--bg-muted)] rounded-lg p-3 text-xs text-[var(--text-tertiary)]">
            Count physical cash, checks, and card terminal receipts. Compare against the "Cash sales" + "Card sales" amounts above.
          </div>
        </div>
      </div>
    </div>
  );
}
