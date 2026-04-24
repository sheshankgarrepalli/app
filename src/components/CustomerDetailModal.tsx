import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { X, User, CreditCard, Users, FileText, Plus, Trash2, ExternalLink, Upload } from 'lucide-react';

interface CustomerDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    customer: any;
    onUpdate: () => void;
}

export default function CustomerDetailModal({ isOpen, onClose, customer }: CustomerDetailModalProps) {
    const { token } = useAuth();
    const [activeTab, setActiveTab] = useState<'Overview' | 'Ledger' | 'Contacts' | 'Documents'>('Overview');
    const [history, setHistory] = useState<any>(null);

    useEffect(() => {
        if (isOpen && customer) {
            fetchHistory();
        }
    }, [isOpen, customer]);

    const fetchHistory = async () => {
        try {
            const res = await axios.get(`/api/crm/${customer.crm_id}/history`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setHistory(res.data);
        } catch (err) {
            console.error("Error fetching history", err);
        }
    };

    if (!isOpen || !customer) return null;

    const tabs = [
        { id: 'Overview', icon: <User size={14} /> },
        { id: 'Ledger', icon: <CreditCard size={14} /> },
        { id: 'Contacts', icon: <Users size={14} /> },
        { id: 'Documents', icon: <FileText size={14} /> }
    ];

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
            <div className="bg-white rounded-none border border-gray-200 w-full max-w-5xl flex flex-col max-h-[90vh] shadow-2xl">

                {/* HEADER */}
                <div className="p-8 border-b border-gray-100 flex justify-between items-start">
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 mb-2">Customer Profile</div>
                        <h2 className="text-2xl font-black uppercase tracking-widest text-gray-900">
                            {customer.company_name || `${customer.first_name} ${customer.last_name}`.trim() || customer.name}
                        </h2>
                        <div className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mt-1">ID: {customer.crm_id} • {customer.customer_type}</div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 transition"><X size={24} /></button>
                </div>

                {/* TABS */}
                <div className="flex border-b border-gray-50 px-8">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2 ${activeTab === tab.id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-300 hover:text-gray-500'}`}
                        >
                            {tab.icon} {tab.id}
                        </button>
                    ))}
                </div>

                {/* CONTENT */}
                <div className="p-8 overflow-y-auto flex-1 bg-gray-50/30">

                    {activeTab === 'Overview' && (
                        <div className="grid grid-cols-2 gap-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="space-y-8">
                                <section>
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-300 block mb-4">Contact Information</label>
                                    <div className="bg-white border border-gray-100 p-6 space-y-4">
                                        <div className="flex justify-between">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase">Phone</span>
                                            <span className="text-xs font-black uppercase">{customer.phone}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase">Email</span>
                                            <span className="text-xs font-black uppercase">{customer.email || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase">Address</span>
                                            <span className="text-xs font-black uppercase text-right max-w-[200px]">{customer.shipping_address || 'N/A'}</span>
                                        </div>
                                    </div>
                                </section>
                                <section>
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-300 block mb-4">Internal Notes</label>
                                    <div className="bg-white border border-gray-100 p-6 text-xs font-bold text-gray-500 uppercase leading-relaxed italic">
                                        {customer.notes || "No internal notes recorded for this entity."}
                                    </div>
                                </section>
                            </div>
                            <div className="space-y-8">
                                <section>
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-300 block mb-4">Account Status</label>
                                    <div className="bg-white border border-gray-100 p-6 space-y-4">
                                        <div className="flex justify-between">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase">Pricing Tier</span>
                                            <span className="text-xs font-black uppercase">{(customer.pricing_tier * 100).toFixed(0)}% Discount</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase">Tax Status</span>
                                            <span className={`text-xs font-black uppercase ${customer.tax_exempt_id ? 'text-green-600' : 'text-gray-900'}`}>
                                                {customer.tax_exempt_id ? `Exempt (${customer.tax_exempt_id})` : 'Standard Taxable'}
                                            </span>
                                        </div>
                                        {customer.tax_exempt_expiry && (
                                            <div className="flex justify-between">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase">Tax Expiry</span>
                                                <span className="text-xs font-black uppercase">{new Date(customer.tax_exempt_expiry).toLocaleDateString()}</span>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </div>
                        </div>
                    )}

                    {activeTab === 'Ledger' && (
                        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="grid grid-cols-3 gap-8">
                                <div className="bg-white border border-gray-100 p-8">
                                    <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Current Balance</div>
                                    <div className="text-4xl font-black tracking-tighter text-gray-900">${customer.current_balance?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                </div>
                                <div className="bg-white border border-gray-100 p-8">
                                    <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Credit Limit</div>
                                    <div className="text-4xl font-black tracking-tighter text-gray-900">${customer.credit_limit?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                </div>
                                <div className="bg-white border border-gray-100 p-8">
                                    <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Available Credit</div>
                                    <div className="text-4xl font-black tracking-tighter text-green-600">${(customer.credit_limit - customer.current_balance)?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                </div>
                            </div>

                            <section>
                                <label className="text-[9px] font-black uppercase tracking-widest text-gray-300 block mb-4">Transaction History</label>
                                <div className="bg-white border border-gray-100 overflow-hidden">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 border-b border-gray-100">
                                            <tr className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                                                <th className="p-4">Date</th>
                                                <th className="p-4">Description</th>
                                                <th className="p-4 text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-xs">
                                            {history?.purchased_devices?.length === 0 ? (
                                                <tr><td colSpan={3} className="p-12 text-center text-gray-300 uppercase font-black tracking-widest">No transactions recorded</td></tr>
                                            ) : (
                                                history?.purchased_devices?.map((d: any) => (
                                                    <tr key={d.imei} className="border-b border-gray-50 last:border-0">
                                                        <td className="p-4 font-bold text-gray-400">{new Date(d.received_date).toLocaleDateString()}</td>
                                                        <td className="p-4 font-black uppercase">Purchase: {d.model.brand} {d.model.name} (IMEI: {d.imei})</td>
                                                        <td className="p-4 text-right font-black">${d.cost_basis.toLocaleString()}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'Contacts' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="flex justify-between items-center">
                                <label className="text-[9px] font-black uppercase tracking-widest text-gray-300 block">Authorized Runners & Buyers</label>
                                <button className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-gray-900 border border-gray-200 px-4 py-2 hover:bg-gray-900 hover:text-white transition-all">
                                    <Plus size={12} /> Add Contact
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-8">
                                {customer.contacts?.length === 0 ? (
                                    <div className="col-span-2 bg-white border border-dashed border-gray-200 p-12 text-center text-gray-300 uppercase font-black tracking-widest text-[10px]">
                                        No authorized contacts defined
                                    </div>
                                ) : (
                                    customer.contacts?.map((c: any) => (
                                        <div key={c.id} className="bg-white border border-gray-100 p-6 flex justify-between items-center">
                                            <div>
                                                <div className="text-sm font-black uppercase tracking-tight text-gray-900">{c.name}</div>
                                                <div className="text-[10px] font-bold text-gray-400 uppercase mt-1">{c.phone}</div>
                                                {c.is_authorized_buyer && (
                                                    <span className="text-[8px] font-black uppercase tracking-widest text-green-600 bg-green-50 px-2 py-0.5 mt-2 inline-block">Authorized Buyer</span>
                                                )}
                                            </div>
                                            <button className="text-gray-200 hover:text-red-500 transition"><Trash2 size={16} /></button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'Documents' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="flex justify-between items-center">
                                <label className="text-[9px] font-black uppercase tracking-widest text-gray-300 block">Compliance Documents</label>
                                <button className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-gray-900 border border-gray-200 px-4 py-2 hover:bg-gray-900 hover:text-white transition-all">
                                    <Upload size={12} /> Upload Document
                                </button>
                            </div>
                            <div className="grid grid-cols-3 gap-8">
                                {customer.documents?.length === 0 ? (
                                    <div className="col-span-3 bg-white border border-dashed border-gray-200 p-12 text-center text-gray-300 uppercase font-black tracking-widest text-[10px]">
                                        No compliance documents uploaded
                                    </div>
                                ) : (
                                    customer.documents?.map((d: any) => (
                                        <div key={d.id} className="bg-white border border-gray-100 p-6 space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div className="p-3 bg-gray-50 text-gray-400"><FileText size={20} /></div>
                                                <button className="text-gray-200 hover:text-gray-900 transition"><ExternalLink size={16} /></button>
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-900">{d.document_type.replace('_', ' ')}</div>
                                                <div className="text-[8px] font-bold text-gray-400 uppercase mt-1">Expires: {d.expiry_date ? new Date(d.expiry_date).toLocaleDateString() : 'Never'}</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                </div>

                {/* FOOTER */}
                <div className="p-8 border-t border-gray-100 flex justify-end gap-8 bg-white">
                    <button onClick={onClose} className="px-10 py-4 border border-gray-200 text-gray-900 font-black uppercase text-xs tracking-[0.2em] hover:bg-gray-50 transition-all">
                        Close Profile
                    </button>
                    <button onClick={() => { /* Open Edit Modal */ }} className="px-10 py-4 bg-gray-900 text-white font-black uppercase text-xs tracking-[0.2em] hover:bg-black transition-all">
                        Edit Entity
                    </button>
                </div>
            </div>
        </div>
    );
}
