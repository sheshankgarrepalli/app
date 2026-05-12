import React, { useState, useRef, useCallback } from 'react';
import { Search, Save, ChevronDown, ChevronUp, AlertTriangle, CheckCircle } from 'lucide-react';
import api from '../api/api';

const QC_OPTIONS = [
  { key: 'screen_condition', label: 'Screen Condition', type: 'condition' },
  { key: 'frame_condition', label: 'Frame Condition', type: 'condition' },
  { key: 'camera_lens_damage', label: 'Camera Lens Damage', type: 'boolean' },
  { key: 'face_id_issue', label: 'Face ID Issue', type: 'boolean' },
  { key: 'battery_service', label: 'Battery Service', type: 'boolean' },
  {
    key: 'speaker',
    label: 'Speaker Issue',
    type: 'group',
    children: [
      { key: 'speaker_issue_ear', label: 'Ear Speaker' },
      { key: 'speaker_issue_loud', label: 'Loud Speaker' },
    ],
  },
  { key: 'charging_port_issue', label: 'Charging Port Issue', type: 'boolean' },
  { key: 'network_locked', label: 'Network Locked', type: 'boolean' },
];

const REPAIR_OPTIONS = QC_OPTIONS.filter(
  (o) =>
    ['camera_lens_damage', 'face_id_issue', 'battery_service', 'speaker', 'charging_port_issue', 'network_locked'].includes(o.key)
);

const GRADES = ['A+', 'AB', 'B+', 'B'];

interface DeviceInfo {
  imei: string;
  serial_number: string | null;
  model_number: string | null;
  location_id: string;
  device_status: string | null;
  cost_basis: number;
  received_date: string;
  store_name: string | null;
  model: {
    model_number: string;
    brand: string;
    name: string;
    color: string;
    storage_gb: number;
  } | null;
}

interface QCInspectionRecord {
  id: string;
  imei: string;
  screen_condition: string | null;
  frame_condition: string | null;
  camera_lens_damage: boolean;
  face_id_issue: boolean;
  battery_service: boolean;
  speaker_issue_ear: boolean;
  speaker_issue_loud: boolean;
  charging_port_issue: boolean;
  network_locked: boolean;
  grade: string | null;
  needs_repair: boolean;
  repair_items: string[] | null;
  notes: string | null;
  inspector_id: string;
  created_at: string;
}

export default function QC() {
  const [imeiInput, setImeiInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [inspections, setInspections] = useState<QCInspectionRecord[]>([]);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [grade, setGrade] = useState('');
  const [needsRepair, setNeedsRepair] = useState(false);
  const [repairItems, setRepairItems] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [showRepairOptions, setShowRepairOptions] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setForm({});
    setGrade('');
    setNeedsRepair(false);
    setRepairItems([]);
    setNotes('');
    setShowRepairOptions(false);
    setError('');
    setSuccessMsg('');
  };

  const handleLookup = useCallback(async () => {
    const trimmed = imeiInput.trim();
    if (!trimmed) return;

    setLoading(true);
    setError('');
    setSuccessMsg('');
    setDevice(null);
    setInspections([]);
    resetForm();

    try {
      const { data } = await api.get(`/api/qc/${trimmed}`);
      setDevice(data.device);
      setInspections(data.inspections || []);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to fetch device';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }, [imeiInput]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLookup();
  };

  const toggleRepairItem = (key: string) => {
    setRepairItems((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleSpeakerRepair = (subKey: string) => {
    setRepairItems((prev) =>
      prev.includes(subKey) ? prev.filter((k) => k !== subKey) : [...prev, subKey]
    );
  };

  const handleSave = async () => {
    if (!device) return;
    if (!grade) { setError('Please select a grade before saving'); return; }

    const body: Record<string, any> = { grade: grade, needs_repair: needsRepair, notes: notes || null };

    for (const opt of QC_OPTIONS) {
      if (opt.type === 'group') {
        for (const child of opt.children || []) {
          body[child.key] = form[child.key] || false;
        }
      } else if (opt.type === 'condition') {
        body[opt.key] = form[opt.key] || null;
      } else {
        body[opt.key] = form[opt.key] || false;
      }
    }

    if (needsRepair) {
      body.repair_items = repairItems;
    } else {
      body.repair_items = null;
    }

    setSaving(true);
    setError('');
    setSuccessMsg('');

    try {
      const { data } = await api.post(`/api/qc/${device.imei}`, body);
      setInspections((prev) => [data, ...prev]);
      setSuccessMsg('QC inspection saved successfully.');
      resetForm();
      setImeiInput('');
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to save inspection';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-[var(--text)]">Quality Control</h2>

      {/* IMEI Scanner */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            ref={inputRef}
            type="text"
            value={imeiInput}
            onChange={(e) => setImeiInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Scan or enter IMEI..."
            className="w-full pl-10 pr-4 py-3 bg-[var(--bg-muted)] border border-[var(--border-secondary)] rounded-lg text-[var(--text)] text-sm placeholder:text-[var(--text-muted)] outline-none focus:border-accent transition-colors"
            autoFocus
          />
        </div>
        <button
          onClick={handleLookup}
          disabled={loading || !imeiInput.trim()}
          className="px-6 py-3 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? 'Searching...' : 'Look Up'}
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[#FEE2E2] border border-[var(--destructive)]/20 text-[var(--destructive)] text-sm">
          <AlertTriangle size={16} /> {error}
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[#DCFCE7] border border-[var(--success)]/20 text-[var(--success)] text-sm">
          <CheckCircle size={16} /> {successMsg}
        </div>
      )}

      {/* Device Details + QC Form */}
      {device && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* LEFT: Device Details */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider">Device Details</h3>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <Detail label="IMEI" value={device.imei} />
              <Detail label="Serial" value={device.serial_number || '-'} />
              <Detail label="Status" value={device.device_status || '-'} />
              <Detail label="Location" value={device.store_name || device.location_id} />
              {device.model && (
                <>
                  <Detail label="Brand" value={device.model.brand} />
                  <Detail label="Model" value={device.model.name} />
                  <Detail label="Model #" value={device.model.model_number} />
                  <Detail label="Color" value={device.model.color} />
                  <Detail label="Storage" value={`${device.model.storage_gb}GB`} />
                </>
              )}
              <Detail label="Cost Basis" value={`$${(device.cost_basis || 0).toFixed(2)}`} />
              <Detail label="Received" value={new Date(device.received_date).toLocaleDateString()} />
            </div>

            {/* Previous QC History */}
            {inspections.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[var(--border)]">
                <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                  QC History ({inspections.length})
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {inspections.map((insp) => (
                    <div key={insp.id} className="bg-[var(--bg-muted)] rounded-lg p-3 text-xs space-y-1">
                      <div className="flex justify-between text-[var(--text-secondary)]">
                        <span className="font-medium text-[var(--text)]">{insp.inspector_id}</span>
                        <span>{new Date(insp.created_at).toLocaleString()}</span>
                      </div>
                      {insp.grade && (
                        <span className="inline-block px-2 py-0.5 rounded bg-accent/20 text-accent font-semibold">
                          {insp.grade}
                        </span>
                      )}
                      {insp.needs_repair && (
                        <span className="inline-block px-2 py-0.5 rounded bg-amber-500/20 text-[var(--warning)] font-semibold ml-1">
                          Needs Repair
                        </span>
                      )}
                      {insp.notes && <p className="text-[var(--text-tertiary)]">{insp.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: QC Form */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 space-y-5">
            <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider">QC Inspection</h3>

            {QC_OPTIONS.map((opt) => {
              if (opt.type === 'group') {
                return (
                  <div key={opt.key} className="space-y-2">
                    <span className="text-sm font-medium text-[var(--text)]">{opt.label}</span>
                    <div className="flex gap-4 ml-2">
                      {opt.children?.map((child) => (
                        <label key={child.key} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!form[child.key]}
                            onChange={(e) => setForm((prev) => ({ ...prev, [child.key]: e.target.checked }))}
                            className="w-4 h-4 rounded border-[var(--border-secondary)] bg-[var(--bg-muted)] accent-accent"
                          />
                          {child.label}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              }

              if (opt.type === 'condition') {
                return (
                  <div key={opt.key} className="space-y-1">
                    <span className="text-sm font-medium text-[var(--text)]">{opt.label}</span>
                    <select
                      value={(form[opt.key] as string) || ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, [opt.key]: e.target.value }))}
                      className="w-full px-3 py-2 bg-[var(--bg-muted)] border border-[var(--border-secondary)] rounded-lg text-sm text-[var(--text)] outline-none focus:border-accent"
                    >
                      <option value="">Select...</option>
                      <option value="Good">Good</option>
                      <option value="Fair">Fair</option>
                      <option value="Poor">Poor</option>
                      <option value="Damaged">Damaged</option>
                    </select>
                  </div>
                );
              }

              return (
                <label key={opt.key} className="flex items-center gap-3 text-sm text-[var(--text-secondary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!form[opt.key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [opt.key]: e.target.checked }))}
                    className="w-4 h-4 rounded border-[var(--border-secondary)] bg-[var(--bg-muted)] accent-accent"
                  />
                  {opt.label}
                </label>
              );
            })}

            {/* Grading */}
            <div className="space-y-2 pt-3 border-t border-[var(--border)]">
              <span className="text-sm font-bold text-[var(--text)]">Grade</span>
              <div className="flex gap-3">
                {GRADES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGrade(g)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                      grade === g
                        ? 'bg-accent text-white border-accent'
                        : 'bg-[var(--bg-muted)] text-[var(--text-secondary)] border-[var(--border-secondary)] hover:border-accent'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Needs Repair */}
            <div className="space-y-2 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => {
                  setNeedsRepair(!needsRepair);
                  setShowRepairOptions(!needsRepair);
                  if (needsRepair) setRepairItems([]);
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-semibold border transition-colors ${
                  needsRepair
                    ? 'bg-amber-500/20 text-[var(--warning)] border-amber-500/40'
                    : 'bg-[var(--bg-muted)] text-[var(--text-secondary)] border-[var(--border-secondary)] hover:border-amber-500/40'
                }`}
              >
                <span>Needs Repair</span>
                {needsRepair ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>

              {showRepairOptions && needsRepair && (
                <div className="bg-[var(--bg-muted)] rounded-lg p-4 space-y-3 border border-[var(--border-secondary)]">
                  {REPAIR_OPTIONS.map((opt) => {
                    if (opt.type === 'group') {
                      return (
                        <div key={opt.key} className="space-y-1">
                          <span className="text-xs font-semibold text-[var(--text-muted)] uppercase">{opt.label}</span>
                          <div className="flex gap-4">
                            {opt.children?.map((child) => (
                              <label key={child.key} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={repairItems.includes(child.key)}
                                  onChange={() => toggleSpeakerRepair(child.key)}
                                  className="w-4 h-4 rounded border-[var(--border-secondary)] bg-[var(--bg-muted)] accent-amber-500"
                                />
                                {child.label}
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <label key={opt.key} className="flex items-center gap-3 text-sm text-[var(--text-secondary)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={repairItems.includes(opt.key)}
                          onChange={() => toggleRepairItem(opt.key)}
                          className="w-4 h-4 rounded border-[var(--border-secondary)] bg-[var(--bg-muted)] accent-amber-500"
                        />
                        {opt.label}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1 pt-3 border-t border-[var(--border)]">
              <span className="text-sm font-medium text-[var(--text)]">Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter any additional notes..."
                rows={3}
                className="w-full px-3 py-2 bg-[var(--bg-muted)] border border-[var(--border-secondary)] rounded-lg text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-accent resize-none"
              />
            </div>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3 bg-accent text-white rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <Save size={18} />
              {saving ? 'Saving...' : 'Save QC Inspection'}
            </button>
          </div>
        </div>
      )}

      {!device && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-[var(--text-tertiary)]">
          <Search size={40} className="mb-3 opacity-50" />
          <p className="text-sm">Scan or enter an IMEI to begin QC inspection</p>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{label}</span>
      <p className="text-sm text-[var(--text)] font-medium mt-0.5">{value}</p>
    </div>
  );
}
