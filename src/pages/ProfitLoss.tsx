import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import api from '../api/api';
import MetricCard from '../components/MetricCard';
import DateRangeSelector from '../components/DateRangeSelector';

interface PLResponse {
  revenue: number;
  device_revenue: number;
  parts_revenue: number;
  cost_of_goods_sold: number;
  device_cogs: number;
  parts_cogs: number;
  gross_profit: number;
  gross_margin_pct: number;
  repair_labor_cost: number;
  operating_expenses: { repair_labor: number };
  net_profit: number;
  date_range: string;
}

export default function ProfitLoss() {
  const [data, setData] = useState<PLResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('This Month');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await api.get('/api/reports/profit-loss', { params: { date_range: dateRange } });
      setData(res);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load P&L');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-[var(--text-tertiary)]" /></div>;
  }

  if (error) {
    return <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4"><AlertCircle size={16} /> {error}</div>;
  }

  if (!data) return null;

  const isProfitable = data.net_profit >= 0;
  const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const rows: Array<{
    label: string;
    items: Array<{ label: string; value: number; bold?: boolean; accent?: boolean; isBottom?: boolean }>;
  }> = [
    { label: 'Revenue', items: [
      { label: 'Device Sales', value: data.device_revenue },
      { label: 'Parts & Accessories', value: data.parts_revenue },
      { label: 'Total Revenue', value: data.revenue, bold: true },
    ]},
    { label: 'Cost of Goods Sold', items: [
      { label: 'Device COGS', value: data.device_cogs },
      { label: 'Parts COGS', value: data.parts_cogs },
      { label: 'Total COGS', value: data.cost_of_goods_sold, bold: true },
    ]},
    { label: 'Gross Profit', items: [
      { label: `Gross Profit (${data.gross_margin_pct}% margin)`, value: data.gross_profit, bold: true, accent: true },
    ]},
    { label: 'Operating Expenses', items: [
      { label: 'Repair Labor', value: data.repair_labor_cost },
      { label: 'Total OpEx', value: data.repair_labor_cost, bold: true },
    ]},
    { label: 'Bottom Line', items: [
      { label: 'Net Profit', value: data.net_profit, bold: true, accent: true, isBottom: true },
    ]},
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Profit & Loss</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">Income statement overview</p>
        </div>
      </div>

      <DateRangeSelector value={dateRange} onChange={setDateRange} />

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <MetricCard label="Total Revenue" value={fmt(data.revenue)} accent="accent" />
        <MetricCard
          label="Gross Profit"
          value={fmt(data.gross_profit)}
          accent={data.gross_profit >= 0 ? 'success' : 'destructive'}
        />
        <MetricCard label="Gross Margin" value={`${data.gross_margin_pct}%`} />
        <MetricCard
          label="Net Profit"
          value={fmt(data.net_profit)}
          accent={isProfitable ? 'success' : 'destructive'}
          emphasis
        />
      </div>

      <div className="card max-w-2xl">
        <table className="w-full text-sm">
          <tbody>
            {rows.map(section => (
              <>
                <tr key={section.label} className="border-b border-[var(--border)]">
                  <td colSpan={2} className="py-3 text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                    {section.label}
                  </td>
                </tr>
                {section.items.map(item => (
                  <tr key={item.label} className={`border-b border-[var(--border)] ${item.isBottom ? 'border-t-2 border-t-[var(--border)]' : ''}`}>
                    <td className={`py-2.5 ${item.bold ? 'font-bold text-[var(--text)]' : 'text-[var(--text-secondary)]'}`}>
                      {item.label}
                    </td>
                    <td className={`py-2.5 text-right font-mono ${item.bold ? 'font-bold text-base' : 'text-sm'} ${item.accent ? (isProfitable ? 'text-[var(--success)]' : 'text-[var(--destructive)]') : 'text-[var(--text)]'}`}>
                      {fmt(item.value)}
                    </td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
