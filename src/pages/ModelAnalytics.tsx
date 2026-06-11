import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/api';
import { useLocationFilter } from '../context/LocationContext';
import { ArrowLeft, Loader2, AlertCircle, Truck, ShoppingCart, PenTool, ArrowDownToLine, Store, BarChart3, Clock, Trash2 } from 'lucide-react';

interface ModelInfo {
  model_number: string;
  brand: string;
  name: string;
  storage_gb: number;
}

interface ImportEvent {
  date: string | null;
  count: number;
}

interface SaleEvent {
  invoice_number: string;
  date: string | null;
  customer: string;
  count: number;
}

interface TransferEvent {
  transfer_id: string;
  date: string | null;
  from: string;
  to: string;
  status: string;
  count: number;
}

interface ScrappedDevice {
  imei: string;
  notes: string | null;
  received_date: string | null;
}

interface AnalyticsData {
  model_info: ModelInfo;
  total_ever_registered: number;
  currently_in_stock: number;
  available_sellable: number;
  sold_count: number;
  scrapped_count: number;
  first_inventory_date: string | null;
  status_breakdown: Record<string, number>;
  store_breakdown: { location_id: string; location_name: string; count: number }[];
  imports: ImportEvent[];
  sales: SaleEvent[];
  transfers: TransferEvent[];
  scrapped_devices: ScrappedDevice[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  Sellable: { label: 'Sellable', color: '#10b981' },
  In_QC: { label: 'In QC', color: '#00f0ff' },
  In_Repair: { label: 'In Repair', color: '#f59e0b' },
  In_Transit: { label: 'In Transit', color: '#14b8a6' },
  Reserved_Layaway: { label: 'Layaway', color: '#f97316' },
  Sold: { label: 'Sold', color: '#3b82f6' },
  Scrapped: { label: 'Scrapped', color: '#ef4444' },
  Awaiting_Parts: { label: 'Awaiting Parts', color: '#a855f7' },
  On_Consignment: { label: 'Consignment', color: '#8b5cf6' },
  Pending_Acknowledgment: { label: 'Pending', color: '#6b7280' },
  Transit_to_Repair: { label: 'Transit→Repair', color: '#f59e0b' },
  Transit_to_QC: { label: 'Transit→QC', color: '#00f0ff' },
  Transit_to_Main_Bin: { label: 'Transit→Main', color: '#10b981' },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ModelAnalytics() {
  const { modelNumber } = useParams<{ modelNumber: string }>();
  const { selectedLocationId } = useLocationFilter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!modelNumber) return;
    setLoading(true);
    const params = selectedLocationId ? { store_id: selectedLocationId } : {};
    api.get(`/api/models/${encodeURIComponent(modelNumber)}/analytics`, { params })
      .then(res => setData(res.data))
      .catch(() => setError('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [modelNumber, selectedLocationId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={40} className="animate-spin text-accent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center">
        <AlertCircle size={32} className="mx-auto text-red-400 mb-3" />
        <p className="text-sm text-[var(--text-secondary)]">{error || 'No data found'}</p>
      </div>
    );
  }

  const { model_info, imports, sales, transfers, scrapped_devices } = data;
  const totalImported = imports.reduce((s, i) => s + i.count, 0);
  const totalSold = sales.reduce((s, sa) => s + sa.count, 0);
  const totalTransferred = transfers.reduce((s, t) => s + t.count, 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/admin/models" className="p-1.5 rounded-lg hover:bg-[var(--bg-muted)] text-[var(--text-tertiary)] hover:text-[var(--text)] transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[var(--text)]">
              {model_info.brand} {model_info.name}
            </h1>
            <p className="text-sm text-[var(--text-tertiary)]">
              {model_info.model_number}{model_info.storage_gb > 0 ? ` · ${model_info.storage_gb}GB` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border)]">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Total Registered</div>
          <div className="text-2xl font-bold text-[var(--text)]">{data.total_ever_registered}</div>
        </div>
        <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border)]">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">In Stock</div>
          <div className="text-2xl font-bold text-[var(--text)]">{data.currently_in_stock}</div>
        </div>
        <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-emerald-500/20">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1">Sellable</div>
          <div className="text-2xl font-bold text-emerald-400">{data.available_sellable}</div>
        </div>
        <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-blue-500/20">
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-1">Sold</div>
          <div className="text-2xl font-bold text-blue-400">{data.sold_count}</div>
        </div>
        <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-red-500/20">
          <div className="text-[10px] font-bold uppercase tracking-wider text-red-400 mb-1">Scrapped</div>
          <div className="text-2xl font-bold text-red-400">{data.scrapped_count}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Status Breakdown */}
        <div className="bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border)]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-3 flex items-center gap-1.5">
            <BarChart3 size={13} /> Status Breakdown
          </h3>
          <div className="space-y-2">
            {Object.entries(data.status_breakdown)
              .filter(([, count]) => count > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => {
                const info = STATUS_LABELS[status] || { label: status.replace(/_/g, ' '), color: '#6b7280' };
                const maxCount = Math.max(...Object.values(data.status_breakdown), 1);
                const pct = Math.round((count / maxCount) * 100);
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: info.color }} />
                        <span className="text-[var(--text-secondary)]">{info.label}</span>
                      </div>
                      <span className="font-mono font-bold text-[var(--text)]">{count}</span>
                    </div>
                    <div className="h-1 bg-[var(--bg-muted)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: info.color }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Store Breakdown */}
        <div className="bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border)]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-3 flex items-center gap-1.5">
            <Store size={13} /> By Store
          </h3>
          <div className="space-y-2">
            {data.store_breakdown.length > 0 ? (
              data.store_breakdown.sort((a, b) => b.count - a.count).map(s => (
                <div key={s.location_id} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-secondary)]">{s.location_name}</span>
                  <span className="font-mono font-bold text-[var(--text)]">{s.count}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-[var(--text-tertiary)] italic">None in stock</p>
            )}
          </div>
        </div>

        {/* First Inventory Date */}
        <div className="bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border)]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-3 flex items-center gap-1.5">
            <Clock size={13} /> First Inventory Entry
          </h3>
          <p className="text-lg font-bold text-[var(--text)]">{formatDate(data.first_inventory_date)}</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">First device registered in the system</p>
        </div>
      </div>

      {/* Import History */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1.5">
            <ArrowDownToLine size={13} className="text-emerald-400" /> Import History
          </h3>
          <span className="text-xs text-[var(--text-tertiary)]">{totalImported} total · {imports.length} batches</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Date</th>
                <th className="text-right px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Units</th>
              </tr>
            </thead>
            <tbody>
              {imports.length > 0 ? imports.map((imp, i) => (
                <tr key={i} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-muted)] transition-colors">
                  <td className="px-5 py-2 font-medium text-[var(--text)]">{formatDate(imp.date)}</td>
                  <td className="px-5 py-2 text-right font-mono font-bold text-[var(--text)]">{imp.count}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={2} className="px-5 py-6 text-center text-xs text-[var(--text-tertiary)] italic">No imports recorded</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sales History */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1.5">
            <ShoppingCart size={13} className="text-blue-400" /> Sales History
          </h3>
          <span className="text-xs text-[var(--text-tertiary)]">{totalSold} units · {sales.length} invoices</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Invoice</th>
                <th className="text-left px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Customer</th>
                <th className="text-left px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Date</th>
                <th className="text-right px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Units</th>
              </tr>
            </thead>
            <tbody>
              {sales.length > 0 ? sales.map((s, i) => (
                <tr key={i} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-muted)] transition-colors">
                  <td className="px-5 py-2 font-mono text-xs font-medium text-accent">{s.invoice_number}</td>
                  <td className="px-5 py-2 text-[var(--text-secondary)] max-w-[200px] truncate">{s.customer}</td>
                  <td className="px-5 py-2 text-[var(--text-tertiary)]">{formatDate(s.date)}</td>
                  <td className="px-5 py-2 text-right font-mono font-bold text-[var(--text)]">{s.count}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-center text-xs text-[var(--text-tertiary)] italic">No sales recorded</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transfer History */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1.5">
            <Truck size={13} className="text-amber-400" /> Transfer History
          </h3>
          <span className="text-xs text-[var(--text-tertiary)]">{totalTransferred} units · {transfers.length} orders</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Transfer</th>
                <th className="text-left px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Route</th>
                <th className="text-left px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Status</th>
                <th className="text-left px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Date</th>
                <th className="text-right px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Units</th>
              </tr>
            </thead>
            <tbody>
              {transfers.length > 0 ? transfers.map((t, i) => (
                <tr key={i} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-muted)] transition-colors">
                  <td className="px-5 py-2 font-mono text-xs text-accent">{t.transfer_id}</td>
                  <td className="px-5 py-2 text-[var(--text-secondary)]">{t.from} → {t.to}</td>
                  <td className="px-5 py-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${t.status === 'Received' ? 'bg-emerald-500/10 text-emerald-400' : t.status === 'In Transit' ? 'bg-amber-500/10 text-amber-400' : 'bg-[var(--bg-muted)] text-[var(--text-tertiary)]'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-5 py-2 text-[var(--text-tertiary)]">{formatDate(t.date)}</td>
                  <td className="px-5 py-2 text-right font-mono font-bold text-[var(--text)]">{t.count}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-xs text-[var(--text-tertiary)] italic">No transfers recorded</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes Updates */}
      {data.status_breakdown['Reserved_Layaway'] > 0 && (
        <div className="bg-[var(--bg-card)] rounded-xl p-5 border border-amber-500/20">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-1 flex items-center gap-1.5">
            <PenTool size={13} className="text-amber-400" /> Active Layaways
          </h3>
          <p className="text-sm text-[var(--text-secondary)]">{data.status_breakdown['Reserved_Layaway']} devices currently reserved</p>
        </div>
      )}

      {/* Scrapped Devices */}
      {scrapped_devices.length > 0 && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1.5">
              <Trash2 size={13} className="text-red-400" /> Scrapped Devices
            </h3>
            <span className="text-xs text-[var(--text-tertiary)]">{data.scrapped_count} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">IMEI / Serial</th>
                  <th className="text-left px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Notes</th>
                  <th className="text-left px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Received</th>
                </tr>
              </thead>
              <tbody>
                {scrapped_devices.map((d, i) => (
                  <tr key={i} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-muted)] transition-colors">
                    <td className="px-5 py-2 font-mono text-xs text-[var(--text)]">{d.imei}</td>
                    <td className="px-5 py-2 text-xs text-[var(--text-secondary)] max-w-[250px] truncate">{d.notes || '—'}</td>
                    <td className="px-5 py-2 text-xs text-[var(--text-tertiary)]">{formatDate(d.received_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
