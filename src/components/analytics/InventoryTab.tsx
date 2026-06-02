import { Loader2 } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
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

export default function InventoryTab({ data, timeSeries, loading }: Props) {
  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 size={32} className="animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPI Row */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="kpi-card">
          <div className="kpi-label">Total Devices</div>
          <div className="kpi-value">{(data?.total_devices ?? 0).toLocaleString()}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Inventory Velocity</div>
          <div className="kpi-value">{data?.inventory_velocity_days != null ? `${data.inventory_velocity_days.toFixed(1)}d` : '—'}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Shrinkage</div>
          <div className="kpi-value" style={{ color: (data?.shrinkage_pct ?? 0) > 5 ? 'var(--destructive)' : undefined }}>
            {data?.shrinkage_pct != null ? `${data.shrinkage_pct.toFixed(2)}%` : '—'}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Sellable</div>
          <div className="kpi-value">{(data?.sellable_devices ?? 0).toLocaleString()}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Warehouse Outflow</div>
          <div className="kpi-value">{(data?.warehouse_outflow ?? 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Inventory Levels Chart */}
      <div className="card">
        <div className="card-header">Inventory Levels Over Time</div>
        <div className="card-body">
          {timeSeries?.inventory_levels?.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={timeSeries.inventory_levels}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 8, fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="count" stroke="#a855f7" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-[13px] text-[var(--text-tertiary)] py-8 text-center">No data for this period</p>
          )}
        </div>
      </div>

      {/* Operations KPIs */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="kpi-card">
          <div className="kpi-label">Active Repairs</div>
          <div className="kpi-value">{(data?.active_repairs ?? 0).toLocaleString()}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Low Stock Parts</div>
          <div className="kpi-value" style={{ color: (data?.low_stock_parts ?? 0) > 0 ? 'var(--warning, #f59e0b)' : undefined }}>
            {(data?.low_stock_parts ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Parts Cost Consumed</div>
          <div className="kpi-value">{formatCurrency(data?.parts_cost_consumed ?? 0)}</div>
        </div>
      </div>
    </div>
  );
}
