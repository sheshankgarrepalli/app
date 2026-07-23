import { useState, useEffect } from 'react';
import { DollarSign, User, CheckCircle2, AlertCircle, Loader2, ArrowRight, LogOut, FileText } from 'lucide-react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useLocationFilter } from '../context/LocationContext';

export default function RegisterOpenClose() {
  const { user } = useAuth();
  const { availableLocations } = useLocationFilter();
  const storeId = user?.store_id || 'warehouse';
  const storeName = availableLocations.find(l => l.id === storeId)?.name || storeId;

  const [status, setStatus] = useState<'loading' | 'closed' | 'open'>('loading');
  const [session, setSession] = useState<any>(null);
  const [closeSummary, setCloseSummary] = useState<any>(null);
  const [openedBy, setOpenedBy] = useState('');
  const [openingFloat, setOpeningFloat] = useState('100');
  const [closedBy, setClosedBy] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/api/pos/register/status')
      .then(res => {
        if (res.data.status === 'open') {
          setStatus('open');
          setSession(res.data);
        } else {
          setStatus('closed');
        }
      })
      .catch(() => setStatus('closed'));
  }, []);

  const handleOpen = async () => {
    if (!openedBy.trim()) { setError('Enter who is opening the register'); return; }
    const float = parseFloat(openingFloat);
    if (isNaN(float) || float < 0) { setError('Enter a valid opening float'); return; }
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/api/pos/register/open', null, {
        params: { opened_by: openedBy.trim(), opening_float: float },
      });
      setSession(data);
      setStatus('open');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to open register');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    if (!closedBy.trim()) { setError('Enter who is closing the register'); return; }
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/api/pos/register/close', null, {
        params: { closed_by: closedBy.trim() },
      });
      setCloseSummary(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to close register');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return <div className="flex justify-center py-32"><Loader2 size={32} className="animate-spin text-accent" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-[var(--text)]">Register</h1>
        <p className="text-sm text-[var(--text-tertiary)] mt-0.5">{storeName}</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle size={16} />{error}
          <button onClick={() => setError(null)} className="ml-auto text-xs underline">Dismiss</button>
        </div>
      )}

      {status === 'closed' && !closeSummary && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
            <LogOut size={16} className="text-emerald-400" />
            <h3 className="text-sm font-bold text-[var(--text)]">Open Register</h3>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-1.5 flex items-center gap-1.5">
                <User size={12} /> Opening Employee
              </label>
              <input
                type="text"
                className="form-input w-full"
                placeholder="e.g. John"
                value={openedBy}
                onChange={e => setOpenedBy(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-1.5 flex items-center gap-1.5">
                <DollarSign size={12} /> Starting Cash Float
              </label>
              <input
                type="number"
                step="0.01"
                className="form-input w-full"
                placeholder="100.00"
                value={openingFloat}
                onChange={e => setOpeningFloat(e.target.value)}
              />
              <p className="text-[10px] text-[var(--text-tertiary)] mt-1">Change in the drawer (ones, fives, coins) — stays in register, not deposited</p>
            </div>
            <button
              onClick={handleOpen}
              disabled={loading}
              className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              Open Register
            </button>
          </div>
        </div>
      )}

      {status === 'open' && session && !closeSummary && (
        <div className="space-y-4">
          <div className="bg-[var(--bg-card)] rounded-xl border border-emerald-500/20 overflow-hidden">
            <div className="px-5 py-3 bg-emerald-500/5 border-b border-emerald-500/10 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span className="text-sm font-bold text-emerald-400">Register Open</span>
            </div>
            <div className="p-5 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Opened by</span><span className="font-bold text-[var(--text)]">{session.opened_by}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Float</span><span className="font-bold text-[var(--text)]">${session.opening_float.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Opened at</span><span className="font-bold text-[var(--text)]">{new Date(session.opened_at).toLocaleString()}</span></div>
            </div>
          </div>

          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
              <LogOut size={16} className="text-amber-400" />
              <h3 className="text-sm font-bold text-[var(--text)]">Close Register</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-1.5 flex items-center gap-1.5">
                  <User size={12} /> Closing Employee
                </label>
                <input
                  type="text"
                  className="form-input w-full"
                  placeholder="e.g. Jane"
                  value={closedBy}
                  onChange={e => setClosedBy(e.target.value)}
                />
              </div>
              <button
                onClick={handleClose}
                disabled={loading}
                className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                Close & Calculate
              </button>
            </div>
          </div>
        </div>
      )}

      {closeSummary && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="px-5 py-3 bg-blue-500/5 border-b border-blue-500/10 flex items-center gap-2">
            <FileText size={16} className="text-blue-400" />
            <span className="text-sm font-bold text-blue-400">Register Closed</span>
          </div>
          <div className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-[var(--bg-muted)]">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Opened by</div>
                <div className="font-bold text-[var(--text)]">{closeSummary.opened_by}</div>
              </div>
              <div className="p-3 rounded-lg bg-[var(--bg-muted)]">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Closed by</div>
                <div className="font-bold text-[var(--text)]">{closeSummary.closed_by}</div>
              </div>
            </div>

            <div className="border-t border-[var(--border)] pt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Opening float (change)</span>
                <span className="font-mono font-bold text-[var(--text)]">${closeSummary.opening_float.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Cash sales</span>
                <span className="font-mono font-bold text-emerald-400">+${closeSummary.cash_sales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-[var(--border)]">
                <span className="text-[var(--text-secondary)] font-bold">Expected cash in drawer</span>
                <span className="font-mono font-bold text-[var(--text)]">${closeSummary.expected_cash.toFixed(2)}</span>
              </div>
            </div>

            <div className="border-t border-[var(--border)] pt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Zelle payments</span>
                <span className="font-mono font-bold text-purple-400">${closeSummary.zelle_total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Card payments</span>
                <span className="font-mono font-bold text-blue-400">${closeSummary.card_total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Other payments</span>
                <span className="font-mono font-bold text-[var(--text-tertiary)]">${closeSummary.other_total.toFixed(2)}</span>
              </div>
            </div>

            <div className="border-t-2 border-[var(--border)] pt-3">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm font-bold text-[var(--text)]">Envelope amount</div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">Cash to deposit (cash sales only)</div>
                </div>
                <span className="text-2xl font-bold text-emerald-400">${closeSummary.envelope.toFixed(2)}</span>
              </div>
            </div>

            <div className="pt-3 text-[10px] text-[var(--text-tertiary)] text-center">
              Opened {new Date(closeSummary.opened_at).toLocaleString()} · Closed {new Date(closeSummary.closed_at).toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
