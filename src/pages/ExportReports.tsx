import { useState } from 'react';
import { Download, Loader2, AlertCircle, FileSpreadsheet, Store, Calendar, Tag } from 'lucide-react';
import api from '../api/api';
import { useLocationFilter } from '../context/LocationContext';
import { useAuth } from '../context/AuthContext';

const REPORT_TYPES = [
  { value: 'inventory', label: 'Inventory Summary', desc: 'All devices with model, status, store, and notes' },
  { value: 'sales', label: 'Sales Report', desc: 'Invoices with customer, totals, payments, and balance' },
  { value: 'profit-loss', label: 'Profit & Loss', desc: 'Revenue, COGS, gross profit, and margin' },
  { value: 'tax-summary', label: 'Tax Summary', desc: 'Taxable sales, exempt sales, and tax collected by store' },
  { value: 'ar-aging', label: 'AR Aging', desc: 'Outstanding invoices by customer with aging buckets' },
  { value: 'employee-sales', label: 'Employee Sales', desc: 'Sales totals grouped by employee' },
  { value: 'transfers', label: 'Transfer Log', desc: 'All transfer orders with route, status, and device count' },
  { value: 'customers', label: 'Customer List', desc: 'All customers with contact info, balance, and credit limit' },
  { value: 'low-stock', label: 'Low Stock Alert', desc: 'Models with 5 or fewer units in stock' },
];

const DATE_RANGES = ['Today', 'This Week', 'This Month', '3 Months', '6 Months', 'All Time'];

export default function ExportReports() {
  const { user } = useAuth();
  const { selectedLocationId, availableLocations } = useLocationFilter();
  const effectiveStoreId = user?.role !== 'admin' ? (user?.store_id || null) : selectedLocationId;

  const [reportType, setReportType] = useState('inventory');
  const [dateRange, setDateRange] = useState('All Time');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { report_type: reportType, date_range: dateRange };
      if (effectiveStoreId) params.store_id = effectiveStoreId;
      const { data } = await api.get('/api/reports/export', {
        params,
        responseType: 'blob',
      });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}_${dateRange.replace(/ /g, '_')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-[var(--text)]">Export Reports</h1>
        <p className="text-sm text-[var(--text-tertiary)] mt-0.5">Download CSV reports for any date range and store</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle size={16} />{error}
          <button onClick={() => setError(null)} className="ml-auto text-xs underline">Dismiss</button>
        </div>
      )}

      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-accent" /> Report Settings
          </h3>
        </div>
        <div className="p-5 space-y-5">
          {/* Report Type */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2 flex items-center gap-1.5">
              <Tag size={12} /> Report Type
            </label>
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {REPORT_TYPES.map(rt => (
                <button
                  key={rt.value}
                  onClick={() => setReportType(rt.value)}
                  className={`text-left p-3 rounded-lg border transition-all ${
                    reportType === rt.value
                      ? 'border-accent bg-accent/5'
                      : 'border-[var(--border)] hover:border-[var(--text-tertiary)]'
                  }`}
                >
                  <div className="text-sm font-bold text-[var(--text)]">{rt.label}</div>
                  <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{rt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Date Range + Store */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-1.5 flex items-center gap-1.5">
                <Calendar size={12} /> Date Range
              </label>
              <select
                value={dateRange}
                onChange={e => setDateRange(e.target.value)}
                className="form-select w-full"
              >
                {DATE_RANGES.map(dr => (
                  <option key={dr} value={dr}>{dr}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-1.5 flex items-center gap-1.5">
                <Store size={12} /> Store
              </label>
              {user?.role === 'admin' ? (
                <select
                  value={effectiveStoreId ?? 'all'}
                  onChange={() => {}}
                  className="form-select w-full"
                >
                  <option value="all">All Stores</option>
                  {availableLocations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              ) : (
                <div className="px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg-muted)] text-sm text-[var(--text)]">
                  {availableLocations.find(l => l.id === effectiveStoreId)?.name || effectiveStoreId || 'Store'}
                </div>
              )}
            </div>
          </div>

          {/* Export Button */}
          <button
            onClick={handleExport}
            disabled={loading}
            className="btn-primary flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            {loading ? 'Generating...' : 'Download CSV'}
          </button>
        </div>
      </div>
    </div>
  );
}
