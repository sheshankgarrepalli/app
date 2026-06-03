import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle, Download } from 'lucide-react';
import api from '../api/api';

interface StoreTaxData {
  store_name: string;
  total_sales: number;
  taxable_sales: number;
  exempt_sales: number;
  tax_collected: number;
  tax_rate: number;
  invoice_count: number;
}

interface TaxSummaryResponse {
  stores: StoreTaxData[];
  totals: {
    total_sales: number;
    taxable_sales: number;
    exempt_sales: number;
    tax_collected: number;
    total_invoices: number;
  };
  date_range: string;
}

const DATE_PRESETS = [
  { value: 'This Month', label: 'This Month' },
  { value: 'Today', label: 'Today' },
  { value: 'This Week', label: 'This Week' },
  { value: '3 Months', label: 'Last 3 Months' },
  { value: '6 Months', label: 'Last 6 Months' },
];

const formatCurrency = (n: number) => `$${n.toFixed(2)}`;

export default function TaxSummary() {
  const [data, setData] = useState<TaxSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('This Month');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await api.get('/api/reports/tax-summary', { params: { date_range: dateRange } });
      setData(res);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load tax summary');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    if (!data) return;
    const rows: string[] = ['Store,Total Sales,Taxable Sales,Exempt Sales,Tax Rate,Tax Collected,Invoices'];
    data.stores.forEach(s => {
      rows.push([s.store_name, s.total_sales, s.taxable_sales, s.exempt_sales, s.tax_rate, s.tax_collected, s.invoice_count].join(','));
    });
    rows.push('');
    rows.push(`Totals,${data.totals.total_sales},${data.totals.taxable_sales},${data.totals.exempt_sales},,${data.totals.tax_collected},${data.totals.total_invoices}`);
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tax_summary_${dateRange.replace(/\s+/g, '_').toLowerCase()}.csv`;
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={28} className="animate-spin text-[var(--text-tertiary)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4">
        <AlertCircle size={16} /> {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Tax Summary</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">Sales tax collected by store — filing-ready</p>
        </div>
        <button onClick={exportCsv} className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
          <Download size={16} />
          Export CSV
        </button>
      </div>

      <div className="flex items-center gap-2">
        {DATE_PRESETS.map(p => (
          <button
            key={p.value}
            onClick={() => setDateRange(p.value)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${dateRange === p.value ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-muted)] text-[var(--text-secondary)] hover:text-[var(--text)]'}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {[
          { label: 'Total Sales', value: data.totals.total_sales },
          { label: 'Taxable Sales', value: data.totals.taxable_sales },
          { label: 'Exempt Sales', value: data.totals.exempt_sales },
          { label: 'Tax Collected', value: data.totals.tax_collected, emphasis: true },
          { label: 'Invoices', value: data.totals.total_invoices, isNumber: true },
        ].map(kpi => (
          <div key={kpi.label} className={`kpi-card ${kpi.emphasis ? 'border-l-4' : ''}`}
            style={kpi.emphasis ? { borderLeftColor: 'var(--accent)' } : undefined}>
            <div className="kpi-label">{kpi.label}</div>
            <div className="kpi-value" style={kpi.emphasis ? { color: 'var(--accent)' } : undefined}>
              {kpi.isNumber ? kpi.value.toLocaleString() : formatCurrency(kpi.value)}
            </div>
          </div>
        ))}
      </div>

      {data.stores.length === 0 ? (
        <div className="text-center py-10 text-[var(--text-tertiary)] text-sm">
          No taxable sales data for {dateRange.toLowerCase()}
        </div>
      ) : (
        <div className="card">
          <table className="table-standard">
            <thead>
              <tr>
                <th>Store</th>
                <th className="text-right">Tax Rate</th>
                <th className="text-right">Total Sales</th>
                <th className="text-right">Taxable Sales</th>
                <th className="text-right">Exempt Sales</th>
                <th className="text-right" style={{ color: 'var(--accent)' }}>Tax Collected</th>
                <th className="text-right">Invoices</th>
              </tr>
            </thead>
            <tbody>
              {data.stores.map(s => (
                <tr key={s.store_name}>
                  <td className="font-medium text-sm">{s.store_name}</td>
                  <td className="text-right">{s.tax_rate.toFixed(3)}%</td>
                  <td className="text-right">{formatCurrency(s.total_sales)}</td>
                  <td className="text-right">{formatCurrency(s.taxable_sales)}</td>
                  <td className="text-right">{formatCurrency(s.exempt_sales)}</td>
                  <td className="text-right font-bold" style={{ color: 'var(--accent)' }}>
                    {formatCurrency(s.tax_collected)}
                  </td>
                  <td className="text-right text-[var(--text-secondary)]">{s.invoice_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
