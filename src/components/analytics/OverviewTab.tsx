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

export default function OverviewTab({ data, timeSeries, loading }: Props) {
  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 size={32} className="animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  const marginPct = data?.gross_margin_pct ?? 0;

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
          <div className="kpi-value" style={{ color: marginPct < 0 ? 'var(--destructive)' : undefined }}>
            {marginPct.toFixed(1)}%
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Inventory Velocity</div>
          <div className="kpi-value">{data?.inventory_velocity_days != null ? `${data.inventory_velocity_days.toFixed(1)}d` : '—'}</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))' }}>
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

        <div className="card">
          <div className="card-header">Top Selling Models</div>
          <div className="card-body">
            {data?.top_selling_models?.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.top_selling_models} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                  <YAxis
                    dataKey="model_number" type="category"
                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                    width={150}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: 8, fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-[13px] text-[var(--text-tertiary)] py-8 text-center">No sales data for this period</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
