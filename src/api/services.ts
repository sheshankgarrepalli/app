import api from './api';

export interface ServiceItem {
  id: number;
  name: string;
  category: string | null;
  default_price: number;
  is_active: boolean;
}

export async function fetchServices(category?: string): Promise<ServiceItem[]> {
  const params: Record<string, string> = {};
  if (category) params.category = category;
  const { data } = await api.get('/api/services/', { params });
  return data;
}

export async function fetchServiceCategories(): Promise<string[]> {
  const { data } = await api.get('/api/services/categories');
  return data;
}

export async function createService(req: { name: string; category?: string; default_price: number }): Promise<ServiceItem> {
  const { data } = await api.post('/api/services/', req);
  return data;
}

export async function updateService(id: number, req: Partial<ServiceItem>): Promise<ServiceItem> {
  const { data } = await api.put(`/api/services/${id}`, req);
  return data;
}

export async function deleteService(id: number): Promise<void> {
  await api.delete(`/api/services/${id}`);
}
