import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Loader2, X, KeyRound } from 'lucide-react';
import api from '../../api/api';
import { useToast } from '../Toast';

interface UserRow {
  id: number;
  email: string;
  role: 'admin' | 'warehouse' | 'store' | 'technician';
  store_id: string | null;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'store', label: 'Store' },
  { value: 'technician', label: 'Technician' },
];

export default function UsersTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/auth/users');
      setUsers(data);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (user: UserRow) => {
    if (!confirm(`Delete ${user.email}? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/auth/users/${user.id}`);
      toast.success(`${user.email} deleted`);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Delete failed');
    }
  };

  const handleToggleActive = async (user: UserRow) => {
    try {
      await api.put(`/api/auth/users/${user.id}`, { is_active: !user.is_active });
      toast.success(user.is_active ? 'User disabled' : 'User enabled');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Update failed');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={28} className="animate-spin text-[var(--text-tertiary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[var(--text)]">Users</h2>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{users.length} total · admins can create, edit, and disable accounts</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-primary flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
        >
          <Plus size={16} /> Add User
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="table-standard">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last Login</th>
              <th className="text-right w-40">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-[var(--text-tertiary)] py-6 text-sm">
                  No users yet
                </td>
              </tr>
            )}
            {users.map(u => (
              <tr key={u.id}>
                <td className="font-medium text-sm">{u.email}</td>
                <td>
                  <span className="inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-[var(--bg-muted)] text-[var(--text-secondary)]">
                    {u.role}
                  </span>
                </td>
                <td>
                  {u.is_active ? (
                    <span className="text-[var(--success)] text-xs font-semibold">● Active</span>
                  ) : (
                    <span className="text-[var(--text-tertiary)] text-xs font-semibold">○ Disabled</span>
                  )}
                </td>
                <td className="text-xs text-[var(--text-tertiary)]">
                  {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => setResetTarget(u)}
                      className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)] rounded transition-colors"
                      title="Reset password"
                    >
                      <KeyRound size={14} />
                    </button>
                    <button
                      onClick={() => handleToggleActive(u)}
                      className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider rounded text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] transition-colors"
                    >
                      {u.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => handleDelete(u)}
                      className="p-1.5 text-[var(--destructive)] hover:bg-red-500/10 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onSuccess={load} />}
      {resetTarget && <ResetPasswordModal user={resetTarget} onClose={() => setResetTarget(null)} />}
    </div>
  );
}

function AddUserModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('store');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/api/auth/users', { email, password, role });
      toast.success(`Created ${email}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-6 w-full max-w-md space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[var(--text)]">Add User</h3>
          <button type="button" onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text)]">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="p-3 text-sm rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">{error}</div>
        )}

        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Email</label>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            placeholder="alice@amafahelectronics.com"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Password (min 8 chars)</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Role</label>
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          >
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-muted)]">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="flex-1 btn-primary flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50">
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Create
          </button>
        </div>
      </form>
    </div>
  );
}

function ResetPasswordModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.put(`/api/auth/users/${user.id}`, { password });
      toast.success(`Password reset for ${user.email}`);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-6 w-full max-w-md space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[var(--text)]">Reset Password</h3>
          <button type="button" onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text)]">
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-[var(--text-secondary)]">
          Set a new password for <strong>{user.email}</strong>.
        </p>

        {error && (
          <div className="p-3 text-sm rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">{error}</div>
        )}

        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">New Password (min 8 chars)</label>
          <input
            type="password"
            required
            minLength={8}
            autoFocus
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-muted)]">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="flex-1 btn-primary flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50">
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
