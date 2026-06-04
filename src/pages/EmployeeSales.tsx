import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import api from '../api/api';
import MetricCard from '../components/MetricCard';
import DateRangeSelector from '../components/DateRangeSelector';

interface EmployeeSales {
  email: string;
  invoices: number;
  sales: number;
  items: number;
}

interface SalesResponse {
  employees: EmployeeSales[];
  date_range: string;
  total_sales: number;
}

const EMPLOYEE_PRESETS = ['Today', 'This Week', 'This Month', '3 Months'] as const;

export default function EmployeeSales() {
  const [data, setData] = useState<SalesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('Today');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await api.get('/api/reports/employee-sales', { params: { date_range: dateRange } });
      setData(res);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load employee sales');
    } finally { setLoading(false); }
  }, [dateRange]);

  useEffect(() => { load(); }, [load]);

  const fmt = (n: number) => `$${n.toFixed(2)}`;

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-[var(--text-tertiary)]" /></div>;
  if (error) return <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4"><AlertCircle size={16} /> {error}</div>;
  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Employee Sales</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">Sales attribution by staff member</p>
        </div>
      </div>

      <DateRangeSelector value={dateRange} onChange={setDateRange} presets={EMPLOYEE_PRESETS} />

      <MetricCard label="Total Sales" value={fmt(data.total_sales)} accent="accent" emphasis />

      {data.employees.length === 0 ? (
        <div className="text-center py-10 text-[var(--text-tertiary)] text-sm">No sales data for {dateRange.toLowerCase()}</div>
      ) : (
        <div className="card">
          <table className="table-standard">
            <thead><tr><th>Employee</th><th className="text-right">Invoices</th><th className="text-right">Items Sold</th><th className="text-right">Sales</th></tr></thead>
            <tbody>
              {data.employees.map(e => (
                <tr key={e.email}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center font-bold text-xs">
                        {(e.email[0] || '?').toUpperCase()}
                      </div>
                      <span className="font-medium text-sm">{e.email.split('@')[0]}</span>
                    </div>
                  </td>
                  <td className="text-right">{e.invoices}</td>
                  <td className="text-right">{e.items}</td>
                  <td className="text-right font-bold">{fmt(e.sales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
