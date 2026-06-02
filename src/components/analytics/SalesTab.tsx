import { Loader2 } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import type { DashboardSnapshot, TimeSeriesData } from '../../api/reports';

interface Props {
  data: DashboardSnapshot | null;
  timeSeries: TimeSeriesData | null;
  loading: boolean;
}

function formatCurrency(v: number) {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function SalesTab({ data, timeSeries, loading }: Props) {
  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 size={32} className="animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  const marginPct = data?.gross_margin_pct ?? 0;
  const marginDollars = data?.gross_margin ?? 0;

  const locationData = data ? Object.entries(data.sales_by_location).map(([name, count]) => ({
    name: name.replace(/_/g, ' '),
    count,
  })) : [];

  return (
    <div className="space-y-5">
      {/* KPI Row */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="kpi-card">
          <div className="kpi-label">Total Sold</div>
          <div className="kpi-value">{(data?.total_sold ?? 0).toLocaleString()}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Revenue</div>
          <div className="kpi-value">{formatCurrency(data?.total_revenue ?? 0)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Gross Margin</div>
          <div className="kpi-value" style={{ color: marginDollars < 0 ? 'var(--destructive)' : undefined }}>
            {formatCurrency(marginDollars)}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Margin %</div>
          <div className="kpi-value" style={{ color: marginPct < 0 ? 'var(--destructive)' : undefined }}>
            {marginPct.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="card">
        <div className="card-header">Revenue Over Time</div>
        <div className="card-body">
          {timeSeries?.revenue?.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={timeSeries.revenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 8, fontSize: 12,
                  }}
                  formatter={(value: any) => [formatCurrency(value as number), 'Revenue']}
                />
                <Line type="monotone" dataKey="amount" stroke="var(--accent)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-[13px] text-[var(--text-tertiary)] py-8 text-center">No data for this period</p>
          )}
        </div>
      </div>

      {/* Sales by Location + Top Models Table */}
      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))' }}>
        <div className="card">
          <div className="card-header">Sales by Location</div>
          <div className="card-body">
            {locationData.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={locationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: 8, fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-[13px] text-[var(--text-tertiary)] py-8 text-center">No data for this period</p>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">Top Selling Models</div>
          <div className="card-body p-0">
            {data?.top_selling_models?.length ? (
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left px-[14px] py-[10px] text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] bg-[var(--bg-muted)] border-b border-[var(--border)]">#</th>
                    <th className="text-left px-[14px] py-[10px] text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] bg-[var(--bg-muted)] border-b border-[var(--border)]">Model</th>
                    <th className="text-right px-[14px] py-[10px] text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] bg-[var(--bg-muted)] border-b border-[var(--border)]">Sold</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_selling_models.map((m, i) => (
                    <tr key={m.model_number} className="border-b border-[var(--border)]">
                      <td className="px-[14px] py-[8px] text-[13px] text-[var(--text-tertiary)]">{i + 1}</td>
                      <td className="px-[14px] py-[8px] text-[13px] font-semibold text-[var(--text)]">{m.model_number}</td>
                      <td className="px-[14px] py-[8px] text-[13px] text-right font-mono text-[var(--text)]">{m.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-[13px] text-[var(--text-tertiary)] py-8 text-center">No sales data for this period</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
