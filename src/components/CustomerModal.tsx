import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { X } from 'lucide-react';

export default function CustomerModal({ isOpen, onClose, customer, onSuccess }: { isOpen: boolean, onClose: () => void, customer?: any, onSuccess: () => void }) {
    const { token } = useAuth();
    const isEdit = !!customer;

    const [form, setForm] = useState({
        customer_type: 'Retail',
        first_name: '',
        last_name: '',
        company_name: '',
        contact_person: '',
        phone: '',
        email: '',
        tax_exempt_id: '',
        tax_exempt_expiry: '',
        pricing_tier: 0.0,
        credit_limit: 0.0,
        payment_terms_days: 0,
        shipping_address: '',
        notes: ''
    });

    useEffect(() => {
        if (customer) {
            setForm({
                customer_type: customer.customer_type || 'Retail',
                first_name: customer.first_name || '',
                last_name: customer.last_name || '',
                company_name: customer.company_name || '',
                contact_person: customer.contact_person || '',
                phone: customer.phone || '',
                email: customer.email || '',
                tax_exempt_id: customer.tax_exempt_id || '',
                tax_exempt_expiry: customer.tax_exempt_expiry ? new Date(customer.tax_exempt_expiry).toISOString().split('T')[0] : '',
                pricing_tier: customer.pricing_tier || 0.0,
                credit_limit: customer.credit_limit || 0.0,
                payment_terms_days: customer.payment_terms_days || 0,
                shipping_address: customer.shipping_address || '',
                notes: customer.notes || ''
            });
        } else {
            setForm({
                customer_type: 'Retail',
                first_name: '',
                last_name: '',
                company_name: '',
                contact_person: '',
                phone: '',
                email: '',
                tax_exempt_id: '',
                tax_exempt_expiry: '',
                pricing_tier: 0.0,
                credit_limit: 0.0,
                payment_terms_days: 0,
                shipping_address: '',
                notes: ''
            });
        }
    }, [customer, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (isEdit) {
                await axios.put(`http://localhost:8000/api/crm/${customer.crm_id}`, form, { headers: { Authorization: `Bearer ${token}` } });
            } else {
                await axios.post((import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/crm/', form, { headers: { Authorization: `Bearer ${token}` } });
            }
            onSuccess();
        } catch (err: any) {
            alert(err.response?.data?.detail || "An error occurred");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
            <div className="bg-white rounded-none border border-gray-200 w-full max-w-2xl flex flex-col max-h-[90vh] shadow-2xl">
                <div className="p-8 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-xl font-black uppercase tracking-[0.2em]">{isEdit ? 'Edit Entity' : 'New Entity Registration'}</h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 transition"><X size={20} /></button>
                </div>
                <div className="p-8 overflow-y-auto flex-1">
                    <form id="customer-form" onSubmit={handleSubmit} className="space-y-10">

                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Entity Classification</label>
                            <select
                                className="w-full p-4 border border-gray-200 rounded-none outline-none focus:border-gray-900 transition text-sm font-bold uppercase tracking-widest"
                                value={form.customer_type}
                                onChange={(e) => setForm({ ...form, customer_type: e.target.value })}
                            >
                                <option value="Retail">Retail Consumer</option>
                                <option value="Wholesale">Wholesale / B2B</option>
                            </select>
                        </div>

                        {form.customer_type === 'Retail' ? (
                            <div className="grid grid-cols-2 gap-8 animate-in fade-in duration-500">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">First Name *</label>
                                    <input required className="w-full p-4 border border-gray-200 rounded-none outline-none focus:border-gray-900 transition text-sm font-bold uppercase tracking-widest" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Last Name</label>
                                    <input className="w-full p-4 border border-gray-200 rounded-none outline-none focus:border-gray-900 transition text-sm font-bold uppercase tracking-widest" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-8 animate-in fade-in duration-500">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Company Name *</label>
                                    <input required className="w-full p-4 border border-gray-200 rounded-none outline-none focus:border-gray-900 transition text-sm font-bold uppercase tracking-widest" value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Contact Person</label>
                                        <input className="w-full p-4 border border-gray-200 rounded-none outline-none focus:border-gray-900 transition text-sm font-bold uppercase tracking-widest" value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Tax Exempt ID</label>
                                        <input className="w-full p-4 border border-gray-200 rounded-none outline-none focus:border-gray-900 transition text-sm font-bold uppercase tracking-widest" value={form.tax_exempt_id} onChange={e => setForm({ ...form, tax_exempt_id: e.target.value })} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Wholesale Pricing Tier</label>
                                        <select className="w-full p-4 border border-gray-200 rounded-none outline-none focus:border-gray-900 transition text-sm font-bold uppercase tracking-widest" value={form.pricing_tier} onChange={e => setForm({ ...form, pricing_tier: parseFloat(e.target.value) })}>
                                            <option value={0.0}>Standard (0%)</option>
                                            <option value={0.05}>Tier 1 (5%)</option>
                                            <option value={0.10}>Tier 2 (10%)</option>
                                            <option value={0.15}>Tier 3 (15%)</option>
                                            <option value={0.20}>VIP (20%)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Tax Exempt Expiry</label>
                                        <input type="date" className="w-full p-4 border border-gray-200 rounded-none outline-none focus:border-gray-900 transition text-sm font-bold uppercase tracking-widest" value={form.tax_exempt_expiry} onChange={e => setForm({ ...form, tax_exempt_expiry: e.target.value })} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Credit Limit ($)</label>
                                        <input type="number" className="w-full p-4 border border-gray-200 rounded-none outline-none focus:border-gray-900 transition text-sm font-bold uppercase tracking-widest" value={form.credit_limit} onChange={e => setForm({ ...form, credit_limit: parseFloat(e.target.value) })} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Payment Terms (Days)</label>
                                        <input type="number" className="w-full p-4 border border-gray-200 rounded-none outline-none focus:border-gray-900 transition text-sm font-bold uppercase tracking-widest" value={form.payment_terms_days} onChange={e => setForm({ ...form, payment_terms_days: parseInt(e.target.value) })} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Registered Shipping Address</label>
                                    <textarea className="w-full p-4 border border-gray-200 rounded-none outline-none focus:border-gray-900 transition text-xs font-bold uppercase tracking-widest" rows={2} value={form.shipping_address} onChange={e => setForm({ ...form, shipping_address: e.target.value })} />
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-8 pt-6 border-t border-gray-50">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Contact Phone *</label>
                                <input required type="tel" className="w-full p-4 border border-gray-200 rounded-none outline-none focus:border-gray-900 transition text-sm font-bold uppercase tracking-widest" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Contact Email</label>
                                <input type="email" className="w-full p-4 border border-gray-200 rounded-none outline-none focus:border-gray-900 transition text-sm font-bold uppercase tracking-widest" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Internal Notes</label>
                            <textarea className="w-full p-4 border border-gray-200 rounded-none outline-none focus:border-gray-900 transition text-xs font-bold uppercase tracking-widest" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                        </div>
                    </form>
                </div>
                <div className="p-8 border-t border-gray-100 flex justify-end gap-8">
                    <button type="button" onClick={onClose} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 transition">Cancel</button>
                    <button type="submit" form="customer-form" className="px-10 py-4 bg-gray-900 text-white font-black uppercase text-xs tracking-[0.2em] hover:bg-black transition-all">
                        {isEdit ? 'Save Changes' : 'Create Entity'}
                    </button>
                </div>
            </div>
        </div>
    );
}
