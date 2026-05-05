import { useState, useRef, useEffect } from 'react';
import api from '../api/api';
import { useAuth } from '@clerk/react';
import { Scan, PackagePlus, Trash2, CheckCircle2, AlertCircle, Zap } from 'lucide-react';

export default function ManualIntake() {
    const { getToken } = useAuth();
    const [imei, setImei] = useState('');
    const [devices, setDevices] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const imeiRef = useRef<HTMLInputElement>(null);

    useEffect(() => { imeiRef.current?.focus(); }, []);
    useEffect(() => { imeiRef.current?.focus(); }, [devices]);

    const addDevice = () => {
        const trimmed = imei.trim();
        if (!trimmed) return;
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
        setIsSubmitting(true);
        setError(null);
        setSuccess(false);
        try {
            const token = await getToken();
            await api.post('/api/inventory/bulk-intake', { imeis: devices }, {
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
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[22px] font-bold text-[var(--text-primary)] flex items-center gap-3">
                        Quick Intake
                        <span className="bg-accent/10 text-accent text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider font-bold border border-accent/20">
                            Rapid Scan
                        </span>
                    </h1>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                        Scan or type IMEI — press Enter to register
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    {success && (
                        <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                            <CheckCircle2 size={14} /> Registered
                        </div>
                    )}
                    <div className="text-right">
                        <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">Scanned</div>
                        <div className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{devices.length}</div>
                    </div>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-lg flex items-center gap-3 text-red-400 text-xs font-bold">
                    <AlertCircle size={16} /> {error}
                    <button onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-400">Dismiss</button>
                </div>
            )}

            {/* Scanner */}
            <div className="relative bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] overflow-hidden">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-accent/5 via-transparent to-purple-500/5 pointer-events-none" />
                <div className="relative px-6 py-8">
                    <div className="relative">
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-accent">
                            <Scan size={28} />
                        </div>
                        <input
                            ref={imeiRef}
                            value={imei}
                            onChange={e => setImei(e.target.value)}
                            onKeyDown={handleImeiKey}
                            placeholder="Scan or enter IMEI..."
                            className="w-full bg-[var(--bg-tertiary)] border-2 border-[var(--border-secondary)] focus:border-accent rounded-xl pl-16 pr-6 py-7 text-2xl font-mono font-bold tracking-widest text-[var(--text-primary)] outline-none transition-all placeholder:font-sans placeholder:text-base placeholder:tracking-normal placeholder:text-[var(--text-tertiary)]"
                            autoFocus
                        />
                    </div>
                </div>
            </div>

            {/* Scanned Devices */}
            <div className="card overflow-hidden">
                <div className="card-header">
                    <span className="flex items-center gap-2">
                        <PackagePlus size={16} className="text-accent" /> Intake Register ({devices.length})
                    </span>
                    {devices.length > 0 && (
                        <button onClick={() => setDevices([])} className="text-xs font-bold uppercase tracking-wider text-red-400 hover:text-red-300 transition-colors">
                            Clear All
                        </button>
                    )}
                </div>
                <div className="card-body p-0">
                    {devices.length === 0 ? (
                        <div className="py-24 flex flex-col items-center justify-center space-y-3">
                            <Zap size={40} className="text-[var(--text-muted)]" />
                            <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">No devices scanned</p>
                            <p className="text-[10px] text-[var(--text-tertiary)]">Scan or enter IMEIs to populate the register</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="table-standard">
                                <thead>
                                    <tr>
                                        <th className="w-14">#</th>
                                        <th>IMEI / Serial</th>
                                        <th className="w-14"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {devices.map((d, idx) => (
                                        <tr key={d} className="group">
                                            <td className="text-xs text-[var(--text-tertiary)] tabular-nums font-mono">{devices.length - idx}</td>
                                            <td className="font-mono text-sm font-bold text-[var(--text-primary)] tracking-wider">{d}</td>
                                            <td>
                                                <button onClick={() => removeDevice(d)} className="opacity-0 group-hover:opacity-100 text-[var(--text-tertiary)] hover:text-red-400 transition-all">
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end">
                <button
                    onClick={onSubmit}
                    disabled={isSubmitting || devices.length === 0}
                    className="bg-accent text-[var(--text-inverse)] hover:bg-accent-hover px-14 h-14 rounded-md font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none inline-flex items-center gap-3"
                >
                    <PackagePlus size={20} />
                    {isSubmitting ? 'Registering...' : `Register ${devices.length} Device${devices.length !== 1 ? 's' : ''} & Send to QC`}
                </button>
            </div>
        </div>
    );
}
