import { useState, useRef, useEffect } from 'react';
import api from '../api/api';
import { CheckCircle2, AlertCircle } from 'lucide-react';

const DEVICE_TYPES = [
  { value: 'Phone', label: 'Phone' },
  { value: 'Tablet', label: 'Tablet' },
  { value: 'Laptop', label: 'Laptop' },
  { value: 'Console', label: 'Console (Switch, PS, Xbox)' },
  { value: 'Watch', label: 'Watch' },
  { value: 'Accessory', label: 'Accessory' },
  { value: 'Other', label: 'Other' },
];

export default function ManualIntake() {
    const [identifier, setIdentifier] = useState('');
    const [devices, setDevices] = useState<{ id: string; device_type: string }[]>([]);
    const [deviceType, setDeviceType] = useState('Phone');
    const [destination, setDestination] = useState('warehouse');
    const [defaultStatus, setDefaultStatus] = useState('In_QC');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const idRef = useRef<HTMLInputElement>(null);

    useEffect(() => { idRef.current?.focus(); }, []);
    useEffect(() => { idRef.current?.focus(); }, [devices]);

    const addDevice = () => {
        const trimmed = identifier.trim();
        if (!trimmed) return;
        if (devices.some(d => d.id === trimmed)) {
            setError(`${trimmed} already in batch`);
            setIdentifier('');
            idRef.current?.focus();
            return;
        }
        setDevices([{ id: trimmed, device_type: deviceType }, ...devices]);
        setIdentifier('');
        setError(null);
    };

    const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') { e.preventDefault(); addDevice(); }
    };

    const removeDevice = (id: string) => setDevices(devices.filter(d => d.id !== id));

    const onSubmit = async () => {
        if (devices.length === 0) return;
        if (!window.confirm(`Register ${devices.length} device${devices.length !== 1 ? 's' : ''} with status "${defaultStatus.replace(/_/g, ' ')}" at "${destination}"?`)) return;
        setIsSubmitting(true);
        setError(null);
        setSuccess(false);
        try {
            await api.post('/api/inventory/bulk-intake', {
                imeis: devices.map(d => d.id),
                location_id: destination,
                device_status: defaultStatus,
            });
            setSuccess(true);
            setDevices([]);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Intake failed');
        } finally {
            setIsSubmitting(false);
            idRef.current?.focus();
        }
    };

    return (
        <div className="space-y-4">
            {/* Page Header */}
            <div className="page-header">
                <div>
      <div className="flex items-center gap-[10px]">
        <h1 className="page-title">Quick Intake</h1>
        <span className="badge badge-neutral">{devices.length} Scanned</span>
      </div>
      <p className="text-[13px] text-[var(--text-tertiary)] mt-1">
        Scan or type IMEI / Serial — press Enter to add to batch
      </p>
                </div>
            </div>

            {error && (
                <div className="p-4 rounded-lg flex items-center gap-3 text-[var(--destructive)] text-[13px] font-bold" style={{ background: '#FEE2E2' }}>
                    <AlertCircle size={16} /> {error}
                    <button onClick={() => setError(null)} className="ml-auto underline">Dismiss</button>
                </div>
            )}

            {success && (
                <div className="p-4 rounded-lg flex items-center gap-3 text-[var(--success)] text-[13px] font-bold" style={{ background: '#DCFCE7' }}>
                    <CheckCircle2 size={16} /> Devices registered successfully!
                </div>
            )}

            <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {/* Scanner */}
                <div className="card">
                    <div className="scan-area">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" style={{ marginBottom: 12 }}>
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        </svg>
              <input
                ref={idRef}
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Scan or type IMEI / Serial..."
                className="w-full bg-transparent border-none text-center text-[15px] outline-none text-[var(--text)] py-3"
                style={{ fontFamily: "'Fira Code', monospace" }}
                autoFocus
              />
              <p className="text-[11px] text-[var(--text-tertiary)] mt-2">
                Press <kbd>Enter</kbd> to add · Works for IMEI, serial, or any ID
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-body flex flex-col gap-4">
              <label className="form-label">Device Type</label>
              <select className="form-select" value={deviceType} onChange={e => setDeviceType(e.target.value)}>
                {DEVICE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <label className="form-label">Destination Location</label>
              <select className="form-select" value={destination} onChange={e => setDestination(e.target.value)}>
                <option value="warehouse">Warehouse</option>
                <option value="grand-prairie">Grand Prairie</option>
                <option value="foodland">Foodland</option>
                <option value="fiesta">Fiesta</option>
              </select>
                        <label className="form-label">Default Status</label>
                        <select className="form-select" value={defaultStatus} onChange={e => setDefaultStatus(e.target.value)}>
                            <option value="Sellable">Sellable</option>
                            <option value="In_QC">In QC</option>
                            <option value="In_Repair">In Repair</option>
                        </select>
                        <button
                            onClick={onSubmit}
                            disabled={isSubmitting || devices.length === 0}
                            className="btn-primary w-full py-3 justify-center"
                        >
                            {isSubmitting ? 'Registering...' : `Register ${devices.length} Device${devices.length !== 1 ? 's' : ''}`}
                        </button>
                    </div>
                </div>
            </div>

            {/* Scanned Devices */}
            <div className="card">
                <div className="card-header">
                    Scanned Devices <span className="text-[11px] text-[var(--text-tertiary)]">{devices.length} devices</span>
                </div>
                {devices.length === 0 ? (
                    <div className="card-body">
                        <div className="flex flex-col items-center justify-center text-center py-16">
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-muted)] opacity-40 mb-3">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                            </svg>
                            <h3 className="text-base font-bold text-[var(--text)]" style={{ fontFamily: 'var(--font-heading)' }}>No devices scanned</h3>
                            <p className="text-[13px] text-[var(--text-tertiary)]">Scan or enter IMEIs to populate the register</p>
                        </div>
                    </div>
                ) : (
                    <div className="scanned-list" style={{ maxHeight: 400, overflowY: 'auto', borderTop: '1px solid var(--border)' }}>
                        {devices.map((d, idx) => (
                            <div key={d.id} className="scanned-row">
                                <span>{devices.length - idx}. {d.id} <span className="text-[10px] text-[var(--text-tertiary)] ml-2">{d.device_type}</span></span>
                                <button className="del-btn" onClick={() => removeDevice(d.id)}>&times;</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
