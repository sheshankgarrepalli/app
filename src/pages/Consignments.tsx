import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Loader2, AlertCircle, PackageOpen, Clock, CheckCircle2, ChevronRight } from 'lucide-react';
import { fetchBatches, ConsignmentBatch, extractError } from '../api/crm';

const statusBadge = (s: string) => {
  if (s === 'active') return 'badge-sellable';
  return 'badge-sold';
};

export default function Consignments() {
  const [batches, setBatches] = useState<ConsignmentBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBatches();
      setBatches(data);
    } catch (err: any) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isOverdue = (dueDate: string) => new Date(dueDate) < new Date();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Consignments</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">Manage device handoffs to consignees</p>
        </div>
        <Link to="/admin/consignments/new" className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={16} />
          New Handoff
        </Link>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle size={16} />{error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-[var(--text-tertiary)]" />
        </div>
      ) : batches.length === 0 ? (
        <div className="card text-center py-16">
          <PackageOpen size={48} className="mx-auto text-[var(--text-tertiary)] mb-3 opacity-30" />
          <p className="text-[var(--text-secondary)] font-medium">No consignment batches</p>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">Create a handoff to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {batches.map(b => (
            <Link
              key={b.id}
              to={`/admin/consignments/${b.id}`}
              className="card flex items-center gap-4 p-4 hover:border-accent/30 transition-colors cursor-pointer"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                b.status === 'active' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
              }`}>
                {b.status === 'active' ? <Clock size={20} /> : <CheckCircle2 size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">{b.id}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${statusBadge(b.status)}`}>
                    {b.status}
                  </span>
                  {b.status === 'active' && isOverdue(b.due_date) && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-red-500/10 text-red-400">
                      Overdue
                    </span>
                  )}
                </div>
                <div className="text-sm text-[var(--text-secondary)] mt-0.5">
                  {b.customer?.company_name || b.crm_id} · {b.items.length} item{b.items.length !== 1 ? 's' : ''}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-xs text-[var(--text-tertiary)]">
                  Due {new Date(b.due_date).toLocaleDateString()}
                </div>
                {b.status === 'active' && (
                  <div className="text-xs text-accent font-medium mt-0.5">Needs settlement</div>
                )}
              </div>
              <ChevronRight size={16} className="text-[var(--text-tertiary)]" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
