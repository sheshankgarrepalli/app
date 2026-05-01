import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  Scan, PackageOpen, CheckCircle2, XCircle,
  Clock, Truck, MapPin, Hash, AlertTriangle,
  ChevronRight, ArrowRight
} from 'lucide-react';

interface Manifest {
  manifest_id: string;
  origin_id: string;
  destination_id: string;
  courier_name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ManifestItem {
  imei: string;
  model_number: string | null;
  serial_number: string | null;
  device_status: string | null;
  is_received: boolean;
}

interface ManifestDetail {
  manifest: Manifest;
  items: ManifestItem[];
  total_items: number;
  received_count: number;
}

export default function ReceiveShipment() {
  const { token } = useAuth();
  const API = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000');

  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [selectedManifestId, setSelectedManifestId] = useState<string>('');
  const [manifestDetail, setManifestDetail] = useState<ManifestDetail | null>(null);
  const [isLoadingManifests, setIsLoadingManifests] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Scanner state
  const [scanInput, setScanInput] = useState('');
  const [lastScan, setLastScan] = useState<{ imei: string; status: 'success' | 'error'; message: string } | null>(null);
  const [verifiedImeis, setVerifiedImeis] = useState<Set<string>>(new Set());
  const [isVerifying, setIsVerifying] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const scannerRef = useRef<HTMLInputElement>(null);

  // Fetch incoming manifests
  const fetchManifests = useCallback(async () => {
    setIsLoadingManifests(true);
    try {
      const res = await axios.get(`${API}/api/transfers/manifests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setManifests(res.data);
    } catch (_) {
      setManifests([]);
    } finally {
      setIsLoadingManifests(false);
    }
  }, [token, API]);

  useEffect(() => {
    fetchManifests();
  }, [fetchManifests]);

  // Fetch manifest detail when selected
  const fetchManifestDetail = useCallback(async (manifestId: string) => {
    if (!manifestId) {
      setManifestDetail(null);
      return;
    }
    setIsLoadingDetail(true);
    try {
      const res = await axios.get(`${API}/api/transfers/manifests/${manifestId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setManifestDetail(res.data);
      // Pre-populate verified IMEIs from already received items
      const received = new Set<string>(
        res.data.items.filter((i: ManifestItem) => i.is_received).map((i: ManifestItem) => i.imei)
      );
      setVerifiedImeis(received);
    } catch (_) {
      setManifestDetail(null);
    } finally {
      setIsLoadingDetail(false);
    }
  }, [token, API]);

  useEffect(() => {
    fetchManifestDetail(selectedManifestId);
  }, [selectedManifestId, fetchManifestDetail]);

  // Keep scanner focused
  useEffect(() => {
    const keepFocus = () => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return;
      scannerRef.current?.focus();
    };
    window.addEventListener('click', keepFocus);
    scannerRef.current?.focus();
    return () => window.removeEventListener('click', keepFocus);
  }, []);

  const handleScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const imei = scanInput.trim();
    if (!imei) return;

    if (!selectedManifestId) {
      setNotification({ type: 'error', message: 'Select a manifest first' });
      setScanInput('');
      return;
    }

    if (verifiedImeis.has(imei)) {
      setLastScan({ imei, status: 'error', message: 'Already verified' });
      setScanInput('');
      return;
    }

    setIsVerifying(true);
    try {
      const res = await axios.post(
        `${API}/api/transfers/manifests/${selectedManifestId}/verify`,
        { imeis: [imei], notes: '' },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const result = res.data;
      if (result.verified.length > 0) {
        setVerifiedImeis(prev => new Set([...prev, imei]));
        setLastScan({ imei, status: 'success', message: 'Verified' });
        const total = result.total_manifest_items;
        const verified = result.verified_count;
        if (verified === total) {
          setNotification({ type: 'success', message: 'All items verified. Manifest complete.' });
        }
      } else {
        const rejection = result.rejected[0];
        setLastScan({ imei, status: 'error', message: rejection?.reason || 'Verification failed' });
      }

      // Refresh detail to get updated counts
      fetchManifestDetail(selectedManifestId);
    } catch (err: any) {
      setLastScan({ imei, status: 'error', message: err.response?.data?.detail || 'Verification error' });
    } finally {
      setIsVerifying(false);
      setScanInput('');
      scannerRef.current?.focus();
    }
  };

  // Clear notification after 3s
  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(t);
    }
  }, [notification]);

  // Clear last scan highlight after 2s
  useEffect(() => {
    if (lastScan) {
      const t = setTimeout(() => setLastScan(null), 2000);
      return () => clearTimeout(t);
    }
  }, [lastScan]);

  const manifest = manifestDetail?.manifest;
  const items = manifestDetail?.items || [];
  const totalItems = manifestDetail?.total_items || 0;
  const receivedCount = verifiedImeis.size;
  const progressPercent = totalItems > 0 ? (receivedCount / totalItems) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Smart Receiving Portal</h1>
          <p className="text-xs text-[#6b7280] dark:text-[#71717a] mt-1">
            Manifest verification &bull; Scan IMEIs to receive incoming shipments
          </p>
        </div>
      </div>

      {/* Manifest Selector */}
      <div className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <Truck size={18} className="text-accent" />
          <h2 className="text-sm font-bold text-[#1f2937] dark:text-[#e4e4e7] uppercase tracking-wider">Incoming Manifests</h2>
          {!isLoadingManifests && (
            <span className="text-[11px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full">
              {manifests.length} active
            </span>
          )}
        </div>

        {isLoadingManifests ? (
          <div className="text-xs text-[#9ca3af] dark:text-[#52525b] py-2">Loading manifests...</div>
        ) : manifests.length === 0 ? (
          <div className="text-xs text-[#9ca3af] dark:text-[#52525b] py-2 flex items-center gap-2">
            <Clock size={14} /> No incoming manifests awaiting receipt
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {manifests.map(m => (
              <button
                key={m.manifest_id}
                onClick={() => setSelectedManifestId(m.manifest_id)}
                className={`text-left p-4 rounded-lg border transition-all ${
                  selectedManifestId === m.manifest_id
                    ? 'border-accent bg-accent/5 dark:bg-accent/10'
                    : 'border-[#e5e7eb] dark:border-[#1f1f21] bg-[#f5f5f5] dark:bg-[#1a1a1c] hover:border-accent/30'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-[#1f2937] dark:text-[#e4e4e7] tracking-wider">
                    {m.manifest_id}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    m.status === 'In_Transit'
                      ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {m.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="space-y-1 text-[11px] text-[#6b7280] dark:text-[#71717a]">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={11} /> {m.origin_id?.replace('_', ' ')}
                    <ArrowRight size={11} />
                    <MapPin size={11} /> {m.destination_id?.replace('_', ' ')}
                  </div>
                  {m.courier_name && (
                    <div className="flex items-center gap-1.5">
                      <Truck size={11} /> {m.courier_name}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Clock size={11} /> {new Date(m.created_at).toLocaleDateString()}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {!selectedManifestId ? (
        <div className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl p-16 text-center">
          <div className="flex flex-col items-center gap-4 text-[#d1d5db] dark:text-[#52525b]">
            <PackageOpen size={64} className="opacity-20" />
            <p className="text-xs font-semibold uppercase tracking-widest">Select an incoming manifest to begin verification</p>
          </div>
        </div>
      ) : isLoadingDetail ? (
        <div className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl p-16 text-center">
          <p className="text-xs text-[#9ca3af] dark:text-[#52525b]">Loading manifest details...</p>
        </div>
      ) : (
        <>
          {/* Progress Bento */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl p-4">
              <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] font-semibold uppercase tracking-wider mb-1">Total Items</div>
              <div className="text-2xl font-bold text-[#1f2937] dark:text-[#e4e4e7]">{totalItems}</div>
              <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] mt-1 flex items-center gap-1">
                <Hash size={12} /> On manifest
              </div>
            </div>
            <div className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl p-4">
              <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] font-semibold uppercase tracking-wider mb-1">Verified</div>
              <div className="text-2xl font-bold text-emerald-400">{receivedCount}</div>
              <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] mt-1 flex items-center gap-1">
                <CheckCircle2 size={12} /> Received
              </div>
            </div>
            <div className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl p-4">
              <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] font-semibold uppercase tracking-wider mb-1">Pending</div>
              <div className="text-2xl font-bold text-amber-400">{totalItems - receivedCount}</div>
              <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] mt-1 flex items-center gap-1">
                <AlertTriangle size={12} /> Awaiting scan
              </div>
            </div>
            <div className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl p-4">
              <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] font-semibold uppercase tracking-wider mb-1">Courier</div>
              <div className="text-lg font-bold text-[#1f2937] dark:text-[#e4e4e7]">{manifest?.courier_name || 'N/A'}</div>
              <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] mt-1 flex items-center gap-1">
                <Truck size={12} /> {manifest?.origin_id?.replace('_', ' ')}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-[#6b7280] dark:text-[#71717a] uppercase tracking-wider">
                Verification Progress
              </span>
              <span className="text-[11px] font-bold text-[#1f2937] dark:text-[#e4e4e7]">
                {receivedCount} / {totalItems}
              </span>
            </div>
            <div className="h-2 bg-[#f5f5f5] dark:bg-[#0a0a0b] rounded-full overflow-hidden border border-[#e5e7eb] dark:border-[#1f1f21]">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Scanner Area */}
          <div className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <Scan size={18} className="text-accent" />
              <h2 className="text-xs font-bold text-[#1f2937] dark:text-[#e4e4e7] uppercase tracking-wider">IMEI Scanner</h2>
              {isVerifying && (
                <span className="text-[10px] font-semibold text-amber-400 animate-pulse">Verifying...</span>
              )}
            </div>
            <div className="relative">
              <input
                ref={scannerRef}
                value={scanInput}
                onChange={e => setScanInput(e.target.value)}
                onKeyDown={handleScan}
                placeholder="Scan or type IMEI and press Enter..."
                className="form-input w-full py-4 font-mono text-lg tracking-widest placeholder:font-sans placeholder:text-xs placeholder:tracking-normal"
                autoFocus
              />
              <Scan size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#d1d5db] dark:text-[#52525b]" />
            </div>

            {/* Last scan feedback */}
            {lastScan && (
              <div className={`mt-3 flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg transition-all ${
                lastScan.status === 'success'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                {lastScan.status === 'success'
                  ? <CheckCircle2 size={14} />
                  : <XCircle size={14} />
                }
                <span className="font-mono font-bold">{lastScan.imei}</span>
                <ChevronRight size={12} />
                <span>{lastScan.message}</span>
              </div>
            )}

            {!lastScan && (
              <div className="mt-3 text-[10px] font-semibold text-[#6b7280] dark:text-[#71717a] uppercase tracking-wider flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Scanner active — ready for IMEI input
              </div>
            )}
          </div>

          {/* Manifest Items Table */}
          <div className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-[#6b7280] dark:text-[#71717a] border-b border-[#e5e7eb] dark:border-[#1f1f21]">
                  <th className="px-5 py-3 w-12"></th>
                  <th className="px-5 py-3">IMEI</th>
                  <th className="px-5 py-3">Model</th>
                  <th className="px-5 py-3">Serial</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {items.map(item => {
                  const isVerified = verifiedImeis.has(item.imei);
                  const isLastScanned = lastScan?.imei === item.imei;
                  return (
                    <tr
                      key={item.imei}
                      className={`border-b border-[#e5e7eb] dark:border-[#1a1a1c] transition-all ${
                        isVerified ? 'bg-emerald-500/5 dark:bg-emerald-500/5' :
                        isLastScanned && lastScan?.status === 'error' ? 'bg-red-500/5 dark:bg-red-500/5' :
                        'hover:bg-[#f9fafb] dark:hover:bg-[#1a1a1c]'
                      }`}
                    >
                      <td className="px-5 py-3">
                        {isVerified ? (
                          <CheckCircle2 size={18} className="text-emerald-400" />
                        ) : (
                          <div className="w-[18px] h-[18px] rounded-full border-2 border-[#d1d5db] dark:border-[#3f3f46]" />
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`font-mono text-xs font-bold tracking-wider ${
                          isVerified ? 'text-emerald-400' : 'text-[#1f2937] dark:text-[#e4e4e7]'
                        }`}>
                          {item.imei}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-[#6b7280] dark:text-[#71717a] font-semibold uppercase">
                        {item.model_number || '—'}
                      </td>
                      <td className="px-5 py-3 text-xs font-mono text-[#6b7280] dark:text-[#71717a]">
                        {item.serial_number || '—'}
                      </td>
                      <td className="px-5 py-3">
                        {isVerified ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Received
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Awaiting
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Floating notification */}
      {notification && (
        <div className={`fixed bottom-6 right-6 px-5 py-3 rounded-xl shadow-2xl border text-xs font-semibold z-50 transition-all animate-in slide-in-from-bottom-4 ${
          notification.type === 'success'
            ? 'bg-emerald-500 text-white border-emerald-400/30'
            : 'bg-red-500 text-white border-red-400/30'
        }`}>
          {notification.message}
        </div>
      )}
    </div>
  );
}
