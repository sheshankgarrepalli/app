import { useState, useRef, useEffect } from 'react';
import api from '../api/api';
import { useAuth } from '@clerk/react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function ManualIntake() {
    const { getToken } = useAuth();
    const [imei, setImei] = useState('');
    const [devices, setDevices] = useState<string[]>([]);
    const [destination, setDestination] = useState('Warehouse A');
    const [defaultStatus, setDefaultStatus] = useState('In_QC');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const imeiRef = useRef<HTMLInputElement>(null);

    useEffect(() => { imeiRef.current?.focus(); }, []);
    useEffect(() => { imeiRef.current?.focus(); }, [devices]);

    const addDevice = () => {
        const trimmed = imei.trim();
        if (!trimmed) return;
        if (!/^\d{15}$/.test(trimmed)) {
            setError('IMEI must be exactly 15 digits');
            return;
        }
        if (devices.includes(trimmed)) {
            setError(`IMEI ${trimmed} already in batch`);
            setImei('');
            imeiRef.current?.focus();
            return;
        }
        setDevices([trimmed, ...devices]);
        setImei('');
        setError(null);
    };

    const handleImeiKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') { e.preventDefault(); addDevice(); }
    };

    const removeDevice = (imei: string) => setDevices(devices.filter(d => d !== imei));

    const onSubmit = async () => {
        if (devices.length === 0) return;
        if (!window.confirm(`Register ${devices.length} device${devices.length !== 1 ? 's' : ''} with status "${defaultStatus.replace(/_/g, ' ')}" at "${destination}"?`)) return;
        setIsSubmitting(true);
        setError(null);
        setSuccess(false);
        try {
            const token = await getToken();
            await api.post('/api/inventory/bulk-intake', {
                imeis: devices,
                location_id: destination,
                device_status: defaultStatus,
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSuccess(true);
            setDevices([]);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Intake failed. Check network and retry.');
        } finally {
            setIsSubmitting(false);
            imeiRef.current?.focus();
        }
    };

    return (
        <div className="space-y-4">
            {/* Page Header */}
            <div className="page-header">
                <div>
                    <div className="flex items-center gap-[10px]">
                        <h1 className="page-title">Quick Intake</h1>
                        <span className="badge badge-neutral" id="intake-count">{devices.length} Scanned</span>
                    </div>
                    <p className="text-[13px] text-[var(--text-tertiary)] mt-1">
                        Scan or type IMEI — press Enter to add to batch
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
                            ref={imeiRef}
                            value={imei}
                            onChange={e => setImei(e.target.value)}
                            onKeyDown={handleImeiKey}
                            placeholder="Scan or type IMEI / Serial..."
                            className="w-full bg-transparent border-none text-center text-[15px] outline-none text-[var(--text)] py-3"
                            style={{ fontFamily: "'Fira Code', monospace" }}
                            autoFocus
                        />
                        <p className="text-[11px] text-[var(--text-tertiary)] mt-2">
                            Press <kbd style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 6px', fontFamily: 'monospace', fontSize: 10 }}>Enter</kbd> to add · Duplicates skipped
                        </p>
                    </div>
                </div>

                {/* Controls */}
                <div className="card">
                    <div className="card-body flex flex-col gap-4">
                        <label className="form-label">Destination Location</label>
                        <select className="form-select" value={destination} onChange={e => setDestination(e.target.value)}>
                            <option value="Warehouse A">Warehouse A</option>
                            <option value="Store Downtown">Store Downtown</option>
                            <option value="QC Station 2">QC Station 2</option>
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
                            <div key={d} className="scanned-row">
                                <span>{devices.length - idx}. {d}</span>
                                <button className="del-btn" onClick={() => removeDevice(d)}>&times;</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
