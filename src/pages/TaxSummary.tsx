import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import api from '../api/api';
import { useLocationFilter } from '../context/LocationContext';
import MetricCard from '../components/MetricCard';
import DateRangeSelector from '../components/DateRangeSelector';

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

const TAX_PRESETS = ['This Month', 'Today', 'This Week', '3 Months', '6 Months'] as const;

const formatCurrency = (n: number) => `$${n.toFixed(2)}`;

export default function TaxSummary() {
  const { selectedLocationId } = useLocationFilter();
  const [data, setData] = useState<TaxSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('This Month');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await api.get('/api/reports/tax-summary', { params: { date_range: dateRange, store_id: selectedLocationId || undefined } });
      setData(res);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load tax summary');
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedLocationId]);

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
        <DateRangeSelector value={dateRange} onChange={setDateRange} onExport={exportCsv} presets={TAX_PRESETS} />
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <MetricCard label="Total Sales" value={formatCurrency(data.totals.total_sales)} />
        <MetricCard label="Taxable Sales" value={formatCurrency(data.totals.taxable_sales)} />
        <MetricCard label="Exempt Sales" value={formatCurrency(data.totals.exempt_sales)} />
        <MetricCard
          label="Tax Collected"
          value={formatCurrency(data.totals.tax_collected)}
          accent="accent"
          emphasis
        />
        <MetricCard label="Invoices" value={data.totals.total_invoices.toLocaleString()} />
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
