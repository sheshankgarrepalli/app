import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, AlertCircle, AlertTriangle, Package } from 'lucide-react';
import api from '../api/api';
import MetricCard from '../components/MetricCard';

interface LowStockItem {
  sku: string;
  part_name: string;
  current_stock_qty: number;
  low_stock_threshold: number;
}

interface LowStockResponse {
  low_stock: LowStockItem[];
  out_of_stock: { sku: string; part_name: string }[];
  low_stock_count: number;
  out_of_stock_count: number;
}

export default function LowStockAlerts() {
  const [data, setData] = useState<LowStockResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await api.get('/api/reports/low-stock');
      setData(res);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load low stock alerts');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-[var(--text-tertiary)]" /></div>;
  if (error) return <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4"><AlertCircle size={16} /> {error}</div>;
  if (!data) return null;

  const hasAlerts = data.out_of_stock_count > 0 || data.low_stock_count > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Low Stock Alerts</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
            {hasAlerts ? `${data.low_stock_count + data.out_of_stock_count} items need attention` : 'All parts are well stocked'}
          </p>
        </div>
      </div>

      {!hasAlerts ? (
        <div className="text-center py-12 text-[var(--text-tertiary)]">
          <Package size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">All parts fully stocked</p>
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          {data.out_of_stock_count > 0 && (
            <MetricCard label="Out of Stock" value={data.out_of_stock_count} accent="destructive" emphasis />
          )}
          {data.low_stock_count > 0 && (
            <MetricCard label="Low Stock" value={data.low_stock_count} accent="warning" emphasis />
          )}
        </div>
      )}

      {data.out_of_stock.length > 0 && (
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <AlertCircle size={16} className="text-[var(--destructive)]" />
            Out of Stock
          </div>
          <table className="table-standard">
            <thead><tr><th>SKU</th><th>Part Name</th><th className="w-20">Actions</th></tr></thead>
            <tbody>
              {data.out_of_stock.map(p => (
                <tr key={p.sku}>
                  <td className="font-mono text-xs font-semibold">{p.sku}</td>
                  <td className="text-sm">{p.part_name}</td>
                  <td>
                    <Link to="/admin/sku-generator" className="btn-primary text-[10px] px-2 py-1 rounded font-medium">Order</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.low_stock.length > 0 && (
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <AlertTriangle size={16} className="text-[var(--warning)]" />
            Low Stock
          </div>
          <table className="table-standard">
            <thead><tr><th>SKU</th><th>Part Name</th><th className="text-right">Stock</th><th className="text-right">Threshold</th></tr></thead>
            <tbody>
              {data.low_stock.map(p => (
                <tr key={p.sku}>
                  <td className="font-mono text-xs font-semibold">{p.sku}</td>
                  <td className="text-sm">{p.part_name}</td>
                  <td className="text-right">
                    <span className="badge-warning">{p.current_stock_qty}</span>
                  </td>
                  <td className="text-right text-[var(--text-secondary)]">{p.low_stock_threshold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
