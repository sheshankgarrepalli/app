import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { PackageOpen, MapPin, Clock } from 'lucide-react';

export default function StoreInventory() {
  const { token, user } = useAuth();
  const [inventory, setInventory] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get((import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/inventory/store', { headers: { Authorization: `Bearer ${token}` } });
      setInventory(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTransfers = async () => {
    try {
      const res = await axios.get((import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/transfers/', { headers: { Authorization: `Bearer ${token}` } });
      setTransfers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchInventory();
    fetchTransfers();
  }, [token]);

  const handleReceiveBatch = async (transferId: string) => {
    try {
      await axios.post(`http://localhost:8000/api/transfers/${transferId}/receive`, {}, { headers: { Authorization: `Bearer ${token}` } });
      fetchInventory();
      fetchTransfers();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Error receiving transfer order");
    }
  };

  const incomingTransfers = transfers.filter(t => t.status === 'In_Transit' && t.destination_location_id === (user?.role === 'admin' ? t.destination_location_id : user?.role));

  const getStatusBadge = (status: string) => {
    if (status === 'Sellable') {
      return <span className="badge-glow badge-success">Sellable</span>;
    }
    return <span className="badge-glow badge-neutral">{status.replace('_', ' ')}</span>;
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50 p-8 space-y-12">
      {user?.role !== 'admin' && incomingTransfers.length > 0 && (
        <section className="bg-indigo-50 border border-indigo-100 p-8 rounded-lg space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 shadow-sm">
          <div className="flex items-center gap-3">
            <PackageOpen size={24} className="text-indigo-600" />
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-900">Incoming Transfer Batches</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {incomingTransfers.map((t: any) => (
              <div key={t.id} className="bg-white p-6 rounded-lg flex justify-between items-center border border-indigo-100 hover:border-indigo-300 transition-colors shadow-sm">
                <div>
                  <div className="text-xs font-mono font-bold text-zinc-900 tracking-widest uppercase">{t.id}</div>
                  <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mt-1">
                    {t.transfer_type.replace('_', ' ')} • {new Date(t.created_at).toLocaleDateString()}
                  </div>
                </div>
                <button onClick={() => handleReceiveBatch(t.id)} className="btn-primary px-4 py-2 text-xs uppercase tracking-widest">
                  Acknowledge
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="flex-1 flex flex-col min-h-0">
        <header className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">
              {user?.role === 'admin' ? "Global Stock Ledger" : "Local Inventory"}
            </h1>
            <p className="text-xs text-zinc-500 mt-1">Real-time asset tracking & status monitoring</p>
          </div>
        </header>

        <div className="flex-1 overflow-auto relative bg-white border border-zinc-200 rounded-lg shadow-sm">
          <table className="w-full text-left border-collapse table-fixed">
            <thead className="sticky top-0 bg-zinc-50/50 backdrop-blur-md z-10 border-b border-zinc-200">
              <tr className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">
                <th className="px-8 py-4 w-48">Asset Identifier</th>
                <th className="px-8 py-4 w-48">Model Specification</th>
                <th className="px-8 py-4 w-40">Location Node</th>
                <th className="px-8 py-4 w-32">Status</th>
                <th className="px-8 py-4 w-48">Acquisition Date</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {isLoading ? (
                <tr><td colSpan={5} className="py-32 text-center text-zinc-400 animate-pulse font-medium">Synchronizing Ledger...</td></tr>
              ) : inventory.length === 0 ? (
                <tr><td colSpan={5} className="py-32 text-center text-zinc-300 font-semibold uppercase tracking-widest">No assets identified in this node</td></tr>
              ) : inventory.map((item: any) => (
                <tr key={item.imei} className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors group">
                  <td className="px-8 py-5 font-mono font-bold text-zinc-900 tracking-widest uppercase text-xs">{item.imei}</td>
                  <td className="px-8 py-5 text-zinc-700 font-semibold uppercase tracking-wider">{item.model_number}</td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2 text-zinc-500 uppercase tracking-widest text-[10px] font-bold">
                      <MapPin size={12} className="text-zinc-300" />
                      {item.location_id.replace('_', ' ')}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    {getStatusBadge(item.device_status)}
                  </td>
                  <td className="px-8 py-5 text-zinc-500 font-medium uppercase tracking-widest">
                    <div className="flex items-center gap-2">
                      <Clock size={12} />
                      {new Date(item.received_date).toLocaleString()}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
