import React, { useState, useRef, useCallback } from 'react';
import { Search, Save, AlertTriangle, CheckCircle, Wrench, ClipboardList } from 'lucide-react';
import api from '../api/api';

const REPAIR_OPTIONS = [
  'Screen Replacement',
  'Frame/Housing',
  'Camera Lens',
  'Face ID / TrueDepth',
  'Battery Replacement',
  'Ear Speaker',
  'Loud Speaker',
  'Charging Port',
  'Network Unlock',
];

const ROUTING_ACTIONS = [
  { target: 'Transit_to_QC', label: 'Send to QC', color: 'bg-purple-500/20 text-purple-400 border-purple-500/40 hover:bg-purple-500/30' },
  { target: 'Transit_to_Main_Bin', label: 'Mark Sellable', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30' },
  { target: 'Transit_to_Repair', label: 'Send to Repair', color: 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30' },
  { target: 'Awaiting_Parts', label: 'Await Parts', color: 'bg-blue-500/20 text-blue-400 border-blue-500/40 hover:bg-blue-500/30' },
  { target: 'In_Transit', label: 'Transfer to Location', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 hover:bg-cyan-500/30' },
  { target: 'Sold', label: 'Mark Sold', color: 'bg-emerald-600/20 text-emerald-300 border-emerald-600/40 hover:bg-emerald-600/30' },
  { target: 'Reserved_Layaway', label: 'Reserve Layaway', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40 hover:bg-indigo-500/30' },
  { target: 'Scrapped', label: 'Scrap Device', color: 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30' },
];

interface PartOption {
  sku: string;
  part_name: string;
  in_stock: number;
}

interface DeviceModel {
  model_number: string;
  brand: string;
  name: string;
  color: string;
  storage_gb: number;
}

interface QCInspection {
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

interface RepairTicket {
  id: number;
  imei: string;
  symptoms: string | null;
  notes: string | null;
  status: string;
  assigned_tech_id: string | null;
  created_at: string;
  completed_at: string | null;
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

interface DeviceRepairInfo {
  imei: string;
  serial_number: string | null;
  model_number: string | null;
  location_id: string;
  device_status: string | null;
  received_date: string;
  model: DeviceModel | null;
  store_name: string | null;
  qc_findings: QCInspection | null;
  repair_ticket: RepairTicket | null;
  available_parts: PartOption[];
  recent_history: HistoryEntry[];
}

export default function Repairs() {
  const [imeiInput, setImeiInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [device, setDevice] = useState<DeviceRepairInfo | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [workCompleted, setWorkCompleted] = useState<string[]>([]);
  const [partsConsumed, setPartsConsumed] = useState<{ sku: string; qty: number }[]>([]);
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [repairRecorded, setRepairRecorded] = useState(false);
  const [routing, setRouting] = useState(false);
  const [selectedPart, setSelectedPart] = useState('');
  const [partQty, setPartQty] = useState(1);

  const inputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setWorkCompleted([]);
    setPartsConsumed([]);
    setNotes('');
    setRepairRecorded(false);
    setError('');
    setSuccessMsg('');
    setSelectedPart('');
    setPartQty(1);
  };

  const handleLookup = useCallback(async () => {
    const trimmed = imeiInput.trim();
    if (!trimmed) return;

    setLoading(true);
    setError('');
    setSuccessMsg('');
    setDevice(null);
    resetForm();

    try {
      const { data } = await api.get(`/api/repair/imei/${trimmed}`);
      setDevice(data);
      if (data.repair_ticket) {
        setRepairRecorded(true);
      }
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

  const toggleRepairOption = (opt: string) => {
    setWorkCompleted((prev) =>
      prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]
    );
  };

  const addPart = () => {
    if (!selectedPart) return;
    setPartsConsumed((prev) => {
      const existing = prev.find((p) => p.sku === selectedPart);
      if (existing) {
        return prev.map((p) => (p.sku === selectedPart ? { ...p, qty: p.qty + partQty } : p));
      }
      return [...prev, { sku: selectedPart, qty: partQty }];
    });
    setSelectedPart('');
    setPartQty(1);
  };

  const removePart = (sku: string) => {
    setPartsConsumed((prev) => prev.filter((p) => p.sku !== sku));
  };

  const handleSaveRepair = async () => {
    if (!device) return;

    setSaving(true);
    setError('');
    setSuccessMsg('');

    try {
      await api.post(`/api/repair/imei/${device.imei}/record`, {
        work_completed: workCompleted,
        parts_consumed: partsConsumed,
        notes: notes || null,
      });
      setRepairRecorded(true);
      setSuccessMsg('Repair recorded. Now route the device.');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to save repair';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  };

  const handleRoute = async (target: string) => {
    if (!device) return;

    setRouting(true);
    setError('');
    setSuccessMsg('');

    try {
      await api.post(`/api/repair/imei/${device.imei}/route`, {
        target,
        notes: workCompleted.length > 0 ? `Repairs done: ${workCompleted.join(', ')}` : null,
      });
      setSuccessMsg(`Device routed to ${target}.`);
      resetForm();
      setImeiInput('');
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to route device';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setRouting(false);
    }
  };

  const qcIssues = device?.qc_findings;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Wrench size={24} className="text-[var(--text)]" />
        <h2 className="text-xl font-bold text-[var(--text)]">Repairs</h2>
      </div>

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
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertTriangle size={16} /> {error}
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
          <CheckCircle size={16} /> {successMsg}
        </div>
      )}

      {device && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* LEFT: Device Details + QC Findings */}
          <div className="space-y-4">
            {/* Device Details */}
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
                <Detail label="Received" value={new Date(device.received_date).toLocaleDateString()} />
              </div>
            </div>

            {/* QC Findings */}
            {qcIssues && (
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  QC Findings
                </h3>
                <div className="space-y-1.5 text-sm">
                  {qcIssues.screen_condition && (
                    <QCItem label="Screen Condition" value={qcIssues.screen_condition} />
                  )}
                  {qcIssues.frame_condition && (
                    <QCItem label="Frame Condition" value={qcIssues.frame_condition} />
                  )}
                  {qcIssues.camera_lens_damage && (
                    <QCItem label="Camera Lens" value="Damaged" />
                  )}
                  {qcIssues.face_id_issue && (
                    <QCItem label="Face ID" value="Issue Detected" />
                  )}
                  {qcIssues.battery_service && (
                    <QCItem label="Battery" value="Service Needed" />
                  )}
                  {qcIssues.speaker_issue_ear && (
                    <QCItem label="Ear Speaker" value="Issue Detected" />
                  )}
                  {qcIssues.speaker_issue_loud && (
                    <QCItem label="Loud Speaker" value="Issue Detected" />
                  )}
                  {qcIssues.charging_port_issue && (
                    <QCItem label="Charging Port" value="Issue Detected" />
                  )}
                  {qcIssues.network_locked && (
                    <QCItem label="Network Lock" value="Locked" />
                  )}
                  {qcIssues.grade && (
                    <QCItem label="QC Grade" value={qcIssues.grade} />
                  )}
                  {qcIssues.notes && (
                    <div className="mt-2 p-2 rounded bg-[var(--bg-muted)] text-[var(--text-secondary)] text-xs">
                      <span className="font-semibold text-[var(--text-muted)]">QC Notes: </span>
                      {qcIssues.notes}
                    </div>
                  )}
                </div>
                {qcIssues.inspector_id && (
                  <p className="text-[10px] text-[var(--text-muted)] mt-2">
                    Inspected by {qcIssues.inspector_id} on {new Date(qcIssues.created_at).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Repair Form + Routing */}
          <div className="space-y-4">
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 space-y-5">
              <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider">Repair Actions</h3>

              {/* Repair checkboxes */}
              <div className="space-y-2">
                <span className="text-sm font-medium text-[var(--text)]">Work Completed</span>
                <div className="grid grid-cols-2 gap-2">
                  {REPAIR_OPTIONS.map((opt) => (
                    <label
                      key={opt}
                      className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer py-1"
                    >
                      <input
                        type="checkbox"
                        checked={workCompleted.includes(opt)}
                        onChange={() => toggleRepairOption(opt)}
                        disabled={repairRecorded}
                        className="w-4 h-4 rounded border-[var(--border-secondary)] bg-[var(--bg-muted)] accent-accent"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>

              {/* Parts selection */}
              <div className="space-y-2 pt-3 border-t border-[var(--border)]">
                <span className="text-sm font-medium text-[var(--text)]">Parts Used</span>

                {!repairRecorded && (
                  <div className="flex gap-2">
                    <select
                      value={selectedPart}
                      onChange={(e) => setSelectedPart(e.target.value)}
                      className="flex-1 px-3 py-2 bg-[var(--bg-muted)] border border-[var(--border-secondary)] rounded-lg text-sm text-[var(--text)] outline-none focus:border-accent"
                    >
                      <option value="">Select a part...</option>
                      {device.available_parts.map((p) => (
                        <option key={p.sku} value={p.sku}>
                          {p.part_name} ({p.in_stock} in stock)
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={partQty}
                      onChange={(e) => setPartQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 px-2 py-2 bg-[var(--bg-muted)] border border-[var(--border-secondary)] rounded-lg text-sm text-[var(--text)] text-center outline-none focus:border-accent"
                    />
                    <button
                      onClick={addPart}
                      disabled={!selectedPart}
                      className="px-3 py-2 bg-[var(--bg-muted)] border border-[var(--border-secondary)] rounded-lg text-sm text-[var(--text-secondary)] hover:border-accent disabled:opacity-50 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                )}

                {/* Selected parts list */}
                {partsConsumed.length > 0 && (
                  <div className="space-y-1">
                    {partsConsumed.map((pc) => {
                      const part = device.available_parts.find((p) => p.sku === pc.sku);
                      return (
                        <div key={pc.sku} className="flex items-center justify-between bg-[var(--bg-muted)] rounded-lg px-3 py-2 text-sm">
                          <span className="text-[var(--text)]">
                            {part?.part_name || pc.sku} x{pc.qty}
                          </span>
                          {!repairRecorded && (
                            <button
                              onClick={() => removePart(pc.sku)}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              Remove
                            </button>
                          )}
                        </div>
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
                  placeholder="Additional notes about the repair..."
                  rows={3}
                  disabled={repairRecorded}
                  className="w-full px-3 py-2 bg-[var(--bg-muted)] border border-[var(--border-secondary)] rounded-lg text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-accent resize-none disabled:opacity-60"
                />
              </div>

              {/* Save button */}
              {!repairRecorded && (
                <button
                  onClick={handleSaveRepair}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-accent text-white rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  <Save size={18} />
                  {saving ? 'Saving...' : 'Save Repair'}
                </button>
              )}

              {repairRecorded && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
                  <CheckCircle size={16} /> Repair recorded
                </div>
              )}
            </div>

            {/* Post-repair Routing */}
            {repairRecorded && (
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider">Route Device</h3>
                <div className="grid grid-cols-2 gap-3">
                  {ROUTING_ACTIONS.map((action) => (
                    <button
                      key={action.target}
                      onClick={() => handleRoute(action.target)}
                      disabled={routing}
                      className={`p-4 rounded-lg text-sm font-semibold border transition-all disabled:opacity-50 ${action.color}`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent History */}
      {device && device.recent_history.length > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5">
          <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4 flex items-center gap-2">
            <ClipboardList size={16} /> Transfer / Transition History
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  <th className="text-left py-2 pr-4">Date & Time</th>
                  <th className="text-left py-2 pr-4">Action</th>
                  <th className="text-left py-2 pr-4">Employee</th>
                  <th className="text-left py-2 pr-4">Previous Status</th>
                  <th className="text-left py-2 pr-4">New Status</th>
                  <th className="text-left py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {device.recent_history.map((h) => (
                  <tr key={h.log_id} className="border-t border-[var(--border)] text-[var(--text-secondary)]">
                    <td className="py-2 pr-4 whitespace-nowrap">{new Date(h.timestamp).toLocaleString()}</td>
                    <td className="py-2 pr-4 font-medium text-[var(--text)]">{h.action_type}</td>
                    <td className="py-2 pr-4">{h.employee_id}</td>
                    <td className="py-2 pr-4 text-[var(--text-muted)]">{h.previous_status || '-'}</td>
                    <td className="py-2 pr-4">{h.new_status}</td>
                    <td className="py-2 text-[var(--text-muted)] max-w-xs truncate">{h.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!device && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-[var(--text-tertiary)]">
          <Wrench size={40} className="mb-3 opacity-50" />
          <p className="text-sm">Scan or enter an IMEI to begin repair</p>
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

function QCItem({ label, value }: { label: string; value: string }) {
  const isBad =
    value.toLowerCase().includes('damaged') ||
    value.toLowerCase().includes('issue') ||
    value.toLowerCase().includes('poor') ||
    value.toLowerCase().includes('needed') ||
    value.toLowerCase().includes('locked') ||
    value.toLowerCase().includes('fail');

  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className={`font-medium text-xs px-2 py-0.5 rounded ${isBad ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
        {value}
      </span>
    </div>
  );
}
