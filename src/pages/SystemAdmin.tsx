import { useState, useEffect } from 'react';
import UserManagement from './UserManagement';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Users, DollarSign, Edit2, FileText, Save, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function SystemAdmin() {
    const [activeTab, setActiveTab] = useState('users');

    const tabs = [
        { id: 'users', label: 'User Management', icon: Users },
        { id: 'labor', label: 'Labor & Fees Setup', icon: DollarSign },
        { id: 'billing', label: 'Billing & Invoicing', icon: FileText }
    ];

    return (
        <div className="space-y-0">
            <div className="page-header px-6 pt-6 pb-4">
                <div>
                    <h1 className="page-title">System Administration</h1>
                    <p className="text-xs text-[#6b7280] dark:text-[#71717a] mt-1">Global configurations & access control</p>
                </div>
            </div>

            <div className="flex flex-col">
                <div className="px-6 bg-white dark:bg-[#141416] border-b border-[#e5e7eb] dark:border-[#1f1f21]">
                    <div className="flex gap-8">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`pt-4 pb-3 text-xs font-semibold uppercase tracking-wider transition-all relative flex items-center gap-2 ${activeTab === tab.id ? 'text-[#1f2937] dark:text-[#e4e4e7]' : 'text-[#6b7280] dark:text-[#71717a] hover:text-[#1f2937] dark:text-[#e4e4e7]'
                                    }`}
                            >
                                <tab.icon size={14} />
                                {tab.label}
                                {activeTab === tab.id && (
                                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-accent" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    {activeTab === 'users' && <UserManagement />}
                    {activeTab === 'labor' && <LaborRatesSetup />}
                    {activeTab === 'billing' && <BillingSettings />}
                </div>
            </div>
        </div>
    );
}

function LaborRatesSetup() {
    const { token } = useAuth();
    const [rates, setRates] = useState<any[]>([]);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValue, setEditValue] = useState('');

    useEffect(() => {
        fetchRates();
    }, []);

    const fetchRates = async () => {
        try {
            const res = await axios.get((import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/admin/rates', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRates(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleUpdate = async (actionName: string) => {
        const payload = {
            action_name: actionName,
            fee_amount: parseFloat(editValue)
        };

        try {
            await axios.put(`/api/admin/rates/upsert`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEditingId(null);
            fetchRates();
        } catch (err: any) {
            alert(`Failed to save: ${err.response?.data?.detail || err.message}`);
        }
    };

    return (
        <div className="p-6 max-w-5xl space-y-6">
            <div>
                <h2 className="text-sm font-semibold text-[#1f2937] dark:text-[#e4e4e7] mb-1">Dynamic Labor Fees</h2>
                <p className="text-xs text-[#6b7280] dark:text-[#71717a]">Configure technician and QC rates per action</p>
            </div>

            <div className="card overflow-hidden">
                <table className="table-standard">
                    <thead>
                        <tr>
                            <th>Action Specification</th>
                            <th className="text-right">Fee Amount</th>
                            <th className="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rates.map(rate => (
                            <tr key={rate.id} className="group">
                                <td className="text-[#1f2937] dark:text-[#e4e4e7] font-semibold">{rate.action_name.replace('_', ' ')}</td>
                                <td className="text-right">
                                    {editingId === rate.id ? (
                                        <div className="flex justify-end items-center gap-2">
                                            <span className="text-[#9ca3af] dark:text-[#52525b] text-sm">$</span>
                                            <input
                                                type="number"
                                                value={editValue}
                                                onChange={e => setEditValue(e.target.value)}
                                                className="w-24 bg-transparent border-b border-accent outline-none text-right font-bold text-[#1f2937] dark:text-[#e4e4e7] text-sm py-0.5"
                                                autoFocus
                                            />
                                        </div>
                                    ) : (
                                        <span className="text-[#1f2937] dark:text-[#e4e4e7] font-bold text-sm">${rate.fee_amount.toFixed(2)}</span>
                                    )}
                                </td>
                                <td className="text-right">
                                    {editingId === rate.id ? (
                                        <button onClick={() => handleUpdate(rate.action_name)} className="text-emerald-600 hover:text-emerald-700 transition-colors font-bold text-xs">Save</button>
                                    ) : (
                                        <button onClick={() => { setEditingId(rate.id); setEditValue(rate.fee_amount.toString()); }} className="text-[#9ca3af] dark:text-[#52525b] hover:text-[#1f2937] dark:text-[#e4e4e7] transition-colors opacity-0 group-hover:opacity-100"><Edit2 size={16} /></button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <button
                onClick={() => axios.post((import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/admin/rates/seed', {}, { headers: { Authorization: `Bearer ${token}` } }).then(fetchRates)}
                className="text-xs font-semibold text-[#6b7280] dark:text-[#71717a] hover:text-[#1f2937] dark:text-[#e4e4e7] transition-colors"
            >
                Initialize Default Rates
            </button>
        </div>
    );
}

function BillingSettings() {
    const { token } = useAuth();
    const API = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000');
    const [invoiceTerms, setInvoiceTerms] = useState('');
    const [originalTerms, setOriginalTerms] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const [defaultTax, setDefaultTax] = useState(8.5);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setIsLoading(true);
        try {
            const res = await axios.get(`${API}/api/admin/org-settings`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setInvoiceTerms(res.data.invoice_terms || '');
            setOriginalTerms(res.data.invoice_terms || '');
            setDefaultTax(res.data.default_tax_rate || 8.5);
        } catch (_) {
            setError('Failed to load settings');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setError('');
        setSaved(false);
        try {
            await axios.put(`${API}/api/admin/org-settings`, {
                invoice_terms: invoiceTerms,
                default_tax_rate: defaultTax
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setOriginalTerms(invoiceTerms);
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Save failed');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl space-y-8">
            <div>
                <h2 className="text-sm font-bold text-[#1f2937] dark:text-[#e4e4e7] mb-1">Billing & Invoicing Settings</h2>
                <p className="text-xs text-[#6b7280] dark:text-[#71717a]">Configure default tax rate and invoice terms that appear on all receipts</p>
            </div>

            <div className="space-y-8">
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#6b7280] dark:text-[#71717a]">Default Tax Rate (%)</label>
                    <input
                        type="number"
                        step="0.01"
                        value={defaultTax}
                        onChange={e => setDefaultTax(parseFloat(e.target.value) || 0)}
                        className="input-stark w-32 py-3 text-sm font-bold"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#6b7280] dark:text-[#71717a]">Invoice Terms & Conditions</label>
                    <p className="text-[10px] text-[#9ca3af] dark:text-[#52525b]">These terms appear at the bottom of all customer receipts and invoices. Use clear, legally appropriate language.</p>
                    {isLoading ? (
                        <div className="py-8 text-center text-xs text-[#9ca3af] dark:text-[#52525b] animate-pulse">Loading settings...</div>
                    ) : (
                        <textarea
                            value={invoiceTerms}
                            onChange={e => setInvoiceTerms(e.target.value)}
                            rows={8}
                            className="input-stark w-full py-4 px-4 text-sm leading-relaxed resize-y font-medium"
                            placeholder="All sales are final. 14-day warranty on defects. Layaway deposits are non-refundable."
                        />
                    )}
                </div>

                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-xs font-bold uppercase tracking-wider">
                        <AlertCircle size={14} /> {error}
                    </div>
                )}
                {saved && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                        <CheckCircle2 size={14} /> Settings saved
                    </div>
                )}

                <button
                    onClick={handleSave}
                    disabled={isSaving || isLoading || invoiceTerms === originalTerms}
                    className="btn-primary py-3 px-8 text-xs font-bold uppercase tracking-widest flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {isSaving ? 'Saving...' : (
                        <>
                            <Save size={14} /> Save Changes
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
