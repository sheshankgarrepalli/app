import { useState, useEffect } from 'react';
import api from '../api/api';
import { useAuth } from '@clerk/react';
import { TrendingUp, Package, MapPin } from 'lucide-react';

export default function AdminDashboard() {
  const { getToken, isLoaded } = useAuth();
  const [dateRange, setDateRange] = useState('Today');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    
    const fetchDashboard = async () => {
      try {
        setError(null);
        const token = await getToken();
        const res = await api.get(`/api/reports/dashboard?date_range=${dateRange}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData(res.data);
      } catch (err: any) {
        console.error("Dashboard Load Error", err);
        setError(err.response?.data?.detail || "Failed to load dashboard data. Please verify database connection.");
      }
    };

    fetchDashboard();
  }, [dateRange, getToken, isLoaded]);

  if (error) return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8 bg-rose-50 border border-rose-200 rounded-lg m-8">
      <div className="text-rose-900 font-bold text-lg mb-2 uppercase tracking-widest">Service Interruption</div>
      <p className="text-rose-700/60 text-xs font-semibold uppercase tracking-widest max-w-md">{error}</p>
      <button onClick={() => window.location.reload()} className="btn-primary mt-8 px-8 py-3">Retry Connection</button>
    </div>
  );

  if (!data) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-6">
      <div className="w-10 h-10 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
      <div className="text-zinc-400 font-semibold uppercase tracking-[0.4em] text-[10px]">Synchronizing Metrics...</div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-12">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Executive Overview</h1>
          <p className="text-xs text-zinc-500 mt-1">Real-time operational intelligence & throughput</p>
        </div>
        <select value={dateRange} onChange={e => setDateRange(e.target.value)} className="input-stark">
          {["Today", "This Week", "This Month", "3 Months", "6 Months"].map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-zinc-200 p-8 rounded-lg shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <TrendingUp size={16} />
            <span className="text-xs font-semibold uppercase tracking-widest">Total Outflow</span>
          </div>
          <div className="text-5xl font-bold text-zinc-900 tracking-tighter">{data.total_sold}</div>
        </div>
        <div className="bg-white border border-zinc-200 p-8 rounded-lg shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <Package size={16} />
            <span className="text-xs font-semibold uppercase tracking-widest">Warehouse Flux</span>
          </div>
          <div className="text-5xl font-bold text-zinc-900 tracking-tighter">{data.warehouse_outflow}</div>
        </div>
        <div className="bg-white border border-zinc-200 p-8 rounded-lg shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <MapPin size={16} />
            <span className="text-xs font-semibold uppercase tracking-widest">Regional Distribution</span>
          </div>
          <div className="space-y-3 pt-2">
            {Object.entries(data.sales_by_location).map(([store, count]) => (
              <div key={store} className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider">
                <span className="text-zinc-500">{store.replace('_', ' ')}</span>
                <span className="text-zinc-900">{count as number}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">High-Velocity Assets</h2>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 border-b border-zinc-100 bg-zinc-50/50">
              <th className="px-8 py-4">Model Identifier</th>
              <th className="px-8 py-4 text-right">Throughput (Units)</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {data.top_selling_models.map((item: any, idx: number) => (
              <tr key={idx} className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                <td className="px-8 py-4 text-zinc-900 font-semibold uppercase tracking-wider">{item.model_number}</td>
                <td className="px-8 py-4 text-right text-zinc-900 font-bold">{item.count}</td>
              </tr>
            ))}
            {data.top_selling_models.length === 0 && (
              <tr><td colSpan={2} className="py-20 text-center text-zinc-300 font-semibold uppercase tracking-widest">No Velocity Data Available</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
