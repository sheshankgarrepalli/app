import { useState, useEffect, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';
import DateRangeSelector from '../components/analytics/DateRangeSelector';
import OverviewTab from '../components/analytics/OverviewTab';
import SalesTab from '../components/analytics/SalesTab';
import InventoryTab from '../components/analytics/InventoryTab';
import { fetchDashboard, fetchTimeSeries, exportDashboardCSV } from '../api/reports';
import type { DashboardSnapshot, TimeSeriesData } from '../api/reports';

type Tab = 'overview' | 'sales' | 'inventory';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'sales', label: 'Sales' },
  { id: 'inventory', label: 'Inventory' },
];

export default function Analytics() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [dateRange, setDateRange] = useState('This Month');
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [snap, ts] = await Promise.all([
        fetchDashboard(dateRange),
        fetchTimeSeries(dateRange),
      ]);
      setSnapshot(snap);
      setTimeSeries(ts);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    load();
  }, [load]);

  const handleExport = async () => {
    try {
      await exportDashboardCSV(dateRange);
    } catch {
      setError('Failed to export CSV');
    }
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics Dashboard</h1>
          <p className="text-[13px] text-[var(--text-tertiary)] mt-1">Revenue, inventory, and operational insights</p>
        </div>
      </div>

      {/* Date Range + Export */}
      <DateRangeSelector value={dateRange} onChange={setDateRange} onExport={handleExport} />

      {/* Error */}
      {error && (
        <div className="p-4 rounded-lg flex items-center gap-3 text-[var(--destructive)] text-[13px] font-bold" style={{ background: '#FEE2E2' }}>
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError(null)} className="ml-auto underline">Dismiss</button>
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-[13px] font-semibold transition-colors border-b-2 -mb-px ${
              activeTab === t.id
                ? 'text-[var(--text)] border-[var(--accent)]'
                : 'text-[var(--text-tertiary)] border-transparent hover:text-[var(--text-secondary)]'
            }`}
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab data={snapshot} timeSeries={timeSeries} loading={loading} />}
      {activeTab === 'sales' && <SalesTab data={snapshot} timeSeries={timeSeries} loading={loading} />}
      {activeTab === 'inventory' && <InventoryTab data={snapshot} timeSeries={timeSeries} loading={loading} />}
    </div>
  );
}
