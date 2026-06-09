import api from './api';

export interface DashboardSnapshot {
  total_sold: number;
  sales_by_location: Record<string, number>;
  warehouse_outflow: number;
  top_selling_models: Array<{ model_number: string; count: number }>;
  gross_margin: number;
  gross_margin_pct: number;
  total_revenue: number;
  total_cost: number;
  inventory_velocity_days: number;
  shrinkage_pct: number;
  parts_cost_consumed: number;
  active_repairs: number;
  low_stock_parts: number;
  total_devices: number;
  sellable_devices: number;
}

export interface TimeSeriesPoint {
  date: string;
  count?: number;
  amount?: number;
}

export interface TimeSeriesData {
  sales: TimeSeriesPoint[];
  revenue: TimeSeriesPoint[];
  inventory_levels: TimeSeriesPoint[];
}

export async function fetchDashboard(dateRange: string, storeId?: string): Promise<DashboardSnapshot> {
  const params: Record<string, string> = { date_range: dateRange };
  if (storeId) params.store_id = storeId;
  const { data } = await api.get('/api/reports/dashboard', { params });
  return data;
}

export async function fetchTimeSeries(dateRange: string, storeId?: string): Promise<TimeSeriesData> {
  const params: Record<string, string> = { date_range: dateRange };
  if (storeId) params.store_id = storeId;
  const { data } = await api.get('/api/reports/dashboard/timeseries', { params });
  return data;
}

export async function exportDashboardCSV(dateRange: string): Promise<void> {
  const response = await api.get('/api/reports/dashboard/export', {
    params: { date_range: dateRange },
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `dashboard_export_${dateRange.replace(/\s+/g, '_').toLowerCase()}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
