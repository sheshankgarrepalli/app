import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Search, Info, History, DollarSign, User, Clock, MapPin, Activity, ArrowRight } from 'lucide-react';
import DeviceStatusTransition from '../components/DeviceStatusTransition';

export default function TrackDevice() {
  const { token, user } = useAuth();
  const [imei, setImei] = useState('');
  const [serial, setSerial] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const q = searchParams.get('query');
    if (q) {
      setImei(q);
      performSearch(q);
    }
  }, [searchParams]);

  const performSearch = async (identifier: string) => {
    if (!identifier) return;
    try {
      const res = await axios.get(`/api/track/?identifier=${identifier}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResult(res.data);
    } catch (err: any) {
      setResult(null);
      setError(err.response?.data?.detail || "Device not found");
    }
  };

  const handleImeiSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(imei);
  };

  const handleSerialSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(serial);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-[#0a0a0b]">
      <header className="p-6 bg-white dark:bg-[#141416] border-b border-zinc-200 dark:border-[#1f1f21] flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-[#e4e4e7]">Asset Intelligence</h1>
          <p className="text-xs text-zinc-500 dark:text-[#71717a] mt-1">Lifecycle tracking & cost reconciliation</p>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* LEFT COLUMN: SEARCH & OVERVIEW */}
        <div className="col-span-4 bg-white dark:bg-[#141416] border-r border-zinc-200 dark:border-[#1f1f21] p-6 space-y-12 overflow-y-auto">
          <section className="space-y-8">
            <div className="space-y-6">
              <form onSubmit={handleImeiSearch} className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-[#71717a] ml-1">IMEI Identifier</label>
                <div className="relative group">
                  <input
                    type="text"
                    placeholder="Enter 15-digit IMEI..."
                    value={imei}
                    onChange={e => setImei(e.target.value)}
                    className="input-stark w-full py-4 text-sm font-bold tracking-widest uppercase"
                  />
                  <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-[#a1a1aa] group-focus-within:text-zinc-900 dark:text-[#e4e4e7] transition-colors">
                    <Search size={18} />
                  </button>
                </div>
              </form>

              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-zinc-100"></div>
                <span className="text-[10px] font-bold text-zinc-300 dark:text-[#52525b] uppercase tracking-widest">OR</span>
                <div className="h-px flex-1 bg-zinc-100"></div>
              </div>

              <form onSubmit={handleSerialSearch} className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-[#71717a] ml-1">Serial Number</label>
                <div className="relative group">
                  <input
                    type="text"
                    placeholder="Enter serial number..."
                    value={serial}
                    onChange={e => setSerial(e.target.value)}
                    className="input-stark w-full py-4 text-sm font-bold tracking-widest uppercase"
                  />
                  <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-[#a1a1aa] group-focus-within:text-zinc-900 dark:text-[#e4e4e7] transition-colors">
                    <Search size={18} />
                  </button>
                </div>
              </form>
            </div>
            {error && <div className="p-4 bg-rose-50 text-rose-600 text-xs font-semibold uppercase tracking-widest border border-rose-100 rounded-lg">{error}</div>}
          </section>

          {result && (
            <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-3 border-b border-zinc-100 dark:border-[#1a1a1c] pb-4">
                <Info size={16} className="text-zinc-400 dark:text-[#a1a1aa]" />
                <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-[#71717a]">Asset Specification</h2>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-[#a1a1aa] block mb-1">Brand</label>
                    <div className="text-sm font-bold uppercase text-zinc-900 dark:text-[#e4e4e7]">{result.device.model?.brand || 'Unbound'}</div>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-[#a1a1aa] block mb-1">Model</label>
                    <div className="text-sm font-bold uppercase text-zinc-900 dark:text-[#e4e4e7]">{result.device.model?.name || 'Pending Identification'}</div>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-[#a1a1aa] block mb-1">Storage</label>
                    <div className="text-sm font-bold uppercase text-zinc-900 dark:text-[#e4e4e7]">{result.device.model?.storage_gb ? `${result.device.model.storage_gb}GB` : 'N/A'}</div>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-[#a1a1aa] block mb-1">Color</label>
                    <div className="text-sm font-bold uppercase text-zinc-900 dark:text-[#e4e4e7]">{result.device.model?.color || 'N/A'}</div>
                  </div>
                </div>

                <div className="p-6 bg-zinc-50 dark:bg-[#0a0a0b] border border-zinc-200 dark:border-[#1f1f21] rounded-lg space-y-4 shadow-sm">
                  {!result.device.is_hydrated && (
                    <div className="bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-lg flex items-center gap-2">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400">Model metadata not yet bound to this device</span>
                    </div>
                  )}
                  <div className="flex justify-between items-start">
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-[#a1a1aa] block mb-1">Current Node</label>
                      <div className="text-xs font-bold uppercase flex items-center gap-2 text-zinc-900 dark:text-[#e4e4e7]">
                        <MapPin size={14} className="text-zinc-400 dark:text-[#a1a1aa]" />
                        {result.device.location_id?.replace('_', ' ')}
                      </div>
                    </div>
                    <div className="text-right">
                      <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-[#a1a1aa] block mb-1">Status</label>
                      <DeviceStatusTransition device={result.device} onTransitionComplete={() => performSearch(result.device.imei)} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-[#a1a1aa] block mb-1">Sub-Location / Bin</label>
                    <div className="text-xs font-bold uppercase tracking-widest text-zinc-700 dark:text-[#e4e4e7]">{result.device.sub_location_bin || 'UNASSIGNED'}</div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* RIGHT COLUMN: TIMELINE & COSTS */}
        <div className="col-span-8 flex flex-col bg-zinc-50 dark:bg-[#0a0a0b] overflow-hidden">
          {result ? (
            <div className="flex-1 overflow-y-auto p-12 space-y-16">
              {/* IMMUTABLE TIMELINE */}
              <section className="space-y-12">
                <div className="flex items-center gap-3 border-b border-zinc-200 dark:border-[#1f1f21] pb-4">
                  <History size={16} className="text-zinc-400 dark:text-[#a1a1aa]" />
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-[#71717a]">Lifecycle Audit Trail</h2>
                </div>

                <div className="relative pl-8 space-y-12">
                  <div className="absolute left-[3px] top-2 bottom-2 w-px bg-zinc-200"></div>
                  {result.timeline.map((log: any, i: number) => (
                    <div key={i} className="relative">
                      <div className="absolute -left-[33px] top-1.5 w-2 h-2 bg-zinc-900 rounded-full border-4 border-zinc-50 shadow-sm"></div>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="text-xs font-bold uppercase tracking-widest text-zinc-900 dark:text-[#e4e4e7]">{log.action_type.replace(/_/g, ' ')}</div>
                          <div className="text-[10px] font-semibold text-zinc-400 dark:text-[#a1a1aa] uppercase tracking-widest flex items-center gap-2 mt-1">
                            <Clock size={12} /> {new Date(log.timestamp).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-[#a1a1aa] flex items-center gap-1">
                          <User size={12} /> {log.employee_id}
                        </div>
                      </div>
                      <div className="text-sm font-medium text-zinc-600 dark:text-[#a1a1aa] uppercase tracking-tight leading-relaxed max-w-2xl">
                        {log.notes || 'No additional telemetry recorded for this action.'}
                      </div>
                      <div className="mt-4 flex gap-4">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-[#a1a1aa]">
                          Transition: <span className="text-zinc-900 dark:text-[#e4e4e7]">{log.previous_status || 'INIT'}</span> <ArrowRight size={10} className="inline mx-1" /> <span className="text-zinc-900 dark:text-[#e4e4e7]">{log.new_status}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* TRUE COST LEDGER (ADMIN ONLY) */}
              {user?.role === 'admin' && (
                <section className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                  <div className="flex items-center gap-3 border-b border-zinc-200 dark:border-[#1f1f21] pb-4">
                    <DollarSign size={16} className="text-zinc-400 dark:text-[#a1a1aa]" />
                    <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-[#71717a]">True Cost Ledger</h2>
                  </div>

                  <div className="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#1f1f21] rounded-lg shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-zinc-50 dark:bg-[#0a0a0b]/50 border-b border-zinc-200 dark:border-[#1f1f21]">
                        <tr className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 dark:text-[#71717a]">
                          <th className="px-8 py-4">Cost Classification</th>
                          <th className="px-8 py-4">Reconciliation Date</th>
                          <th className="px-8 py-4 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {result.cost_ledger.map((entry: any, i: number) => (
                          <tr key={i} className="border-b border-zinc-100 dark:border-[#1a1a1c] hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] dark:bg-[#0a0a0b]/50 transition-colors">
                            <td className="px-8 py-5 text-zinc-700 dark:text-[#e4e4e7] font-semibold uppercase tracking-wider">{entry.cost_type}</td>
                            <td className="px-8 py-5 text-zinc-400 dark:text-[#a1a1aa] font-semibold uppercase tracking-widest">{new Date(entry.created_at).toLocaleDateString()}</td>
                            <td className="px-8 py-5 text-right text-zinc-900 dark:text-[#e4e4e7] font-bold">${entry.amount.toFixed(2)}</td>
                          </tr>
                        ))}
                        <tr className="bg-zinc-900 text-white">
                          <td colSpan={2} className="px-8 py-6 font-bold uppercase tracking-[0.2em] text-xs">Total Asset Valuation</td>
                          <td className="px-8 py-6 text-right font-bold text-xl tracking-tighter">
                            ${result.cost_ledger.reduce((acc: number, curr: any) => acc + curr.amount, 0).toFixed(2)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-zinc-300 dark:text-[#52525b] py-32">
              <Activity size={80} className="opacity-10 mb-6" />
              <div className="text-xs font-semibold uppercase tracking-[0.5em] opacity-40">System Awaiting Identifier</div>
              <p className="text-[10px] font-bold text-zinc-400 dark:text-[#a1a1aa] uppercase tracking-widest mt-4">Enter IMEI or Serial to initialize telemetry</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
