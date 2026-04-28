import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { TrendingUp, Package, DollarSign, Clock, AlertTriangle, Wrench, Download } from 'lucide-react';

export default function AdminDashboard() {
    const { token } = useAuth();
    const API = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000');
    const [dateRange, setDateRange] = useState('This Month');
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchDashboard();
    }, [dateRange, token]);

    const fetchDashboard = async () => {
        try {
            setError(null);
            const res = await axios.get(`${API}/api/reports/dashboard?date_range=${encodeURIComponent(dateRange)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setData(res.data);
        } catch (err: any) {
            setError(err.response?.data?.detail || "Dashboard load failed");
        }
    };

    const handleExport = async () => {
        try {
            const res = await axios.get(`${API}/api/reports/dashboard/export?date_range=${encodeURIComponent(dateRange)}`, {
                headers: { Authorization: `Bearer ${token}` }, responseType: 'blob'
            });
            const url = URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a'); a.href = url; a.download = 'dashboard_export.csv'; a.click();
            URL.revokeObjectURL(url);
        } catch (_) {}
    };

    if (error) return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8 bg-rose-50 border border-rose-200 rounded-lg m-8">
            <div className="text-rose-900 font-bold text-lg mb-2 uppercase tracking-widest">Service Interruption</div>
            <p className="text-rose-700/60 text-xs font-semibold uppercase tracking-widest max-w-md">{error}</p>
            <button onClick={fetchDashboard} className="btn-primary mt-8 px-8 py-3">Retry</button>
        </div>
    );

    if (!data) return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-6">
            <div className="w-10 h-10 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
            <div className="text-zinc-400 font-semibold uppercase tracking-[0.4em] text-[10px]">Loading Metrics...</div>
        </div>
    );

    const Metric = ({ icon: Icon, label, value, suffix = '' }: any) => (
        <div className="bg-white border border-zinc-200 p-6 rounded-lg shadow-sm space-y-2">
            <div className="flex items-center gap-2 text-zinc-400">
                <Icon size={16} /><span className="text-[10px] font-semibold uppercase tracking-widest">{label}</span>
            </div>
            <div className="text-3xl font-bold text-zinc-900 tracking-tighter">{value}{suffix}</div>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto p-8 space-y-8">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Executive Overview</h1>
                    <p className="text-xs text-zinc-500 mt-1">Real-time operational intelligence</p>
                </div>
                <div className="flex items-center gap-3">
                    <select value={dateRange} onChange={e => setDateRange(e.target.value)} className="input-stark">
                        {["Today", "This Week", "This Month", "3 Months", "6 Months", "All Time"].map(o => (
                            <option key={o} value={o}>{o}</option>
                        ))}
                    </select>
                    <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2.5 border border-zinc-300 rounded-lg text-xs font-semibold uppercase tracking-widest text-zinc-600 hover:bg-zinc-50">
                        <Download size={14} /> Export
                    </button>
                </div>
            </header>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-4 gap-4">
                <Metric icon={TrendingUp} label="Total Sold" value={data.total_sold} />
                <Metric icon={Package} label="Warehouse Flux" value={data.warehouse_outflow} />
                <Metric icon={Wrench} label="Active Repairs" value={data.active_repairs} />
                <Metric icon={AlertTriangle} label="Low Stock Parts" value={data.low_stock_parts} />
            </div>

            <div className="grid grid-cols-4 gap-4">
                <Metric icon={DollarSign} label="Revenue" value={`$${data.total_revenue.toLocaleString()}`} />
                <Metric icon={DollarSign} label="Gross Margin" value={`$${data.gross_margin.toLocaleString()}`} suffix={` (${data.gross_margin_pct}%)`} />
                <Metric icon={Clock} label="Avg Velocity" value={data.inventory_velocity_days} suffix=" days" />
                <Metric icon={AlertTriangle} label="Shrinkage" value={data.shrinkage_pct} suffix="%" />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-zinc-200 p-6 rounded-lg shadow-sm">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-4">Sales by Location</h2>
                    {Object.entries(data.sales_by_location).map(([store, count]) => (
                        <div key={store} className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider py-2 border-b border-zinc-100 last:border-0">
                            <span className="text-zinc-500">{store.replace(/_/g, ' ')}</span>
                            <span className="text-zinc-900 font-bold">{count as number}</span>
                        </div>
                    ))}
                </div>
                <div className="bg-white border border-zinc-200 p-6 rounded-lg shadow-sm">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-4">Top Selling Models</h2>
                    <table className="w-full">
                        <tbody>
                            {data.top_selling_models.map((item: any, idx: number) => (
                                <tr key={idx} className="border-b border-zinc-100 last:border-0 text-xs">
                                    <td className="py-2.5 font-semibold uppercase tracking-wider text-zinc-700">{item.model_number}</td>
                                    <td className="py-2.5 text-right font-bold text-zinc-900">{item.count}</td>
                                </tr>
                            ))}
                            {data.top_selling_models.length === 0 && (
                                <tr><td colSpan={2} className="py-8 text-center text-zinc-300 font-semibold uppercase">No data</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Summary stats footer */}
            <div className="text-center text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                {data.total_devices} total devices in inventory | Parts consumed: ${data.parts_cost_consumed.toFixed(2)}
            </div>
        </div>
    );
}
