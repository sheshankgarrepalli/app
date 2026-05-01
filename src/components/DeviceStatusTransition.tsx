import { useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  X, ChevronRight, ArrowLeft, CheckCircle2, AlertTriangle,
  MapPin, Package, Wrench, Truck, Ban, Hammer, Clipboard,
  RefreshCw, Zap
} from 'lucide-react';

interface Transition {
  target: string;
  label: string;
  requirements: string[];
}

interface Props {
  device: {
    imei: string;
    device_status: string | null;
    location_id: string;
    sub_location_bin: string | null;
    model_number?: string | null;
  };
  onTransitionComplete: () => void;
  variant?: 'badge' | 'button' | 'inline';
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  Sellable: <CheckCircle2 size={14} />,
  In_QC: <Clipboard size={14} />,
  In_Repair: <Wrench size={14} />,
  In_Transit: <Truck size={14} />,
  Sold: <Zap size={14} />,
  Awaiting_Parts: <Package size={14} />,
  Reserved_Layaway: <Package size={14} />,
  Scrapped: <Ban size={14} />,
  Transit_to_QC: <Truck size={14} />,
  Transit_to_Repair: <Truck size={14} />,
  Transit_to_Main_Bin: <Truck size={14} />,
  Pending_Acknowledgment: <RefreshCw size={14} />,
};

const STATUS_COLOR: Record<string, string> = {
  Sellable: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  In_QC: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  In_Repair: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  In_Transit: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Sold: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  Awaiting_Parts: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Reserved_Layaway: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  Scrapped: 'bg-red-500/10 text-red-400 border-red-500/20',
  Transit_to_QC: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  Transit_to_Repair: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  Transit_to_Main_Bin: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  Pending_Acknowledgment: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/20',
};

const REQ_LABELS: Record<string, string> = {
  location: 'Bin / Floor location required',
  notes: 'Notes or reason required',
  ticket: 'Repair ticket will be created automatically',
  transfer: 'Transfer order required',
  technician: 'Technician assignment required',
};

const LOCATIONS = ['Warehouse_Alpha', 'Store_A', 'Store_B', 'Store_C'];
const BINS = ['Receiving_Bay', 'Main_Floor', 'QC_Station', 'Repair_Bench', 'Bin_A1', 'Bin_A2', 'Bin_B1', 'Bin_B2', 'Reserved'];

export default function DeviceStatusTransition({ device, onTransitionComplete, variant = 'badge' }: Props) {
  const { token } = useAuth();
  const API = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000');

  const [isOpen, setIsOpen] = useState(false);
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [isLoadingTransitions, setIsLoadingTransitions] = useState(false);

  // Flow: pick target → fill requirements → execute
  const [step, setStep] = useState<'select' | 'details'>('select');
  const [selectedTarget, setSelectedTarget] = useState<Transition | null>(null);
  const [formData, setFormData] = useState({
    location_id: device.location_id || '',
    sub_location_bin: '',
    notes: '',
    technician_id: '',
    transfer_id: '',
    defects: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [serverResult, setServerResult] = useState<{
    ticket_id?: number | null;
    transfer_id?: string | null;
  } | null>(null);

  const fetchTransitions = useCallback(async () => {
    setIsLoadingTransitions(true);
    try {
      const res = await axios.get(`${API}/api/inventory/${device.imei}/transitions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTransitions(res.data);
    } catch (_) {
      setTransitions([]);
    } finally {
      setIsLoadingTransitions(false);
    }
  }, [API, device.imei, token]);

  const open = () => {
    setIsOpen(true);
    setStep('select');
    setSelectedTarget(null);
    setError('');
    setServerResult(null);
    setFormData({
      location_id: device.location_id || '',
      sub_location_bin: '',
      notes: '',
      technician_id: '',
      transfer_id: '',
      defects: '',
    });
    fetchTransitions();
  };

  const handleSelectTarget = (t: Transition) => {
    setSelectedTarget(t);
    setStep('details');
    setError('');
  };

  const handleBack = () => {
    setStep('select');
    setSelectedTarget(null);
    setError('');
  };

  const handleSubmit = async () => {
    if (!selectedTarget) return;
    setIsSubmitting(true);
    setError('');

    try {
      const payload: Record<string, any> = { target: selectedTarget.target };

      if (selectedTarget.requirements.includes('location')) {
        payload.location_id = formData.location_id;
        payload.sub_location_bin = formData.sub_location_bin || undefined;
      }
      if (selectedTarget.requirements.includes('notes')) {
        payload.notes = formData.notes || undefined;
      }
      if (selectedTarget.requirements.includes('technician')) {
        payload.technician_id = formData.technician_id || undefined;
      }
      if (selectedTarget.requirements.includes('transfer')) {
        payload.transfer_id = formData.transfer_id || undefined;
      }
      if (selectedTarget.requirements.includes('ticket')) {
        const defectsArr = formData.defects
          ? formData.defects.split(',').map(d => d.trim()).filter(Boolean)
          : [];
        payload.defects = defectsArr.length > 0 ? defectsArr : undefined;
        payload.notes = formData.notes || undefined;
      }

      const res = await axios.post(`${API}/api/inventory/${device.imei}/transition`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setServerResult({
        ticket_id: res.data.ticket_id,
        transfer_id: res.data.transfer_id,
      });

      setTimeout(() => {
        setIsOpen(false);
        onTransitionComplete();
      }, 1200);

    } catch (err: any) {
      setError(err.response?.data?.detail || 'Transition failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentStatus = device.device_status || 'None';
  const statusLabel = currentStatus.replace(/_/g, ' ');
  const icon = STATUS_ICON[currentStatus] || <Package size={14} />;
  const colorClass = STATUS_COLOR[currentStatus] || 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';

  return (
    <>
      {/* Trigger */}
      {variant === 'badge' ? (
        <button
          onClick={open}
          className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border transition-all hover:scale-105 ${colorClass}`}
        >
          {icon} {statusLabel}
        </button>
      ) : variant === 'button' ? (
        <button
          onClick={open}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-zinc-200 dark:border-[#1f1f21] text-zinc-500 dark:text-[#71717a] hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] transition-colors"
        >
          <RefreshCw size={13} /> Change Status
        </button>
      ) : (
        <button
          onClick={open}
          className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded border transition-all hover:scale-105 ${colorClass}`}
        >
          {icon} {statusLabel}
        </button>
      )}

      {/* Slide-out Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-zinc-900/50 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

          {/* Drawer panel */}
          <div className="relative w-full max-w-[440px] h-full bg-white dark:bg-[#141416] border-l border-zinc-200 dark:border-[#1f1f21] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="shrink-0 p-5 border-b border-zinc-100 dark:border-[#1a1a1c]">
              <div className="flex items-center justify-between mb-3">
                {step === 'details' ? (
                  <button onClick={handleBack} className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 dark:text-[#71717a] hover:text-zinc-900 dark:hover:text-[#e4e4e7] uppercase tracking-wider transition-colors">
                    <ArrowLeft size={14} /> Back
                  </button>
                ) : (
                  <div />
                )}
                <button onClick={() => setIsOpen(false)} className="text-zinc-400 dark:text-[#71717a] hover:text-zinc-900 dark:hover:text-[#e4e4e7] transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-[#e4e4e7] uppercase tracking-wide">
                  {step === 'select' ? 'Transition Device' : selectedTarget?.label}
                </h2>
                <p className="text-[10px] font-semibold text-zinc-400 dark:text-[#71717a] uppercase tracking-widest mt-1 flex items-center gap-2">
                  <span className="font-mono text-zinc-500 dark:text-[#a1a1aa]">{device.imei}</span>
                  {device.model_number && (
                    <>
                      <span className="text-zinc-300 dark:text-[#3f3f46]">&middot;</span>
                      <span className="text-zinc-400 dark:text-[#52525b]">{device.model_number}</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {step === 'select' ? (
                <div className="space-y-4">
                  {/* Current state */}
                  <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-50 dark:bg-[#0a0a0b] border border-zinc-200 dark:border-[#1f1f21]">
                    <span className="text-[10px] font-bold text-zinc-500 dark:text-[#71717a] uppercase tracking-widest">Current Status</span>
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${colorClass}`}>
                      {icon} {statusLabel}
                    </span>
                  </div>

                  {/* Available transitions */}
                  <div>
                    <h3 className="text-[10px] font-bold text-zinc-500 dark:text-[#71717a] uppercase tracking-widest mb-3 ml-1">
                      Available Transitions
                    </h3>

                    {isLoadingTransitions ? (
                      <div className="py-8 text-center text-xs text-zinc-400 dark:text-[#52525b] animate-pulse">
                        Loading available transitions...
                      </div>
                    ) : transitions.length === 0 ? (
                      <div className="py-8 text-center border border-zinc-200 dark:border-[#1f1f21] rounded-lg">
                        <div className="text-xs font-semibold text-zinc-400 dark:text-[#71717a] uppercase tracking-wider">
                          No transitions available
                        </div>
                        <p className="text-[10px] text-zinc-400 dark:text-[#52525b] mt-1">
                          This device is in a terminal state
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {transitions.map(t => {
                          const reqCount = t.requirements.length;
                          const tIcon = STATUS_ICON[t.target] || <Package size={14} />;
                          const tColor = STATUS_COLOR[t.target] || 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
                          return (
                            <button
                              key={t.target}
                              onClick={() => handleSelectTarget(t)}
                              className="w-full text-left p-4 rounded-lg border border-zinc-200 dark:border-[#1f1f21] hover:border-accent/40 hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] transition-all group"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border ${tColor}`}>
                                    {tIcon}
                                  </span>
                                  <div>
                                    <div className="text-xs font-bold text-zinc-800 dark:text-[#e4e4e7] uppercase tracking-wide">
                                      {t.label}
                                    </div>
                                    {reqCount > 0 && (
                                      <div className="text-[9px] font-semibold text-zinc-400 dark:text-[#52525b] mt-0.5">
                                        {t.requirements.map(r => REQ_LABELS[r] || r).join(' · ')}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <ChevronRight size={16} className="text-zinc-300 dark:text-[#3f3f46] group-hover:text-accent transition-colors" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : selectedTarget ? (
                /* Step 2: Requirements form */
                <div className="space-y-5">
                  {/* Info banner */}
                  <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
                    <p className="text-[10px] font-semibold text-accent uppercase tracking-wider">
                      Transitioning to {selectedTarget.label}
                    </p>
                    {selectedTarget.requirements.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {selectedTarget.requirements.map(r => (
                          <div key={r} className="flex items-center gap-2 text-[9px] font-medium text-zinc-500 dark:text-[#71717a]">
                            <div className="w-1 h-1 rounded-full bg-accent/60" />
                            {REQ_LABELS[r] || r}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Location fields */}
                  {selectedTarget.requirements.includes('location') && (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#71717a] ml-1 flex items-center gap-1.5">
                          <MapPin size={12} /> Target Location
                        </label>
                        <select
                          value={formData.location_id}
                          onChange={e => setFormData({ ...formData, location_id: e.target.value })}
                          className="input-stark w-full py-3 text-xs font-bold uppercase tracking-wider"
                        >
                          <option value="">Select location...</option>
                          {LOCATIONS.map(l => (
                            <option key={l} value={l}>{l.replace('_', ' ')}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#71717a] ml-1 flex items-center gap-1.5">
                          <Package size={12} /> Sub-Location / Bin
                        </label>
                        <select
                          value={formData.sub_location_bin}
                          onChange={e => setFormData({ ...formData, sub_location_bin: e.target.value })}
                          className="input-stark w-full py-3 text-xs font-bold uppercase tracking-wider"
                        >
                          <option value="">Select bin...</option>
                          {BINS.map(b => (
                            <option key={b} value={b}>{b.replace('_', ' ')}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={formData.sub_location_bin}
                          onChange={e => setFormData({ ...formData, sub_location_bin: e.target.value })}
                          placeholder="Or type custom bin name..."
                          className="input-stark w-full py-2.5 text-xs font-bold uppercase tracking-wider mt-1"
                        />
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {(selectedTarget.requirements.includes('notes') || selectedTarget.requirements.includes('ticket')) && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#71717a] ml-1 flex items-center gap-1.5">
                        <Clipboard size={12} /> Notes
                      </label>
                      <textarea
                        value={formData.notes}
                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        placeholder={
                          selectedTarget.target === 'Scrapped' ? "Reason for scrapping..." :
                          selectedTarget.target === 'In_QC' ? "QC check details..." :
                          "Internal notes..."
                        }
                        className="input-stark w-full py-3 text-xs h-24 resize-none placeholder:text-[11px] placeholder:font-medium placeholder:text-zinc-400 dark:placeholder:text-[#52525b]"
                      />
                    </div>
                  )}

                  {/* Defects (ticket creation) */}
                  {selectedTarget.requirements.includes('ticket') && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#71717a] ml-1 flex items-center gap-1.5">
                        <Wrench size={12} /> Reported Defects
                      </label>
                      <input
                        value={formData.defects}
                        onChange={e => setFormData({ ...formData, defects: e.target.value })}
                        placeholder="Screen crack, Battery drain, Won't charge (comma-separated)"
                        className="input-stark w-full py-3 text-xs font-semibold placeholder:text-[11px] placeholder:font-medium placeholder:text-zinc-400 dark:placeholder:text-[#52525b]"
                      />
                      <p className="text-[9px] font-semibold text-zinc-400 dark:text-[#52525b] ml-1">
                        These become the repair checklist items
                      </p>
                    </div>
                  )}

                  {/* Transfer ID */}
                  {selectedTarget.requirements.includes('transfer') && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#71717a] ml-1 flex items-center gap-1.5">
                        <Truck size={12} /> Transfer Order ID
                      </label>
                      <input
                        value={formData.transfer_id}
                        onChange={e => setFormData({ ...formData, transfer_id: e.target.value })}
                        placeholder="TO-XXXXXXXX or MAN-XXXXXXXX"
                        className="input-stark w-full py-3 font-mono text-xs font-bold tracking-wider placeholder:font-sans placeholder:text-[11px] placeholder:tracking-normal placeholder:text-zinc-400 dark:placeholder:text-[#52525b]"
                      />
                    </div>
                  )}

                  {/* Technician */}
                  {selectedTarget.requirements.includes('technician') && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#71717a] ml-1 flex items-center gap-1.5">
                        <Hammer size={12} /> Technician
                      </label>
                      <input
                        value={formData.technician_id}
                        onChange={e => setFormData({ ...formData, technician_id: e.target.value })}
                        placeholder="Technician email or ID..."
                        className="input-stark w-full py-3 text-xs font-semibold placeholder:text-[11px] placeholder:font-medium placeholder:text-zinc-400 dark:placeholder:text-[#52525b]"
                      />
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-[10px] font-bold uppercase tracking-widest">
                      <AlertTriangle size={14} /> {error}
                    </div>
                  )}

                  {/* Success */}
                  {serverResult && (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg space-y-1.5">
                      <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
                        <CheckCircle2 size={14} /> Transition Successful
                      </div>
                      {serverResult.ticket_id && (
                        <p className="text-[10px] font-semibold text-emerald-400/70 ml-6">
                          Repair ticket #{serverResult.ticket_id} created
                        </p>
                      )}
                      {serverResult.transfer_id && (
                        <p className="text-[10px] font-semibold text-emerald-400/70 ml-6">
                          Linked to transfer {serverResult.transfer_id}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Footer */}
            {step === 'details' && selectedTarget && (
              <div className="shrink-0 p-5 border-t border-zinc-100 dark:border-[#1a1a1c] flex gap-3">
                <button
                  onClick={handleBack}
                  className="flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-zinc-200 dark:border-[#1f1f21] text-zinc-500 dark:text-[#71717a] hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !!serverResult}
                  className="flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-lg bg-accent hover:bg-accent/90 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? 'Executing...' : serverResult ? 'Done' : (
                    <>
                      <RefreshCw size={14} /> Confirm Transition
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
