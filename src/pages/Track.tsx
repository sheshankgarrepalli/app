import React, { useState, useRef, useCallback } from 'react';
import { Search, MapPin, Clock, User, Hash, Smartphone, AlertTriangle, Package, ArrowRightLeft, FileText, Printer } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api/api';

interface DeviceModel {
  model_number: string;
  brand: string;
  name: string;
  color: string;
  storage_gb: number;
}

interface HistoryEntry {
  log_id: number;
  imei: string;
  timestamp: string;
  action_type: string;
  employee_id: string;
  previous_status: string | null;
  new_status: string;
  notes: string | null;
}

interface DeviceTrackInfo {
  imei: string;
  serial_number: string | null;
  model_number: string | null;
  location_id: string;
  sub_location_bin: string | null;
  device_status: string | null;
  received_date: string;
  store_name: string | null;
  model: DeviceModel | null;
}

interface TrackResponse {
  device: DeviceTrackInfo;
  timeline: HistoryEntry[];
}

const STATUS_COLORS: Record<string, string> = {
  Sellable: 'bg-emerald-500',
  In_QC: 'bg-purple-500',
  In_Repair: 'bg-amber-500',
  In_Transit: 'bg-cyan-500',
  Pending_Acknowledgment: 'bg-blue-500',
  Sold: 'bg-emerald-600',
  Transit_to_Repair: 'bg-amber-400',
  Transit_to_QC: 'bg-purple-400',
  Transit_to_Main_Bin: 'bg-emerald-400',
  Reserved_Layaway: 'bg-indigo-500',
  Scrapped: 'bg-red-500',
  Awaiting_Parts: 'bg-blue-400',
};

export default function Track() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TrackResponse | null>(null);
  const [error, setError] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  const handleTrack = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setError('');
    setData(null);

    try {
      const { data } = await api.get('/api/track/', { params: { identifier: trimmed } });
      setData(data);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Device not found');
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleTrack();
  };

  const device = data?.device;
  const timeline = data?.timeline || [];
  const currentStatus = device?.device_status;
  const dotColor = currentStatus ? STATUS_COLORS[currentStatus] || 'bg-zinc-500' : 'bg-zinc-500';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-xl font-bold text-[var(--text)]">Track Device</h2>

      {/* Search */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter IMEI, Serial, or Phone Number..."
            className="w-full pl-10 pr-4 py-3 bg-[var(--bg-muted)] border border-[var(--border-secondary)] rounded-lg text-[var(--text)] text-sm placeholder:text-[var(--text-muted)] outline-none focus:border-accent transition-colors"
            autoFocus
          />
        </div>
        <button
          onClick={handleTrack}
          disabled={loading || !query.trim()}
          className="px-6 py-3 bg-[var(--accent)] text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? 'Tracking...' : 'Track'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[#FEE2E2] border border-[var(--destructive)]/20 text-[var(--destructive)] text-sm">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {device && (
        <>
          {/* Device Info Card */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${dotColor}`}>
                <Smartphone size={22} className="text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--text)]">
                  {device.model ? (device.model.name.toLowerCase().startsWith(device.model.brand.toLowerCase()) ? device.model.name : `${device.model.brand} ${device.model.name}`) : 'Unknown Device'}
                </h3>
                <p className="text-sm text-[var(--text-tertiary)]">
                  {device.model && `${device.model.color || ''}${device.model.color ? ' · ' : ''}${device.model.storage_gb}GB`}
                </p>
              </div>
              <div className="ml-auto">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                  currentStatus
                    ? 'bg-opacity-20 text-[var(--text)] border border-[var(--border-secondary)]'
                    : 'badge-neutral border border-zinc-500/30'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                  {currentStatus || 'Unknown'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <Info icon={Hash} label="IMEI" value={device.imei} />
              <Info icon={Hash} label="Serial" value={device.serial_number || '-'} />
              <Info icon={MapPin} label="Location" value={device.store_name || device.location_id} />
              {device.model && (
                <>
                  <Info icon={Smartphone} label="Model" value={device.model.model_number} />
                  <Info icon={Package} label="Brand" value={device.model.brand} />
                </>
              )}
              <Info icon={Clock} label="Received" value={new Date(device.received_date).toLocaleDateString()} />
              {device.sub_location_bin && (
                <Info icon={MapPin} label="Bin" value={device.sub_location_bin} />
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Link
              to={`/admin/routing?imei=${device.imei}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-xs font-semibold hover:bg-accent-hover transition-colors"
            >
              <ArrowRightLeft size={14} /> Route Device
            </Link>
            <Link
              to={`/admin/invoices/new?imei=${device.imei}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text)] rounded-lg text-xs font-semibold hover:bg-[var(--bg-muted)] transition-colors"
            >
              <FileText size={14} /> Create Invoice
            </Link>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text)] rounded-lg text-xs font-semibold hover:bg-[var(--bg-muted)] transition-colors"
            >
              <Printer size={14} /> Print Label
            </button>
          </div>

          {/* Timeline */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5">
            <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-5">
              Device Journey ({timeline.length} {timeline.length === 1 ? 'event' : 'events'})
            </h3>

            <div className="relative">
              {timeline.map((entry, i) => {
                const isLast = i === timeline.length - 1;
                const color = STATUS_COLORS[entry.new_status] || 'bg-zinc-500';

                return (
                  <div key={entry.log_id} className="flex gap-4">
                    {/* Timeline rail */}
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${color}`} />
                      {!isLast && <div className="w-0.5 flex-1 bg-[var(--border-primary)] min-h-[24px]" />}
                    </div>

                    {/* Content */}
                    <div className={`flex-1 pb-5 ${isLast ? '' : ''}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-[var(--text)]">
                          {entry.action_type}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] mb-1">
                        <span className="flex items-center gap-1">
                          <User size={12} /> {entry.employee_id}
                        </span>
                        {entry.previous_status && (
                          <span className="flex items-center gap-1">
                            <span className="text-[var(--text-muted)]">{entry.previous_status}</span>
                            <span className="text-[var(--text-tertiary)]">→</span>
                            <span className="text-[var(--text)] font-medium">{entry.new_status}</span>
                          </span>
                        )}
                        {!entry.previous_status && (
                          <span className="text-[var(--text)] font-medium">{entry.new_status}</span>
                        )}
                      </div>

                      {entry.notes && (
                        <p className="text-xs text-[var(--text-tertiary)] mt-1">{entry.notes}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {timeline.length === 0 && (
              <p className="text-sm text-[var(--text-tertiary)] text-center py-6">No history recorded yet.</p>
            )}
          </div>
        </>
      )}

      {!device && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-[var(--text-tertiary)]">
          <Search size={40} className="mb-3 opacity-50" />
          <p className="text-sm">Enter an IMEI, serial, or phone number to track a device</p>
        </div>
      )}
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={14} className="text-[var(--text-tertiary)] flex-shrink-0" />
      <div className="min-w-0">
        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">{label}</span>
        <span className="text-sm text-[var(--text)] font-medium truncate block">{value}</span>
      </div>
    </div>
  );
}
