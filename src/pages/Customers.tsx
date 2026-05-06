import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Phone, Mail, Building2, User, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { fetchCustomers, Customer } from '../api/crm';

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (searchTerm?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCustomers(searchTerm || undefined);
      setCustomers(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(search || undefined);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Customers</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">Manage retail & wholesale accounts</p>
        </div>
        <Link to="/admin/customers/new" className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={16} />
          New Customer
        </Link>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, company, or phone..."
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-accent"
          />
        </div>
        <button type="submit" className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium">Search</button>
      </form>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-[var(--text-tertiary)]" />
        </div>
      ) : customers.length === 0 ? (
        <div className="card text-center py-16">
          <User size={48} className="mx-auto text-[var(--text-tertiary)] mb-3 opacity-30" />
          <p className="text-[var(--text-secondary)] font-medium">No customers found</p>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">
            {search ? 'Try a different search term' : 'Create your first customer to get started'}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-standard">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Contact</th>
                  <th>Balance</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.crm_id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-accent font-semibold text-sm flex-shrink-0">
                          {c.customer_type === 'Wholesale'
                            ? (c.company_name || 'W')[0].toUpperCase()
                            : ((c.first_name || 'R')[0].toUpperCase())}
                        </div>
                        <div>
                          <div className="font-medium text-[var(--text-primary)] text-sm">
                            {c.customer_type === 'Wholesale'
                              ? c.company_name || 'Unknown Company'
                              : `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown Customer'}
                          </div>
                          {c.customer_type === 'Wholesale' && c.contact_person && (
                            <div className="text-xs text-[var(--text-tertiary)]">{c.contact_person}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.customer_type === 'Wholesale'
                          ? 'bg-purple-500/10 text-purple-400'
                          : 'bg-blue-500/10 text-blue-400'
                      }`}>
                        {c.customer_type === 'Wholesale' ? <Building2 size={12} /> : <User size={12} />}
                        {c.customer_type}
                        {c.wholesale_subtype === 'consignee' && ' · Consignee'}
                      </span>
                    </td>
                    <td>
                      <div className="text-sm text-[var(--text-secondary)] space-y-0.5">
                        {c.phone && <div className="flex items-center gap-1.5"><Phone size={12} className="text-[var(--text-tertiary)]" />{c.phone}</div>}
                        {c.email && <div className="flex items-center gap-1.5"><Mail size={12} className="text-[var(--text-tertiary)]" />{c.email}</div>}
                      </div>
                    </td>
                    <td>
                      {c.customer_type === 'Wholesale' ? (
                        <div className="text-sm">
                          <span className={`font-mono font-medium ${c.current_balance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            ${c.current_balance.toLocaleString()}
                          </span>
                          {c.credit_limit > 0 && (
                            <span className="text-[var(--text-tertiary)] text-xs ml-1">/ ${c.credit_limit.toLocaleString()}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-[var(--text-tertiary)]">—</span>
                      )}
                    </td>
                    <td>
                      <Link
                        to={`/admin/customers/${c.crm_id}`}
                        className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        <ChevronRight size={18} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
