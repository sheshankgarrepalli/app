import { useState, useRef, useEffect, FormEvent } from 'react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import {
    Scan, RefreshCw, AlertCircle, CheckCircle2,
    Trash2, ChevronRight, Info, Download, Printer, Search,
    Filter, MapPin, Calendar, Hash, ExternalLink
} from 'lucide-react';
import ErrorBanner from '../components/ErrorBanner';

const STORAGE_KEY = 'rapid_audit_scanned_imeis';

export default function RapidAudit() {
    const { user } = useAuth();
    const [scannedImeis, setScannedImeis] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    const [currentInput, setCurrentInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [report, setReport] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [searchFilter, setSearchFilter] = useState('');
    const [resolvedItems, setResolvedItems] = useState<Set<string>>(new Set());
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { inputRef.current?.focus(); }, []);
    useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(scannedImeis)); }, [scannedImeis]);

    const markResolved = (imei: string) => {
        setResolvedItems(prev => {
            const next = new Set(prev);
            next.add(imei);
            return next;
        });
    };

    const handleScan = (e: FormEvent) => {
        e.preventDefault();
        if (!currentInput.trim()) return;
        if (!scannedImeis.includes(currentInput.trim())) {
            setScannedImeis([currentInput.trim(), ...scannedImeis]);
        }
        setCurrentInput('');
        inputRef.current?.focus();
    };

    const removeImei = (imei: string) => setScannedImeis(scannedImeis.filter(i => i !== imei));

    const runAudit = async () => {
        setIsProcessing(true);
        try {
            const res = await api.post('/api/inventory/rapid-audit', {
                imeis: scannedImeis
            });
            setReport(res.data);
        } catch (err: any) {
            setError(err.response?.data?.detail || "Audit failed");
        } finally {
            setIsProcessing(false);
        }
    };

    const resetAudit = () => {
        setScannedImeis([]); setReport(null); setCurrentInput(''); setSearchFilter('');
        setResolvedItems(new Set());
        localStorage.removeItem(STORAGE_KEY);
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const downloadCSV = () => {
        const rows = [['Type', 'IMEI', 'Status/Last Action', 'Custodian']];
        report.missing.forEach((m: any) => rows.push(['Missing', m.imei, m.last_action || '', (m.last_employee || '').split('@')[0]]));
        report.unexpected.forEach((imei: string) => rows.push(['Unexpected', imei, 'Review Req', '']));
        report.matched.forEach((m: any) => rows.push(['Matched', m.imei || m, '', '']));
        const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-${user?.store_id || 'warehouse'}-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const printReport = () => window.print();

    if (report) {
        const filterMissing = report.missing.filter((m: any) => !searchFilter || m.imei.includes(searchFilter));
        const filterUnexpected = report.unexpected.filter((imei: string) => !searchFilter || imei.includes(searchFilter));
        const isClean = report.missing.length === 0 && report.unexpected.length === 0;

        return (
            <div className="space-y-6 max-w-7xl mx-auto">
                {/* Report Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-[22px] font-bold text-[var(--text)] flex items-center gap-3">
                            Audit Variance Report
                            <span className={`text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider font-bold border ${
                                isClean
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : 'bg-accent/10 text-accent border-accent/20'
                            }`}>
                                {isClean ? 'Clean' : 'Variance Found'}
                            </span>
                        </h1>
                        <p className="text-xs text-[var(--text-secondary)] mt-1 flex items-center gap-3">
                            <span className="flex items-center gap-1"><MapPin size={11} /> {user?.store_id || 'Warehouse Alpha'}</span>
                            <span className="flex items-center gap-1"><Calendar size={11} /> {new Date().toLocaleDateString()}</span>
                            <span className="flex items-center gap-1"><Hash size={11} /> {report.matched.length + report.missing.length + report.unexpected.length} records</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={downloadCSV} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-navy text-white hover:bg-navy-light transition-all text-xs font-bold border border-[var(--border)]">
                            <Download size={16} /> Download CSV
                        </button>
                        <button onClick={printReport} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-navy text-white hover:bg-navy-light transition-all text-xs font-bold border border-[var(--border)]">
                            <Printer size={16} /> Print Report
                        </button>
                        <button onClick={resetAudit} className="bg-accent text-[var(--text-inverse)] hover:bg-accent-hover px-5 py-2.5 rounded-md font-bold text-xs transition-all active:scale-[0.98] inline-flex items-center gap-2">
                            <RefreshCw size={15} /> New Audit
                        </button>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-4 gap-4">
                    <div className="kpi-card">
                        <div className="kpi-label text-emerald-400">Matched Assets</div>
                        <div className="kpi-value text-emerald-400">{report.matched.length}</div>
                        <div className="kpi-change up">Physically verified at this location</div>
                    </div>
                    <div className="kpi-card border-red-500/20">
                        <div className="kpi-label text-red-400">Missing Assets</div>
                        <div className="kpi-value text-red-400">{report.missing.length}</div>
                        <div className="kpi-change down">In system but not found on shelf</div>
                    </div>
                    <div className="kpi-card border-amber-500/20">
                        <div className="kpi-label text-amber-400">Unexpected Assets</div>
                        <div className="kpi-value text-amber-400">{report.unexpected.length}</div>
                        <div className="kpi-change down">On shelf but not in system</div>
                    </div>
                    <div className="kpi-card border-emerald-500/20">
                        <div className="kpi-label text-emerald-400">Resolved Items</div>
                        <div className="kpi-value text-emerald-400">{resolvedItems.size}</div>
                        <div className="kpi-change up">Marked as investigated</div>
                    </div>
                </div>

                {/* Search/Filter */}
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-md">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
                            <Search size={14} />
                        </div>
                        <input
                            value={searchFilter}
                            onChange={e => setSearchFilter(e.target.value)}
                            placeholder="Filter by IMEI..."
                            className="w-full bg-[var(--bg-muted)] border border-[var(--border-secondary)] focus:border-accent rounded-lg pl-9 pr-4 py-2 text-xs text-[var(--text)] outline-none transition-all placeholder:text-[var(--text-tertiary)]"
                        />
                    </div>
                    <div className="flex-1" />
                    <span className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1">
                        <Filter size={12} /> {report.matched.length + filterMissing.length + filterUnexpected.length} of {report.matched.length + report.missing.length + report.unexpected.length} shown
                    </span>
                </div>

                {/* Tables */}
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
                            <AlertCircle size={14} className="text-red-400" /> Missing from Shelf
                            <span className="text-[10px] font-normal text-[var(--text-tertiary)] normal-case">({filterMissing.length})</span>
                        </h3>
                        <div className="card overflow-hidden">
                            {filterMissing.length === 0 ? (
                                <div className="py-16 flex flex-col items-center justify-center">
                                    <Info size={28} className="text-[var(--text-muted)] mb-2" />
                                    <p className="text-xs font-bold text-[var(--text-tertiary)]">No missing assets</p>
                                </div>
                            ) : (
                                <table className="table-standard">
                                    <thead>
                                        <tr>
                                            <th>IMEI / Serial</th>
                                            <th>Last Action</th>
                                            <th className="text-right">Custodian</th>
                                            <th className="text-right w-16">Act</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filterMissing.map((m: any) => {
                                            const resolved = resolvedItems.has(m.imei);
                                            return (
                                                <tr key={m.imei} className={resolved ? 'opacity-50' : ''}>
                                                    <td className="font-mono text-xs font-bold">{m.imei}</td>
                                                    <td className="text-xs text-[var(--text-secondary)]">{m.last_action || '—'}</td>
                                                    <td className="text-right text-xs text-[var(--text-secondary)]">{(m.last_employee || '—').split('@')[0]}</td>
                                                    <td className="text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            {!resolved && (
                                                                <button onClick={() => markResolved(m.imei)}
                                                                    className="p-1 rounded hover:bg-emerald-500/10 text-[var(--text-tertiary)] hover:text-emerald-400" title="Mark as investigated">
                                                                    <CheckCircle2 size={13} />
                                                                </button>
                                                            )}
                                                            <Link to={`/admin/track?q=${m.imei}`} className="p-1 rounded hover:bg-[var(--bg-muted)] text-[var(--text-tertiary)] hover:text-accent" title="Investigate">
                                                                <ExternalLink size={13} />
                                                            </Link>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
                            <Info size={14} className="text-amber-400" /> Unexpected at this Location
                            <span className="text-[10px] font-normal text-[var(--text-tertiary)] normal-case">({filterUnexpected.length})</span>
                        </h3>
                        <div className="card overflow-hidden">
                            {filterUnexpected.length === 0 ? (
                                <div className="py-16 flex flex-col items-center justify-center">
                                    <Info size={28} className="text-[var(--text-muted)] mb-2" />
                                    <p className="text-xs font-bold text-[var(--text-tertiary)]">No unexpected assets</p>
                                </div>
                            ) : (
                                <table className="table-standard">
                                    <thead>
                                        <tr>
                                            <th>IMEI / Serial</th>
                                            <th className="text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filterUnexpected.map((imei: string) => {
                                            const resolved = resolvedItems.has(imei);
                                            return (
                                                <tr key={imei} className={resolved ? 'opacity-50' : ''}>
                                                    <td className="font-mono text-xs font-bold">{imei}</td>
                                                    <td className="text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <span className="badge badge-neutral text-[10px]">Review Req</span>
                                                            {!resolved && (
                                                                <button onClick={() => markResolved(imei)}
                                                                    className="p-1 rounded hover:bg-emerald-500/10 text-[var(--text-tertiary)] hover:text-emerald-400" title="Mark as investigated">
                                                                    <CheckCircle2 size={13} />
                                                                </button>
                                                            )}
                                                            <Link to={`/admin/track?q=${imei}`} className="p-1 rounded hover:bg-[var(--bg-muted)] text-[var(--text-tertiary)] hover:text-accent" title="Investigate">
                                                                <ExternalLink size={13} />
                                                            </Link>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>

                {/* Matched Summary */}
                {report.matched.length > 0 && (
                    <div className="space-y-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                            <CheckCircle2 size={14} /> Matched & Verified ({report.matched.length})
                        </h3>
                        <div className="card overflow-hidden opacity-60">
                            <table className="table-standard">
                                <thead>
                                    <tr>
                                        <th>IMEI / Serial</th>
                                        <th>Model</th>
                                        <th>Status</th>
                                        <th className="text-right">Location</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.matched.slice(0, 20).map((m: any) => (
                                        <tr key={m.imei || m}>
                                            <td className="font-mono text-xs font-bold">{m.imei || m}</td>
                                            <td className="text-xs text-[var(--text-secondary)]">{m.model_number || '—'}</td>
                                            <td><span className="badge badge-sellable text-[10px]">{m.device_status || 'Sellable'}</span></td>
                                            <td className="text-right text-xs text-[var(--text-secondary)]">{m.current_bin || '—'}</td>
                                        </tr>
                                    ))}
                                    {report.matched.length > 20 && (
                                        <tr>
                                            <td colSpan={4} className="text-center text-xs text-[var(--text-tertiary)] py-4">
                                                + {report.matched.length - 20} more matched devices
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[22px] font-bold text-[var(--text)] flex items-center gap-3">
                        Rapid Inventory Audit
                        <span className="bg-accent/10 text-accent text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider font-bold border border-accent/20">
                            Physical Count
                        </span>
                    </h1>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 flex items-center gap-3">
                        <span className="flex items-center gap-1"><MapPin size={11} /> {user?.store_id || 'Warehouse Alpha'}</span>
                        <span>Continuous scanner mode — scan all IMEIs at this location</span>
                    </p>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">Scanned</div>
                        <div className="text-2xl font-bold text-[var(--text)] tabular-nums">{scannedImeis.length}</div>
                    </div>
                    <button
                        onClick={runAudit}
                        disabled={isProcessing || scannedImeis.length === 0}
                        className="bg-accent text-[var(--text-inverse)] hover:bg-accent-hover px-6 h-11 rounded-md font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none inline-flex items-center gap-2"
                    >
                        {isProcessing ? <RefreshCw className="animate-spin" size={18} /> : <ChevronRight size={18} />}
                        Run Audit Variance Report
                    </button>
                </div>
            </div>

            {/* Scanner */}
            <div className="relative bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-accent/5 via-transparent to-purple-500/5 pointer-events-none" />
                <div className="relative p-5">
                    <form onSubmit={handleScan} className="relative">
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-accent">
                            <Scan size={26} />
                        </div>
                        <input
                            ref={inputRef}
                            type="text"
                            value={currentInput}
                            onChange={e => setCurrentInput(e.target.value)}
                            placeholder="Awaiting scan..."
                            className="w-full bg-[var(--bg-muted)] border-2 border-[var(--border-secondary)] focus:border-accent rounded-xl pl-16 pr-6 py-6 text-2xl font-mono font-bold tracking-widest text-[var(--text)] outline-none transition-all placeholder:font-sans placeholder:text-sm placeholder:tracking-normal placeholder:text-[var(--text-tertiary)]"
                            autoFocus
                        />
                    </form>
                </div>
            </div>

            {/* Scan Batch */}
            <div className="space-y-3">
                <div className="flex justify-between items-center px-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                        Current Scan Batch ({scannedImeis.length})
                    </h3>
                    {scannedImeis.length > 0 && (
                        <button onClick={() => setScannedImeis([])} className="text-xs font-bold uppercase tracking-wider text-red-400 hover:text-red-300 transition-colors">
                            Clear All
                        </button>
                    )}
                </div>
                {scannedImeis.length === 0 ? (
                    <div className="card">
                        <div className="card-body py-20 flex flex-col items-center justify-center space-y-3">
                            <Scan size={48} className="text-[var(--text-muted)]" />
                            <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">No assets in current batch</p>
                            <p className="text-[10px] text-[var(--text-tertiary)]">Begin scanning IMEIs to populate the audit batch</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-4 gap-3">
                        {scannedImeis.map((imei, index) => (
                            <div key={imei} className="card p-4 flex justify-between items-center group hover:border-accent/30 transition-all">
                                <div className="space-y-1 min-w-0">
                                    <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">#{scannedImeis.length - index}</div>
                                    <div className="text-xs font-mono font-bold text-[var(--text)] truncate">{imei}</div>
                                </div>
                                <button onClick={() => removeImei(imei)} className="text-[var(--text-muted)] hover:text-red-400 transition-colors flex-shrink-0 ml-2">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
