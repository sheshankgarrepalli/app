import { useState, useRef, useMemo } from 'react';
import { useLocationFilter } from '../context/LocationContext';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Upload, Loader2, AlertCircle, CheckCircle2, FileSpreadsheet, X, ArrowRight, Lock } from 'lucide-react';

interface PreviewRow {
  row_number: number;
  model_name: string;
  storage_gb: number;
  imei: string;
  is_valid: boolean;
  error: string | null;
  model_exists: boolean;
  generated_model_number: string;
}

interface PreviewResponse {
  rows: PreviewRow[];
  summary: { total: number; valid: number; duplicate_imeis: number; new_models: number };
}

interface ImportResponse {
  devices_imported: number;
  new_models_created: number;
  errors: string[];
}

type Phase = 'upload' | 'preview' | 'importing' | 'results';

export default function ExcelImport() {
  const { availableLocations } = useLocationFilter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [phase, setPhase] = useState<Phase>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [deviceStatus, setDeviceStatus] = useState('In_QC');
  const [error, setError] = useState<string | null>(null);
  const [showOnlyIssues, setShowOnlyIssues] = useState(false);
  const [adminLocationId, setAdminLocationId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultLocationId = useMemo(() => {
    if (user?.store_id) return user.store_id;
    return availableLocations[0]?.id || 'warehouse';
  }, [user?.store_id, availableLocations]);

  // Admin can pick any location; non-admin are locked to their store
  const locationId = isAdmin ? (adminLocationId || defaultLocationId) : defaultLocationId;

  // Sync admin dropdown default on first load
  const adminDropdownReady = useRef(false);
  if (isAdmin && !adminDropdownReady.current && availableLocations.length > 0) {
    adminDropdownReady.current = true;
    if (!adminLocationId) {
      // defer state update to avoid render-phase side effect
      setTimeout(() => setAdminLocationId(defaultLocationId), 0);
    }
  }

  const locationName = useMemo(() => {
    const loc = availableLocations.find(l => l.id === locationId);
    return loc?.name || locationId;
  }, [locationId, availableLocations]);

  const parseFile = async () => {
    if (!file) return;
    setError(null);

    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });

      if (jsonData.length === 0) {
        setError('No data rows found in file');
        return;
      }

      // Auto-detect columns (case-insensitive)
      const firstRow = jsonData[0];
      const keys = Object.keys(firstRow);
      const findKey = (patterns: string[]) => keys.find(k => patterns.some(p => k.toLowerCase().includes(p.toLowerCase())));
      const imeiKey = findKey(['imei']);
      const modelKey = findKey(['model']);
      const storageKey = findKey(['storage']);

      if (!imeiKey || !modelKey || !storageKey) {
        setError(`Could not identify required columns. Found: ${keys.join(', ')}. Expected columns with "IMEI", "model", and "storage" in headers.`);
        return;
      }

      const rows = jsonData.map((r: any) => ({
        model_name: String(r[modelKey] || '').trim(),
        storage: String(r[storageKey] || '').trim(),
        imei: String(r[imeiKey] || '').trim(),
      }));

      // Send to preview endpoint
      const { data } = await api.post('/api/import/excel-preview', { rows });
      setPreview(data);
      setPhase('preview');
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to parse file');
    }
  };

  const handleImport = async () => {
    if (!preview) return;
    const validRows = preview.rows.filter(r => r.is_valid);
    if (validRows.length === 0) return;

    setPhase('importing');
    setError(null);

    try {
      const { data } = await api.post('/api/import/excel-import', {
        rows: validRows.map(r => ({ model_name: r.model_name, storage: String(r.storage_gb), imei: r.imei })),
        location_id: locationId,
        device_status: deviceStatus,
      });
      setImportResult(data);
      setPhase('results');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Import failed');
      setPhase('preview');
    }
  };

  const reset = () => {
    setPhase('upload');
    setFile(null);
    setPreview(null);
    setImportResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Phase: Upload ──
  if (phase === 'upload') {
    return (
      <div className="space-y-5">
        <div className="page-header">
          <div>
            <div className="flex items-center gap-[10px]">
              <h1 className="page-title">Import Inventory</h1>
              <span className="badge badge-neutral">Excel / CSV</span>
            </div>
            <p className="text-[13px] text-[var(--text-tertiary)] mt-1">Upload an Excel sheet with model name, storage, and IMEI columns</p>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-lg flex items-center gap-3 text-[var(--destructive)] text-[13px] font-bold" style={{ background: '#FEE2E2' }}>
            <AlertCircle size={16} /> {error}
            <button onClick={() => setError(null)} className="ml-auto underline">Dismiss</button>
          </div>
        )}

        <div className="card">
          <div
            className="scan-area cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); }}
            onDrop={e => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) setFile(f);
            }}
          >
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileSpreadsheet size={36} className="text-accent" />
                <p className="text-sm font-bold text-[var(--text)]">{file.name}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{(file.size / 1024).toFixed(0)} KB</p>
                <button onClick={e => { e.stopPropagation(); setFile(null); }} className="text-xs text-red-400 hover:underline mt-1">Remove</button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload size={36} className="text-[var(--text-muted)]" />
                <p className="text-sm font-bold text-[var(--text)]">Drop Excel file here</p>
                <p className="text-xs text-[var(--text-tertiary)]">or click to browse — .xlsx / .csv</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f); }}
              hidden
            />
          </div>
        </div>

        <button
          onClick={parseFile}
          disabled={!file}
          className="btn-primary flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          <FileSpreadsheet size={16} /> Parse & Preview
        </button>
      </div>
    );
  }

  // ── Phase: Preview ──
  if (phase === 'preview' && preview) {
    const { summary } = preview;
    const rows = showOnlyIssues ? preview.rows.filter(r => !r.is_valid) : preview.rows;

    return (
      <div className="space-y-5">
        <div className="page-header">
          <div>
            <div className="flex items-center gap-[10px]">
              <h1 className="page-title">Preview Import</h1>
              <span className="badge badge-neutral">{file?.name}</span>
            </div>
            <p className="text-[13px] text-[var(--text-tertiary)] mt-1">Review and confirm before importing</p>
          </div>
          <button onClick={reset} className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg text-sm">
            <X size={16} /> Cancel
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-lg flex items-center gap-3 text-[var(--destructive)] text-[13px] font-bold" style={{ background: '#FEE2E2' }}>
            <AlertCircle size={16} /> {error}
            <button onClick={() => setError(null)} className="ml-auto underline">Dismiss</button>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <div className="kpi-card"><div className="kpi-label">Total Rows</div><div className="kpi-value">{summary.total}</div></div>
          <div className="kpi-card border-emerald-500/20"><div className="kpi-label text-emerald-400">Valid Devices</div><div className="kpi-value text-emerald-400">{summary.valid}</div></div>
          <div className="kpi-card border-red-500/20"><div className="kpi-label text-red-400">Duplicate IMEIs</div><div className="kpi-value text-red-400">{summary.duplicate_imeis}</div></div>
          <div className="kpi-card border-purple-500/20"><div className="kpi-label text-purple-400">New Models</div><div className="kpi-value text-purple-400">{summary.new_models}</div></div>
        </div>

        {/* Toggle */}
        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
          <input type="checkbox" checked={showOnlyIssues} onChange={e => setShowOnlyIssues(e.target.checked)} className="w-4 h-4 rounded accent-accent" />
          Show only issues ({preview.rows.filter(r => !r.is_valid).length})
        </label>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-standard">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Model Name</th>
                  <th>Storage</th>
                  <th>IMEI</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.row_number} className={!r.is_valid ? 'bg-red-50' : ''}>
                    <td className="text-xs text-[var(--text-secondary)]">{r.row_number}</td>
                    <td className="text-sm font-medium text-[var(--text)]">{r.model_name}</td>
                    <td className="text-sm text-[var(--text)]">{r.storage_gb}GB</td>
                    <td className="font-mono text-xs text-[var(--text)]">{r.imei}</td>
                    <td>
                      {r.is_valid ? (
                        <span className="badge badge-sellable">{r.model_exists ? 'Existing Model' : 'New Model'}</span>
                      ) : (
                        <span className="badge badge-error">{r.error}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Controls */}
        <div className="card">
          <div className="card-header">Import Options</div>
          <div className="card-body flex items-end gap-4 flex-wrap">
            <div className="form-group flex-1 min-w-[180px]">
              <label className="form-label">Destination Location</label>
              {isAdmin ? (
                <select className="form-select" value={locationId} onChange={e => setAdminLocationId(e.target.value)}>
                  {availableLocations.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg-muted)] text-sm text-[var(--text)] h-[42px]">
                  <Lock size={14} className="text-[var(--text-tertiary)] flex-shrink-0" />
                  <span className="truncate">{locationName}</span>
                </div>
              )}
            </div>
            <div className="form-group flex-1 min-w-[180px]">
              <label className="form-label">Default Status</label>
              <select className="form-select" value={deviceStatus} onChange={e => setDeviceStatus(e.target.value)}>
                <option value="Sellable">Sellable</option>
                <option value="In_QC">In QC</option>
                <option value="In_Repair">In Repair</option>
              </select>
            </div>
            <button
              onClick={handleImport}
              disabled={summary.valid === 0}
              className="btn-primary flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50 h-[42px]"
            >
              <ArrowRight size={16} /> Import {summary.valid} Devices
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Phase: Importing ──
  if (phase === 'importing') {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center space-y-4">
          <Loader2 size={40} className="animate-spin text-accent mx-auto" />
          <p className="text-sm font-bold text-[var(--text)]">Importing devices...</p>
          <p className="text-xs text-[var(--text-tertiary)]">Creating models and registering IMEIs</p>
        </div>
      </div>
    );
  }

  // ── Phase: Results ──
  if (phase === 'results' && importResult) {
    return (
      <div className="space-y-5">
        <div className="page-header">
          <div>
            <div className="flex items-center gap-[10px]">
              <h1 className="page-title">Import Complete</h1>
              <span className="badge badge-sellable">Success</span>
            </div>
          </div>
        </div>

        <div className="card text-center py-12">
          <CheckCircle2 size={48} className="mx-auto text-emerald-400 mb-4" />
          <h2 className="text-lg font-bold text-[var(--text)] mb-2">Import Successful</h2>
          <div className="flex justify-center gap-6 mt-4">
            <div>
              <div className="text-2xl font-bold text-[var(--text)]">{importResult.devices_imported}</div>
              <div className="text-xs text-[var(--text-tertiary)]">Devices Imported</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-400">{importResult.new_models_created}</div>
              <div className="text-xs text-[var(--text-tertiary)]">New Models Created</div>
            </div>
          </div>
          {importResult.errors.length > 0 && (
            <div className="mt-6 p-4 bg-amber-50 rounded-lg max-w-md mx-auto text-left">
              <p className="text-xs font-bold text-amber-600 mb-2">Warnings:</p>
              {importResult.errors.map((e, i) => (
                <p key={i} className="text-xs text-amber-700">{e}</p>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="btn-primary px-6 py-2.5 rounded-lg text-sm font-medium">
            Import Another File
          </button>
        </div>
      </div>
    );
  }

  return null;
}
