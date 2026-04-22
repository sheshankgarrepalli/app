import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Search, ChevronLeft, ChevronRight, MapPin, Edit2, History } from 'lucide-react';
import EditDeviceModal from '../components/EditDeviceModal';

export default function CentralInventory() {
  const { token } = useAuth();
  const [, setSearchParams] = useSearchParams();
  const [inventory, setInventory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');

  // Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get((import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/inventory/central', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInventory(res.data);
    } catch (err) {
      console.error("Fetch inventory error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.imei.includes(searchQuery) ||
      item.model_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.serial_number?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || item.device_status === statusFilter;
    const matchesLocation = locationFilter === 'All' || item.location_id === locationFilter;
    return matchesSearch && matchesStatus && matchesLocation;
  });

  const totalPages = Math.ceil(filteredInventory.length / itemsPerPage);
  const paginatedItems = filteredInventory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Sellable':
        return <span className="badge-glow badge-success">Sellable</span>;
      case 'Sold':
        return <span className="badge-glow badge-neutral">Sold</span>;
      case 'In_Repair':
        return <span className="badge-glow badge-warning">In Repair</span>;
      case 'In_QC':
        return <span className="badge-glow badge-warning">In QC</span>;
      default:
        return <span className="badge-glow badge-neutral">{status.replace('_', ' ')}</span>;
    }
  };

  const handleEdit = (device: any) => {
    setSelectedDevice(device);
    setIsEditModalOpen(true);
  };

  const handleViewTracker = (imei: string) => {
    setSearchParams({ tab: 'tracker', query: imei });
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50">

      {/* HEADER & FILTERS */}
      <header className="p-6 bg-white border-b border-zinc-200 space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-lg font-bold text-zinc-900">Asset Repository</h1>
            <p className="text-xs text-zinc-500 mt-1">Global inventory & specification tracking</p>
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
              <input
                type="text"
                placeholder="Search assets..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input-stark pl-9 w-64"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="input-stark cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Sellable">Sellable</option>
              <option value="In_QC">In QC</option>
              <option value="In_Repair">In Repair</option>
              <option value="Sold">Sold</option>
            </select>
            <select
              value={locationFilter}
              onChange={e => setLocationFilter(e.target.value)}
              className="input-stark cursor-pointer"
            >
              <option value="All">All Locations</option>
              <option value="Warehouse_Alpha">Warehouse</option>
              <option value="Store_A">Store A</option>
              <option value="Store_B">Store B</option>
            </select>
          </div>
        </div>
      </header>

      {/* DATA GRID */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse table-fixed">
            <thead className="bg-zinc-50/50 border-b border-zinc-200">
              <tr className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">
                <th className="px-6 py-4 w-48">Model</th>
                <th className="px-6 py-4 w-48">Identifier</th>
                <th className="px-6 py-4 w-40">Specs</th>
                <th className="px-6 py-4 w-32">Status</th>
                <th className="px-6 py-4 w-40">Location</th>
                <th className="px-6 py-4 w-28 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {isLoading ? (
                <tr><td colSpan={6} className="py-32 text-center text-zinc-400 animate-pulse font-medium">Initializing Stream...</td></tr>
              ) : paginatedItems.map(item => (
                <tr key={item.imei} className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-zinc-900 font-bold text-xs uppercase tracking-tight">{item.model_number}</div>
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">{item.model.brand}</div>
                  </td>
                  <td className="px-6 py-4">
                    <button onClick={() => handleViewTracker(item.imei)} className="text-zinc-900 hover:underline block truncate font-mono text-xs font-bold tracking-widest">
                      {item.imei}
                    </button>
                    <div className="text-[10px] text-zinc-400 font-bold mt-0.5 uppercase tracking-widest">{item.serial_number || 'NO SERIAL'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      <span className="bg-zinc-50 text-zinc-600 px-2 py-0.5 rounded text-[10px] font-bold border border-zinc-200 uppercase">{item.model.storage_gb}GB</span>
                      <span className="bg-zinc-50 text-zinc-600 px-2 py-0.5 rounded text-[10px] font-bold border border-zinc-200 uppercase">{item.model.color}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(item.device_status)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-zinc-700 font-bold uppercase text-[10px] tracking-widest">
                      <MapPin size={12} className="text-zinc-400" />
                      {item.location_id.replace('_', ' ')}
                    </div>
                    <div className="text-[10px] text-zinc-400 font-bold mt-0.5 ml-5 uppercase tracking-widest">{item.sub_location_bin || 'UNBINNED'}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(item)}
                        title="Edit Asset"
                        className="text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded p-1.5 transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleViewTracker(item.imei)}
                        title="View Timeline"
                        className="text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded p-1.5 transition-colors"
                      >
                        <History size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAGINATION */}
      <footer className="p-4 bg-white border-t border-zinc-200 flex justify-between items-center">
        <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
          {filteredInventory.length} Assets Identified
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1.5 border border-zinc-200 bg-white text-zinc-500 hover:text-zinc-900 disabled:opacity-30 transition-all rounded-md shadow-sm"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs font-bold text-zinc-900 uppercase tracking-widest">Page {currentPage} of {totalPages || 1}</span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="p-1.5 border border-zinc-200 bg-white text-zinc-500 hover:text-zinc-900 disabled:opacity-30 transition-all rounded-md shadow-sm"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </footer>

      <EditDeviceModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        device={selectedDevice}
        onSuccess={fetchInventory}
      />
    </div>
  );
}
