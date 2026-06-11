import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Loader2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../api/api';
import { useLocationFilter } from '../context/LocationContext';
import MetricCard from '../components/MetricCard';

interface AgingInvoice {
  invoice_number: string;
  total: number;
  paid: number;
  balance: number;
  due_date: string | null;
  created_at: string | null;
  status: string;
}

interface AgingCustomer {
  crm_id: string;
  customer_name: string;
  customer_type: string;
  total_outstanding: number;
  current: number;
  '1_30': number;
  '31_60': number;
  '61_90': number;
  '90_plus': number;
  invoices: AgingInvoice[];
}

interface AgingResponse {
  customers: AgingCustomer[];
  totals: {
    current: number;
    '1_30': number;
    '31_60': number;
    '61_90': number;
    '90_plus': number;
    total_outstanding: number;
  };
  customer_count: number;
}

const formatCurrency = (n: number) => `$${n.toFixed(2)}`;

export default function ArAging() {
  const { selectedLocationId } = useLocationFilter();
  const [data, setData] = useState<AgingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<'name' | 'balance'>('balance');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await api.get('/api/reports/ar-aging', { params: { store_id: selectedLocationId || undefined } });
      setData(res);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load AR aging report');
    } finally {
      setLoading(false);
    }
  }, [selectedLocationId]);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = (crmId: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(crmId) ? next.delete(crmId) : next.add(crmId);
      return next;
    });
  };

  const sorted = useMemo(() => {
    if (!data) return [];
    const list = [...data.customers];
    const q = search.toLowerCase();
    const filtered = list.filter(c =>
      c.customer_name.toLowerCase().includes(q) ||
      c.crm_id.toLowerCase().includes(q)
    );
    filtered.sort((a, b) => {
      let va: any, vb: any;
      if (sortField === 'name') {
        va = a.customer_name.toLowerCase();
        vb = b.customer_name.toLowerCase();
      } else {
        va = a.total_outstanding;
        vb = b.total_outstanding;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [data, search, sortField, sortDir]);

  const handleSort = (field: 'name' | 'balance') => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: 'name' | 'balance' }) => {
    if (sortField !== field) return <ChevronDown size={12} className="opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  const getCustomerInitial = (name: string) => {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={28} className="animate-spin text-[var(--text-tertiary)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4">
        <AlertCircle size={16} /> {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">AR Aging Report</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
            {data.customer_count} {data.customer_count === 1 ? 'customer' : 'customers'} with outstanding balances
          </p>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        <MetricCard label="Total Outstanding" value={formatCurrency(data.totals.total_outstanding)} accent="accent" emphasis />
        <MetricCard label="Current" value={formatCurrency(data.totals.current)} accent="success" />
        <MetricCard label="1-30 Days" value={formatCurrency(data.totals['1_30'])} accent="warning" />
        <MetricCard label="31-60 Days" value={formatCurrency(data.totals['31_60'])} accent="orange" />
        <MetricCard label="61-90 Days" value={formatCurrency(data.totals['61_90'])} accent="orange" />
        <MetricCard label="90+ Days" value={formatCurrency(data.totals['90_plus'])} accent="destructive" />
      </div>

      {/* Search */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            type="text"
            className="form-input pl-9 text-sm w-full"
            placeholder="Search customer name or ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <div className="text-center py-10 text-[var(--text-tertiary)] text-sm">
          {search ? 'No customers match your search' : 'No outstanding balances — all clear!'}
        </div>
      ) : (
        <div className="card">
          <table className="table-standard">
            <thead>
              <tr>
                <th className="w-10" />
                <th onClick={() => handleSort('name')} className="cursor-pointer select-none">
                  <div className="flex items-center gap-1">
                    Customer <SortIcon field="name" />
                  </div>
                </th>
                <th>Type</th>
                <th>Current</th>
                <th>1-30 Days</th>
                <th>31-60 Days</th>
                <th>61-90 Days</th>
                <th>90+ Days</th>
                <th onClick={() => handleSort('balance')} className="cursor-pointer select-none text-right">
                  <div className="flex items-center justify-end gap-1">
                    Balance <SortIcon field="balance" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(c => {
                const isOpen = expanded.has(c.crm_id);
                return (
                  <>
                    <tr
                      key={c.crm_id}
                      onClick={() => toggleExpand(c.crm_id)}
                      className="cursor-pointer hover:bg-[var(--bg-muted)]"
                    >
                      <td>
                        <ChevronDown
                          size={16}
                          className={`transition-transform ${isOpen ? 'rotate-180' : ''} text-[var(--text-tertiary)]`}
                        />
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {getCustomerInitial(c.customer_name)}
                          </div>
                          <span className="font-medium text-sm">{c.customer_name}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${c.customer_type === 'Wholesale' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                          {c.customer_type}
                        </span>
                      </td>
                      <td className={c.current > 0 ? 'text-[var(--success)] font-medium' : 'text-[var(--text-tertiary)]'}>
                        {formatCurrency(c.current)}
                      </td>
                      <td className={c['1_30'] > 0 ? 'text-[var(--warning)] font-medium' : 'text-[var(--text-tertiary)]'}>
                        {formatCurrency(c['1_30'])}
                      </td>
                      <td className={c['31_60'] > 0 ? 'text-[#f59e0b] font-medium' : 'text-[var(--text-tertiary)]'}>
                        {formatCurrency(c['31_60'])}
                      </td>
                      <td className={c['61_90'] > 0 ? 'text-[#ea580c] font-medium' : 'text-[var(--text-tertiary)]'}>
                        {formatCurrency(c['61_90'])}
                      </td>
                      <td className={c['90_plus'] > 0 ? 'text-[var(--destructive)] font-medium' : 'text-[var(--text-tertiary)]'}>
                        {formatCurrency(c['90_plus'])}
                      </td>
                      <td className="text-right font-bold text-sm">
                        {formatCurrency(c.total_outstanding)}
                      </td>
                    </tr>
                    {isOpen && c.invoices.map(inv => (
                      <tr key={inv.invoice_number} className="bg-[var(--bg-muted)] text-xs">
                        <td />
                        <td colSpan={2} className="pl-10 text-[var(--text-secondary)]">
                          {inv.invoice_number}
                        </td>
                        <td colSpan={5} className="text-[var(--text-tertiary)]">
                          Due: {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'None'} 
                          {' · '}Status: <span className="font-semibold capitalize">{inv.status.replace(/_/g, ' ')}</span>
                        </td>
                        <td className="text-right font-mono text-xs">
                          <div className="text-[var(--text)] font-semibold">{formatCurrency(inv.balance)}</div>
                          <div className="text-[var(--text-tertiary)]">of {formatCurrency(inv.total)}</div>
                        </td>
                      </tr>
                    ))}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
