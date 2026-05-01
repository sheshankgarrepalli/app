import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Wrench, Download, TrendingUp } from 'lucide-react';

const DATE_RANGES = ['Today', 'This Week', 'This Month', '3 Months', '6 Months', 'All Time'];

export default function AdminDashboard() {
    const { token } = useAuth();
    const API = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000');
    const [dateRange, setDateRange] = useState('This Month');
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => { fetchDashboard(); }, [dateRange, token]);

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
        <div className="flex flex-col items-center justify-center h-96 text-center card p-8">
            <div className="text-red-500 font-semibold text-lg mb-2">Service Interruption</div>
            <p className="text-[#6b7280] dark:text-[#71717a] text-sm max-w-md mb-6">{error}</p>
            <button onClick={fetchDashboard} className="btn-primary px-8 py-3">Retry</button>
        </div>
    );

    if (!data) return (
        <div className="flex flex-col items-center justify-center h-96 gap-4">
            <div className="w-10 h-10 border-2 border-[#e5e7eb] dark:border-[#1f1f21] border-t-accent rounded-full animate-spin" />
            <div className="text-[#6b7280] dark:text-[#71717a] text-sm">Loading Metrics...</div>
        </div>
    );

    const locationSales = data.sales_by_location || {};
    const locationEntries: [string, number][] = Object.entries(locationSales);
    const maxSales = Math.max(...locationEntries.map(([,v]) => v as number), 1);

    const barColors = ['bg-accent', 'bg-success', 'bg-navy'];

    return (
        <div className="space-y-6 max-w-7xl">
            {/* Header */}
            <div className="page-header">
                <h1 className="page-title">Dashboard</h1>
                <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                        {DATE_RANGES.map(d => (
                            <button
                                key={d}
                                className={`date-pill ${d === dateRange ? 'active' : ''}`}
                                onClick={() => setDateRange(d)}
                            >
                                {d}
                            </button>
                        ))}
                    </div>
                    <button onClick={handleExport} className="btn-secondary text-xs">
                        <Download size={14} /> Export CSV
                    </button>
                </div>
            </div>

            {/* KPI Row 1 */}
            <div className="grid grid-cols-4 gap-4">
                <div className="kpi-card">
                    <div className="kpi-label">Total Revenue</div>
                    <div className="kpi-value">${(data.total_revenue || 0).toLocaleString()}</div>
                    <div className="kpi-change up">
                        <TrendingUp size={12} className="inline" /> {data.total_sold} units sold
                    </div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Gross Margin</div>
                    <div className="kpi-value">{data.gross_margin_pct || 0}%</div>
                    <div className="kpi-change up">${(data.gross_margin || 0).toLocaleString()} profit</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Active Repairs</div>
                    <div className="kpi-value">{data.active_repairs || 0}</div>
                    <div className="kpi-change" style={{color: '#f59e0b'}}>
                        <Wrench size={12} className="inline" /> {data.low_stock_parts || 0} awaiting parts
                    </div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Low Stock Parts</div>
                    <div className="kpi-value">{data.low_stock_parts || 0}</div>
                    <div className="kpi-change down">Reorder needed</div>
                </div>
            </div>

            {/* Two column layout */}
            <div className="grid grid-cols-2 gap-4">
                {/* Sales by Location */}
                <div className="card">
                    <div className="card-header">Sales by Location</div>
                    <div className="card-body">
                        <div className="flex items-end gap-8 h-40 px-3">
                            {locationEntries.map(([store, count], i) => (
                                <div key={store} className="flex flex-col items-center gap-2 flex-1">
                                    <span className="text-sm font-semibold">{count as number}</span>
                                    <div
                                        className={`w-12 rounded-t-md ${barColors[i % 3]}`}
                                        style={{ height: `${((count as number) / maxSales) * 140}px`, transition: 'height 0.3s' }}
                                    />
                                    <span className="text-[11px] text-[#6b7280] dark:text-[#71717a] capitalize">{store.replace(/_/g, ' ')}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Top Selling Models */}
                <div className="card">
                    <div className="card-header">Top Selling Models</div>
                    <div className="p-0">
                        <table className="table-standard">
                            <thead>
                                <tr><th>Model</th><th className="text-right">Units Sold</th></tr>
                            </thead>
                            <tbody>
                                {(data.top_selling_models || []).map((item: any, idx: number) => (
                                    <tr key={idx}>
                                        <td className="font-medium">{item.model_number}</td>
                                        <td className="text-right font-semibold">{item.count}</td>
                                    </tr>
                                ))}
                                {(!data.top_selling_models || data.top_selling_models.length === 0) && (
                                    <tr><td colSpan={2} className="text-center text-[#6b7280] dark:text-[#71717a] py-8">No data for this period</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* KPI Row 2 */}
            <div className="grid grid-cols-4 gap-4">
                <div className="kpi-card">
                    <div className="kpi-label">Inventory Velocity</div>
                    <div><span className="text-xl font-bold">{data.inventory_velocity_days || 0}</span> <span className="text-sm text-[#6b7280] dark:text-[#71717a]">days avg</span></div>
                    <div className="text-xs text-[#6b7280] dark:text-[#71717a]">Intake to sale turnaround</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Shrinkage Rate</div>
                    <div className="kpi-value">{data.shrinkage_pct || 0}%</div>
                    <div className="text-xs text-[#6b7280] dark:text-[#71717a]">{data.total_devices || 0} total devices tracked</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Parts Consumed</div>
                    <div className="kpi-value">${(data.parts_cost_consumed || 0).toLocaleString()}</div>
                    <div className="text-xs text-[#6b7280] dark:text-[#71717a]">This period</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Warehouse Outflow</div>
                    <div className="kpi-value">{data.warehouse_outflow || 0}</div>
                    <div className="text-xs text-[#6b7280] dark:text-[#71717a]">Transfer orders dispatched</div>
                </div>
            </div>
        </div>
    );
}
