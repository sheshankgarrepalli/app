import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { } from 'lucide-react';

export default function RepairDashboard() {
  const { token } = useAuth();
  const [inventory, setInventory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get((import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/inventory/store', { headers: { Authorization: `Bearer ${token}` } });
      setInventory(res.data);
    } catch (err) {
      console.error("Fetch repair inventory error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [token]);

  const handleCompleteRepair = async (imei: string) => {
    try {
      await axios.post(`/api/inventory/repair/${imei}/complete`, {}, { headers: { Authorization: `Bearer ${token}` } });
      fetchInventory();
    } catch (err: any) {
      console.error("Complete repair error:", err.response?.data);
      alert(err.response?.data?.detail || "Error completing repair");
    }
  };

  const getStatusBadge = (status: string) => {
    return <span className="badge-glow badge-warning">{status.replace('_', ' ')}</span>;
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50">
      <header className="p-6 bg-white border-b border-zinc-200 space-y-6">
        <div>
          <h1 className="text-lg font-bold text-zinc-900">Repair Pipeline</h1>
          <p className="text-xs text-zinc-500 mt-1">Technical service & maintenance queue</p>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse table-fixed">
            <thead className="bg-zinc-50/50 border-b border-zinc-200">
              <tr className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">
                <th className="px-8 py-4 w-48">Asset Identifier</th>
                <th className="px-8 py-4 w-48">Model</th>
                <th className="px-6 py-4 w-32">Status</th>
                <th className="px-8 py-4 w-48">Assignment Date</th>
                <th className="px-8 py-4 w-32 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {isLoading ? (
                <tr><td colSpan={5} className="py-32 text-center text-zinc-400 animate-pulse font-medium">Loading Queue...</td></tr>
              ) : inventory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-32 text-center">
                    <div className="text-xs font-semibold uppercase tracking-widest text-zinc-300">No active repair assignments identified</div>
                  </td>
                </tr>
              ) : (
                inventory.map((item: any) => (
                  <tr key={item.imei} className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors group">
                    <td className="px-8 py-4 font-mono font-bold text-zinc-900 tracking-widest uppercase text-xs">
                      {item.imei}
                    </td>
                    <td className="px-8 py-4">
                      <div className="text-zinc-700 font-bold uppercase tracking-wider text-xs">{item.model_number}</div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(item.device_status)}
                    </td>
                    <td className="px-8 py-4 text-zinc-500 font-medium uppercase tracking-widest">
                      {new Date(item.received_date).toLocaleString()}
                    </td>
                    <td className="px-8 py-4 text-right">
                      <button
                        onClick={() => handleCompleteRepair(item.imei)}
                        className="btn-primary px-4 py-2 text-xs font-semibold uppercase tracking-widest"
                      >
                        Finalize
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
