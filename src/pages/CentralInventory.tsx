import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  Search, ChevronLeft, ChevronRight, MapPin, Edit2, History,
  PackageOpen, TrendingUp, Smartphone, AlertTriangle
} from 'lucide-react';
import EditDeviceModal from '../components/EditDeviceModal';
import DeviceStatusTransition from '../components/DeviceStatusTransition';

export default function CentralInventory() {
  const { token, user } = useAuth();
  const [, setSearchParams] = useSearchParams();
  const API = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000');
  const [inventory, setInventory] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${API}/api/inventory/central`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInventory(res.data);
    } catch (_) {} finally {
      setIsLoading(false);
    }
  };

  const fetchTransfers = async () => {
    try {
      const res = await axios.get(`${API}/api/transfers/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTransfers(res.data);
    } catch (_) {}
  };

  useEffect(() => {
    fetchInventory();
    fetchTransfers();
  }, [token]);

  const handleReceiveBatch = async (transferId: string) => {
    try {
      await axios.post(`${API}/api/transfers/${transferId}/receive`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchInventory();
      fetchTransfers();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Error receiving transfer');
    }
  };

  const incomingTransfers = transfers.filter(
    t => t.status === 'In_Transit' &&
    t.destination_location_id === (user?.role === 'admin' ? t.destination_location_id : user?.role)
  );

  const filtered = inventory.filter(item => {
    const matchesSearch = !searchQuery || item.imei.includes(searchQuery) ||
      item.model_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.serial_number?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || item.device_status === statusFilter;
    const matchesLocation = locationFilter === 'All' || item.location_id === locationFilter;
    return matchesSearch && matchesStatus && matchesLocation;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Aggregates for bento KPIs
  const sellable = inventory.filter(i => i.device_status === 'Sellable').length;
  const inRepair = inventory.filter(i => ['In_Repair', 'In_QC'].includes(i.device_status)).length;
  const sold = inventory.filter(i => i.device_status === 'Sold').length;


  const handleEdit = (device: any) => {
    setSelectedDevice(device);
    setIsEditModalOpen(true);
  };

  const handleViewTracker = (imei: string) => {
    setSearchParams({ tab: 'tracker', query: imei });
  };

  return (
    <div className="space-y-4">
      {/* Incoming transfers */}
      {incomingTransfers.length > 0 && (
        <div className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <PackageOpen size={18} className="text-accent" />
            <h2 className="text-sm font-bold text-[#1f2937] dark:text-[#e4e4e7] uppercase tracking-wider">Incoming Transfer Batches</h2>
            <span className="text-[11px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full">
              {incomingTransfers.length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {incomingTransfers.map((t: any) => (
              <div key={t.id} className="bg-[#f5f5f5] dark:bg-[#1a1a1c] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-lg p-4 flex justify-between items-center hover:border-accent/30 transition-colors">
                <div>
                  <div className="text-xs font-mono font-bold text-[#1f2937] dark:text-[#e4e4e7] tracking-wider">{t.id}</div>
                  <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] mt-1">
                    {t.transfer_type.replace('_', ' ')} &middot; {new Date(t.created_at).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => handleReceiveBatch(t.id)}
                  className="bg-accent hover:bg-accent/90 text-white rounded-lg px-4 py-2 text-xs font-bold transition-colors"
                >
                  Acknowledge
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bento KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl p-4">
          <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] font-semibold uppercase tracking-wider mb-1">Total Assets</div>
          <div className="text-2xl font-bold text-[#1f2937] dark:text-[#e4e4e7]">{inventory.length}</div>
          <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] mt-1 flex items-center gap-1">
            <Smartphone size={12} /> All locations
          </div>
        </div>
        <div className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl p-4">
          <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] font-semibold uppercase tracking-wider mb-1">Sellable</div>
          <div className="text-2xl font-bold text-emerald-400">{sellable}</div>
          <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] mt-1 flex items-center gap-1">
            <TrendingUp size={12} /> Ready for sale
          </div>
        </div>
        <div className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl p-4">
          <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] font-semibold uppercase tracking-wider mb-1">In Repair / QC</div>
          <div className="text-2xl font-bold text-amber-400">{inRepair}</div>
          <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] mt-1 flex items-center gap-1">
            <AlertTriangle size={12} /> Active work orders
          </div>
        </div>
        <div className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl p-4">
          <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] font-semibold uppercase tracking-wider mb-1">Sold</div>
          <div className="text-2xl font-bold text-[#1f2937] dark:text-[#e4e4e7]">{sold}</div>
          <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] mt-1">Completed transactions</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af] dark:text-[#52525b]" size={14} />
          <input
            type="text"
            placeholder="Search by IMEI, model, or serial..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-lg pl-9 pr-4 py-2.5 text-sm text-[#1f2937] dark:text-[#e4e4e7] placeholder-[#9ca3af] dark:placeholder-[#52525b] focus:outline-none focus:border-accent/50 transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-lg px-3 py-2.5 text-sm text-[#1f2937] dark:text-[#e4e4e7] focus:outline-none focus:border-accent/50"
        >
          <option value="All">All Statuses</option>
          <option value="Sellable">Sellable</option>
          <option value="In_QC">In QC</option>
          <option value="In_Repair">In Repair</option>
          <option value="Sold">Sold</option>
        </select>
        <select
          value={locationFilter}
          onChange={e => { setLocationFilter(e.target.value); setCurrentPage(1); }}
          className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-lg px-3 py-2.5 text-sm text-[#1f2937] dark:text-[#e4e4e7] focus:outline-none focus:border-accent/50"
        >
          <option value="All">All Locations</option>
          <option value="Warehouse_Alpha">Warehouse</option>
          <option value="Store_A">Store A</option>
          <option value="Store_B">Store B</option>
          <option value="Store_C">Store C</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-[#6b7280] dark:text-[#71717a] border-b border-[#e5e7eb] dark:border-[#1f1f21]">
              <th className="px-5 py-3">Model</th>
              <th className="px-5 py-3">Identifier</th>
              <th className="px-5 py-3">Specs</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Location</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {isLoading ? (
              <tr><td colSpan={6} className="py-24 text-center text-[#9ca3af] dark:text-[#52525b]">Loading assets...</td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={6} className="py-24 text-center text-[#9ca3af] dark:text-[#52525b]">No assets found</td></tr>
            ) : paginated.map(item => (
              <tr key={item.imei} className="border-b border-[#e5e7eb] dark:border-[#1a1a1c] hover:bg-[#f9fafb] dark:hover:bg-[#1a1a1c] transition-colors">
                <td className="px-5 py-3">
                  <div className="text-[#1f2937] dark:text-[#e4e4e7] font-bold text-xs uppercase tracking-tight">{item.model_number || 'PENDING ID'}</div>
                  <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] mt-0.5">{item.model?.brand || 'Unbound'}</div>
                </td>
                <td className="px-5 py-3">
                  <button onClick={() => handleViewTracker(item.imei)} className="text-[#1f2937] dark:text-[#e4e4e7] hover:text-accent transition-colors font-mono text-xs font-bold tracking-wider">
                    {item.imei}
                  </button>
                  <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] mt-0.5">{item.serial_number || 'NO SERIAL'}</div>
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-1">
                    <span className="bg-white dark:bg-[#0a0a0b] text-[#6b7280] dark:text-[#a1a1aa] px-2 py-0.5 rounded text-[10px] font-bold border border-[#e5e7eb] dark:border-[#1f1f21]">
                      {item.model?.storage_gb ? `${item.model.storage_gb}GB` : 'N/A'}
                    </span>
                    <span className="bg-white dark:bg-[#0a0a0b] text-[#6b7280] dark:text-[#a1a1aa] px-2 py-0.5 rounded text-[10px] font-bold border border-[#e5e7eb] dark:border-[#1f1f21]">
                      {item.model?.color || 'N/A'}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <DeviceStatusTransition device={item} onTransitionComplete={fetchInventory} />
                    {!item.is_hydrated && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Unbound</span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1.5 text-[#6b7280] dark:text-[#a1a1aa] text-xs font-semibold">
                    <MapPin size={12} className="text-[#9ca3af] dark:text-[#52525b]" />
                    {item.location_id?.replace('_', ' ')}
                  </div>
                  <div className="text-[11px] text-[#9ca3af] dark:text-[#52525b] mt-0.5 ml-[18px]">{item.sub_location_bin || 'UNBINNED'}</div>
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex justify-end gap-1 items-center">
                    <DeviceStatusTransition device={item} onTransitionComplete={fetchInventory} variant="button" />
                    <button
                      onClick={() => handleEdit(item)}
                      className="text-[#9ca3af] dark:text-[#52525b] hover:text-[#1f2937] dark:hover:text-[#e4e4e7] hover:bg-white dark:bg-[#0a0a0b] rounded-lg p-1.5 transition-colors"
                      title="Edit metadata"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleViewTracker(item.imei)}
                      className="text-[#9ca3af] dark:text-[#52525b] hover:text-[#1f2937] dark:hover:text-[#e4e4e7] hover:bg-white dark:bg-[#0a0a0b] rounded-lg p-1.5 transition-colors"
                    >
                      <History size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination footer */}
        <div className="flex justify-between items-center px-5 py-3 border-t border-[#e5e7eb] dark:border-[#1f1f21]">
          <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] font-semibold uppercase tracking-wider">
            {filtered.length} assets
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-[#e5e7eb] dark:border-[#1f1f21] text-[#6b7280] dark:text-[#71717a] hover:text-[#1f2937] dark:hover:text-[#e4e4e7] disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-[11px] font-bold text-[#1f2937] dark:text-[#e4e4e7] uppercase tracking-wider">
              Page {currentPage} of {totalPages || 1}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-1.5 rounded-lg border border-[#e5e7eb] dark:border-[#1f1f21] text-[#6b7280] dark:text-[#71717a] hover:text-[#1f2937] dark:hover:text-[#e4e4e7] disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <EditDeviceModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        device={selectedDevice}
        onSuccess={fetchInventory}
      />
    </div>
  );
}
