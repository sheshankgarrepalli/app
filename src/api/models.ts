import { useState, useCallback, useEffect } from 'react';
import api from '../api/api';

export interface PhoneModel {
  model_number: string;
  brand: string;
  name: string;
  color: string | null;
  storage_gb: number;
}

export async function fetchModels(search?: string, brand?: string, deviceType?: string): Promise<PhoneModel[]> {
  const params: Record<string, string> = {};
  if (search) params.search = search;
  if (brand) params.brand = brand;
  if (deviceType) params.device_type = deviceType;
  const { data } = await api.get('/api/models/', { params });
  return data;
}

export async function fetchBrands(): Promise<string[]> {
  const { data } = await api.get('/api/models/brands');
  return data;
}

export async function createModel(model: PhoneModel): Promise<PhoneModel> {
  const { data } = await api.post('/api/models/', model);
  return data;
}

export async function updateModel(modelNumber: string, model: PhoneModel): Promise<PhoneModel> {
  const { data } = await api.put(`/api/models/${encodeURIComponent(modelNumber)}`, model);
  return data;
}

export async function deleteModel(modelNumber: string): Promise<void> {
  await api.delete(`/api/models/${encodeURIComponent(modelNumber)}`);
}

export default function useModels() {
  const [models, setModels] = useState<PhoneModel[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (search?: string, brand?: string) => {
    setLoading(true);
    try {
      const [m, b] = await Promise.all([fetchModels(search, brand), fetchBrands()]);
      setModels(m);
      setBrands(b);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { models, brands, loading, reload: load };
}
