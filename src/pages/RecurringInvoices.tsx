import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
    Plus, Pause, Play, Trash2, Edit3, FileText,
    Calendar, Clock, X, Loader2, Save
} from 'lucide-react';

type RecurringTemplate = {
    id: number;
    org_id: number;
    customer_id: number;
    frequency: 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly';
    interval_value: number;
    next_run_date: string;
    end_date: string | null;
    auto_send: boolean;
    status: 'Active' | 'Paused' | 'Completed';
    line_items: string;
    terms: string;
    message_on_invoice: string | null;
    created_at: string;
    updated_at: string;
    customer?: { name?: string; company_name?: string };
};

type RecurringLog = {
    id: number;
    template_id: number;
    executed_at: string;
    resulting_invoice_id: number | null;
    status: string;
    error_message: string | null;
};

const FREQUENCIES = ['Weekly', 'Monthly', 'Quarterly', 'Yearly'] as const;

const EMPTY_FORM = {
    customer_id: null as number | null,
    frequency: 'Monthly' as 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly',
    interval_value: 1,
    next_run_date: '',
    end_date: '',
    auto_send: false,
    line_items: '[]',
    terms: 'Due on Receipt',
    message_on_invoice: '',
};

export default function RecurringInvoices() {
    const { token } = useAuth();
    const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const [customerResults, setCustomerResults] = useState<any[]>([]);
    const [_selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [showLog, setShowLog] = useState<number | null>(null);
    const [logs, setLogs] = useState<RecurringLog[]>([]);

    const fetchTemplates = async () => {
        setIsLoading(true);
        try {
            const res = await axios.get('/api/pos/invoices/recurring', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTemplates(res.data);
        } catch (err) {
            console.error("Fetch recurring templates error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchTemplates(); }, []);

    const searchCustomers = async (q: string) => {
        setCustomerSearch(q);
        if (q.length < 2) { setCustomerResults([]); return; }
        try {
            const res = await axios.get(`/api/crm/search?q=${encodeURIComponent(q)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCustomerResults(res.data?.slice(0, 8) || []);
        } catch {}
    };

    const selectCustomer = (cust: any) => {
        setSelectedCustomer(cust);
        setForm(prev => ({ ...prev, customer_id: cust.id }));
        setCustomerSearch(cust.company_name || cust.name);
        setCustomerResults([]);
    };

    const editTemplate = (t: RecurringTemplate) => {
        setEditingId(t.id);
        setForm({
            customer_id: t.customer_id,
            frequency: t.frequency,
            interval_value: t.interval_value,
            next_run_date: t.next_run_date?.split('T')[0] || '',
            end_date: t.end_date?.split('T')[0] || '',
            auto_send: t.auto_send,
            line_items: t.line_items,
            terms: t.terms,
            message_on_invoice: t.message_on_invoice || '',
        });
        setSelectedCustomer(t.customer || null);
        setCustomerSearch(t.customer?.company_name || t.customer?.name || '');
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!form.customer_id || !form.next_run_date) {
            setError('Customer and next run date are required');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const payload = {
                ...form,
                next_run_date: new Date(form.next_run_date).toISOString(),
                end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
            };
            if (editingId) {
                await axios.put(`/api/pos/invoices/recurring/${editingId}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post('/api/pos/invoices/recurring', payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            resetForm();
            fetchTemplates();
        } catch (e: any) {
            setError(e?.response?.data?.detail || 'Failed to save template');
        } finally {
            setSaving(false);
        }
    };

    const toggleStatus = async (id: number, current: string) => {
        const action = current === 'Active' ? 'pause' : 'resume';
        try {
            await axios.post(`/api/pos/invoices/recurring/${id}/${action}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchTemplates();
        } catch {}
    };

    const deleteTemplate = async (id: number) => {
        if (!confirm('Delete this recurring template?')) return;
        try {
            await axios.delete(`/api/pos/invoices/recurring/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchTemplates();
        } catch {}
    };

    const fetchLogs = async (templateId: number) => {
        try {
            const res = await axios.get(`/api/pos/invoices/recurring/${templateId}/log`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setLogs(res.data);
            setShowLog(templateId);
        } catch {}
    };

    const resetForm = () => {
        setForm(EMPTY_FORM);
        setEditingId(null);
        setShowForm(false);
        setSelectedCustomer(null);
        setCustomerSearch('');
        setError(null);
    };

    const freqLabel = (f: string, interval: number) => {
        if (interval === 1) return f;
        return `Every ${interval} ${f}`;
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50 dark:bg-[#0a0a0b]">
            <header className="p-6 bg-white dark:bg-[#141416] border-b border-zinc-200 dark:border-[#1f1f21] flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold text-zinc-900 dark:text-[#e4e4e7]">Recurring Invoices</h1>
                    <p className="text-xs text-zinc-500 dark:text-[#71717a] mt-1">Automated invoice schedules</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-accent text-white text-xs font-semibold rounded-md hover:brightness-110 transition-all"
                >
                    <Plus size={14} /> New Template
                </button>
            </header>

            <div className="flex-1 overflow-auto p-6">
                {showForm && (
                    <div className="mb-6 bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#1f1f21] rounded-lg p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold text-zinc-900 dark:text-[#e4e4e7]">
                                {editingId ? 'Edit Template' : 'New Recurring Template'}
                            </h2>
                            <button onClick={resetForm} className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-[#1a1a1c] text-zinc-400 dark:text-[#a1a1aa]">
                                <X size={16} />
                            </button>
                        </div>

                        {error && (
                            <div className="px-3 py-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-md text-xs text-red-700 dark:text-red-400">{error}</div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            {/* Customer */}
                            <div className="relative">
                                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-[#71717a] mb-1.5">Customer</label>
                                <input
                                    type="text"
                                    value={customerSearch}
                                    onChange={e => searchCustomers(e.target.value)}
                                    placeholder="Search customer..."
                                    className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-[#0a0a0b] border border-zinc-200 dark:border-[#1f1f21] rounded-md text-zinc-900 dark:text-[#e4e4e7] focus:outline-none focus:ring-2 focus:ring-accent/50"
                                />
                                {customerResults.length > 0 && (
                                    <div className="absolute top-full mt-1 w-full bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#1f1f21] rounded-md shadow-lg z-10 max-h-40 overflow-y-auto">
                                        {customerResults.map(c => (
                                            <button
                                                key={c.id}
                                                onClick={() => selectCustomer(c)}
                                                className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] text-zinc-700 dark:text-[#e4e4e7]"
                                            >
                                                {c.company_name || c.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Frequency */}
                            <div>
                                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-[#71717a] mb-1.5">Frequency</label>
                                <div className="flex gap-2">
                                    <select
                                        value={form.frequency}
                                        onChange={e => setForm(p => ({ ...p, frequency: e.target.value as any }))}
                                        className="flex-1 px-3 py-2 text-xs bg-zinc-50 dark:bg-[#0a0a0b] border border-zinc-200 dark:border-[#1f1f21] rounded-md text-zinc-900 dark:text-[#e4e4e7]"
                                    >
                                        {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                    <input
                                        type="number"
                                        min={1}
                                        max={12}
                                        value={form.interval_value}
                                        onChange={e => setForm(p => ({ ...p, interval_value: parseInt(e.target.value) || 1 }))}
                                        className="w-16 px-2 py-2 text-xs text-center bg-zinc-50 dark:bg-[#0a0a0b] border border-zinc-200 dark:border-[#1f1f21] rounded-md text-zinc-900 dark:text-[#e4e4e7]"
                                        title="Interval (e.g., every 2 months)"
                                    />
                                </div>
                            </div>

                            {/* Next Run Date */}
                            <div>
                                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-[#71717a] mb-1.5">Next Run Date</label>
                                <input
                                    type="date"
                                    value={form.next_run_date}
                                    onChange={e => setForm(p => ({ ...p, next_run_date: e.target.value }))}
                                    className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-[#0a0a0b] border border-zinc-200 dark:border-[#1f1f21] rounded-md text-zinc-900 dark:text-[#e4e4e7] focus:outline-none focus:ring-2 focus:ring-accent/50"
                                />
                            </div>

                            {/* End Date */}
                            <div>
                                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-[#71717a] mb-1.5">End Date (optional)</label>
                                <input
                                    type="date"
                                    value={form.end_date}
                                    onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                                    className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-[#0a0a0b] border border-zinc-200 dark:border-[#1f1f21] rounded-md text-zinc-900 dark:text-[#e4e4e7] focus:outline-none focus:ring-2 focus:ring-accent/50"
                                />
                            </div>

                            {/* Terms */}
                            <div>
                                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-[#71717a] mb-1.5">Terms</label>
                                <select
                                    value={form.terms}
                                    onChange={e => setForm(p => ({ ...p, terms: e.target.value }))}
                                    className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-[#0a0a0b] border border-zinc-200 dark:border-[#1f1f21] rounded-md text-zinc-900 dark:text-[#e4e4e7]"
                                >
                                    <option>Due on Receipt</option>
                                    <option>Net 15</option>
                                    <option>Net 30</option>
                                    <option>Net 60</option>
                                </select>
                            </div>

                            {/* Auto-send */}
                            <div className="flex items-center pt-5 gap-2">
                                <input
                                    type="checkbox"
                                    id="auto-send"
                                    checked={form.auto_send}
                                    onChange={e => setForm(p => ({ ...p, auto_send: e.target.checked }))}
                                    className="rounded border-zinc-300 dark:border-[#1f1f21]"
                                />
                                <label htmlFor="auto-send" className="text-xs font-medium text-zinc-700 dark:text-[#e4e4e7]">Auto-send email on creation</label>
                            </div>
                        </div>

                        {/* Message on invoice */}
                        <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-[#71717a] mb-1.5">Message on Invoice</label>
                            <textarea
                                value={form.message_on_invoice}
                                onChange={e => setForm(p => ({ ...p, message_on_invoice: e.target.value }))}
                                rows={2}
                                className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-[#0a0a0b] border border-zinc-200 dark:border-[#1f1f21] rounded-md text-zinc-900 dark:text-[#e4e4e7] resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
                            />
                        </div>

                        {/* Line items JSON (simplified) */}
                        <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-[#71717a] mb-1.5">Line Items (JSON)</label>
                            <textarea
                                value={form.line_items}
                                onChange={e => setForm(p => ({ ...p, line_items: e.target.value }))}
                                rows={3}
                                placeholder='[{"description":"Service","qty":1,"rate":100}]'
                                className="w-full px-3 py-2 text-xs font-mono bg-zinc-50 dark:bg-[#0a0a0b] border border-zinc-200 dark:border-[#1f1f21] rounded-md text-zinc-900 dark:text-[#e4e4e7] resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={resetForm} className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-[#a1a1aa] hover:text-zinc-900 dark:hover:text-[#e4e4e7] rounded-md hover:bg-zinc-100 dark:hover:bg-[#1a1a1c]">
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-5 py-2 bg-accent text-white text-xs font-semibold rounded-md hover:brightness-110 disabled:opacity-50 transition-all"
                            >
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                {editingId ? 'Update' : 'Create'} Template
                            </button>
                        </div>
                    </div>
                )}

                {/* Template list */}
                <div className="space-y-3">
                    {isLoading ? (
                        <div className="text-center py-20 text-zinc-400 dark:text-[#a1a1aa] animate-pulse text-xs font-medium">Loading templates...</div>
                    ) : templates.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="text-xs font-semibold uppercase tracking-widest text-zinc-300 dark:text-[#52525b]">No recurring templates</div>
                            <p className="text-xs text-zinc-400 dark:text-[#a1a1aa] mt-2">Create a template to automate invoice generation</p>
                        </div>
                    ) : (
                        templates.map(t => (
                            <div key={t.id} className="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#1f1f21] rounded-lg p-5 hover:border-accent/30 transition-all">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-2 flex-1">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${t.status === 'Active' ? 'bg-emerald-500' : t.status === 'Paused' ? 'bg-amber-500' : 'bg-zinc-400'}`} />
                                            <span className="text-sm font-bold text-zinc-900 dark:text-[#e4e4e7]">
                                                {t.customer?.company_name || t.customer?.name || `Customer #${t.customer_id}`}
                                            </span>
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-[#0a0a0b] text-zinc-600 dark:text-[#a1a1aa] font-medium">
                                                {freqLabel(t.frequency, t.interval_value)}
                                            </span>
                                            {t.auto_send && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">Auto-send</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 text-[11px] text-zinc-500 dark:text-[#71717a]">
                                            <span className="flex items-center gap-1"><Calendar size={12} /> Next: {new Date(t.next_run_date).toLocaleDateString()}</span>
                                            {t.end_date && <span className="flex items-center gap-1"><Clock size={12} /> Ends: {new Date(t.end_date).toLocaleDateString()}</span>}
                                            <span>{t.terms}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => toggleStatus(t.id, t.status)} className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-[#1a1a1c] text-zinc-400 dark:text-[#a1a1aa] hover:text-zinc-700 dark:hover:text-[#e4e4e7]" title={t.status === 'Active' ? 'Pause' : 'Resume'}>
                                            {t.status === 'Active' ? <Pause size={14} /> : <Play size={14} />}
                                        </button>
                                        <button onClick={() => editTemplate(t)} className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-[#1a1a1c] text-zinc-400 dark:text-[#a1a1aa] hover:text-zinc-700 dark:hover:text-[#e4e4e7]" title="Edit">
                                            <Edit3 size={14} />
                                        </button>
                                        <button onClick={() => fetchLogs(t.id)} className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-[#1a1a1c] text-zinc-400 dark:text-[#a1a1aa] hover:text-zinc-700 dark:hover:text-[#e4e4e7]" title="History">
                                            <FileText size={14} />
                                        </button>
                                        <button onClick={() => deleteTemplate(t.id)} className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-[#1a1a1c] text-zinc-400 dark:text-[#a1a1aa] hover:text-red-500" title="Delete">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                {/* Inline log view */}
                                {showLog === t.id && (
                                    <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-[#1f1f21]">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-xs font-bold text-zinc-700 dark:text-[#e4e4e7] uppercase tracking-wider">Execution History</h3>
                                            <button onClick={() => setShowLog(null)} className="text-zinc-400 dark:text-[#a1a1aa]"><X size={14} /></button>
                                        </div>
                                        {logs.length === 0 ? (
                                            <p className="text-xs text-zinc-400 dark:text-[#71717a]">No executions yet</p>
                                        ) : (
                                            <div className="space-y-1">
                                                {logs.map(l => (
                                                    <div key={l.id} className="flex items-center gap-3 text-[11px] py-1.5 px-3 bg-zinc-50 dark:bg-[#0a0a0b] rounded-md">
                                                        <Calendar size={12} className="text-zinc-400 dark:text-[#a1a1aa]" />
                                                        <span className="text-zinc-700 dark:text-[#e4e4e7]">{new Date(l.executed_at).toLocaleString()}</span>
                                                        {l.resulting_invoice_id && (
                                                            <span className="text-accent font-medium">#{l.resulting_invoice_id}</span>
                                                        )}
                                                        <span className={`ml-auto text-[10px] font-semibold ${l.status === 'Success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                                            {l.status}
                                                        </span>
                                                        {l.error_message && (
                                                            <span className="text-red-500 dark:text-red-400 truncate max-w-[200px]">{l.error_message}</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
