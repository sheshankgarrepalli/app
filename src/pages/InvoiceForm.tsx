import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    Plus, Trash2, Settings, Send, Save, X, GripVertical
} from 'lucide-react';
import CustomerModal from '../components/CustomerModal';

type LineItem = {
    id: string;
    model_number: string;
    imei: string;
    description: string;
    qty: number;
    rate: number;
    taxable: boolean;
};

export default function InvoiceForm() {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    // Header
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const [customerResults, setCustomerResults] = useState<any[]>([]);
    const [customerEmail, setCustomerEmail] = useState('');
    const [showCC, setShowCC] = useState(false);
    const [cc, setCc] = useState('');
    const [bcc, setBcc] = useState('');
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
    const [terms, setTerms] = useState('Due on Receipt');
    const [dueDate, setDueDate] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [showCustomerModal, setShowCustomerModal] = useState(false);

    // Gear toggles
    const [showShipping, setShowShipping] = useState(false);
    const [fulfillmentMethod, setFulfillmentMethod] = useState<'Walk-in' | 'Shipped'>('Walk-in');
    const [shippingAddress, setShippingAddress] = useState('');

    // Line items
    const [lineItems, setLineItems] = useState<LineItem[]>([
        { id: crypto.randomUUID(), model_number: '', imei: '', description: '', qty: 1, rate: 0, taxable: true }
    ]);
    const [productResults, setProductResults] = useState<any[]>([]);

    // Discount
    const [discountMode, setDiscountMode] = useState<'%' | '$'>('%');
    const [discountValue, setDiscountValue] = useState<number>(0);

    // Payment
    const [paymentAmount, setPaymentAmount] = useState<number>(0);
    const [paymentMethod, setPaymentMethod] = useState<string>('Cash');

    // Messages
    const [messageOnInvoice, setMessageOnInvoice] = useState('');
    const [statementMemo, setStatementMemo] = useState('');

    // UI state
    const [showGearMenu, setShowGearMenu] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; rowId: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const searchTimeout = useRef<any>(null);

    useEffect(() => {
        fetchNextNumber();
    }, []);

    useEffect(() => {
        if (terms === 'Due on Receipt') {
            setDueDate(invoiceDate);
        } else {
            const days = terms === 'Net 15' ? 15 : terms === 'Net 30' ? 30 : terms === 'Net 60' ? 60 : 0;
            if (days > 0 && invoiceDate) {
                const d = new Date(invoiceDate);
                d.setDate(d.getDate() + days);
                setDueDate(d.toISOString().split('T')[0]);
            }
        }
    }, [terms, invoiceDate]);

    useEffect(() => {
        document.addEventListener('click', () => setContextMenu(null));
        return () => document.removeEventListener('click', () => setContextMenu(null));
    }, []);

    const fetchNextNumber = async () => {
        try {
            const res = await axios.get('/api/pos/next-number?type=invoice', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setInvoiceNumber(res.data.next_number);
        } catch { setInvoiceNumber('INV-1000'); }
    };

    const searchCustomers = (q: string) => {
        setCustomerSearch(q);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        if (q.length < 2) { setCustomerResults([]); return; }
        searchTimeout.current = setTimeout(async () => {
            try {
                const res = await axios.get(`/api/crm/?search=${q}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setCustomerResults(res.data);
            } catch { }
        }, 250);
    };

    const selectCustomer = (c: any) => {
        setSelectedCustomer(c);
        setCustomerSearch(c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.name);
        setCustomerEmail(c.email || '');
        setCustomerResults([]);
    };

    const searchProducts = (q: string) => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        if (q.length < 1) { setProductResults([]); return; }
        searchTimeout.current = setTimeout(async () => {
            try {
                const res = await axios.get(`/api/models/search?q=${q}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setProductResults(res.data || []);
            } catch { setProductResults([]); }
        }, 200);
    };

    // Line item operations
    const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
        setLineItems(prev => prev.map(li => li.id === id ? { ...li, [field]: value } : li));
    };

    const addLineItem = () => {
        setLineItems(prev => [...prev, {
            id: crypto.randomUUID(),
            model_number: '', imei: '', description: '', qty: 1, rate: 0, taxable: true
        }]);
    };

    const removeLineItem = (id: string) => {
        setLineItems(prev => prev.filter(li => li.id !== id));
    };

    const duplicateLineItem = (id: string) => {
        const item = lineItems.find(li => li.id === id);
        if (item) {
            setLineItems(prev => [...prev, { ...item, id: crypto.randomUUID() }]);
        }
    };

    const insertLineAbove = (id: string) => {
        const idx = lineItems.findIndex(li => li.id === id);
        if (idx >= 0) {
            const newItem: LineItem = { id: crypto.randomUUID(), model_number: '', imei: '', description: '', qty: 1, rate: 0, taxable: true };
            setLineItems(prev => [...prev.slice(0, idx), newItem, ...prev.slice(idx)]);
        }
    };

    const insertLineBelow = (id: string) => {
        const idx = lineItems.findIndex(li => li.id === id);
        if (idx >= 0) {
            const newItem: LineItem = { id: crypto.randomUUID(), model_number: '', imei: '', description: '', qty: 1, rate: 0, taxable: true };
            setLineItems(prev => [...prev.slice(0, idx + 1), newItem, ...prev.slice(idx + 1)]);
        }
    };

    // Calculations
    const subtotal = lineItems.reduce((sum, li) => sum + li.rate * li.qty, 0);
    const discountAmount = discountMode === '%'
        ? subtotal * (discountValue / 100)
        : discountValue;
    const discountedSubtotal = subtotal - discountAmount;
    const taxRate = selectedCustomer?.tax_exempt_id ? 0 : 8.5;
    const taxAmount = discountedSubtotal * (taxRate / 100);
    const total = discountedSubtotal + taxAmount;
    const balanceDue = total - paymentAmount;

    // Actions
    const handleSave = async (andAction?: 'close' | 'new' | 'send') => {
        setLoading(true);
        setError(null);
        try {
            const payload = {
                customer_id: selectedCustomer?.crm_id,
                items: lineItems.map(li => ({
                    model_number: li.model_number,
                    imei: li.imei || undefined,
                    description: li.description,
                    qty: li.qty,
                    rate: li.rate,
                    taxable: li.taxable,
                })),
                invoice_date: invoiceDate,
                due_date: dueDate || undefined,
                terms,
                message_on_invoice: messageOnInvoice,
                statement_memo: statementMemo,
                discount_percent: discountMode === '%' ? discountValue : 0,
                discount_amount: discountMode === '$' ? discountValue : discountAmount,
                tax_percent: taxRate,
                fulfillment_method: fulfillmentMethod,
                shipping_address: showShipping ? shippingAddress : undefined,
                payments: paymentAmount > 0 ? [{ amount: paymentAmount, payment_method: paymentMethod }] : [],
            };

            const res = await axios.post('/api/pos/invoices', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setSuccess(`Invoice ${res.data.invoice_number} saved.`);

            if (andAction === 'send') {
                // Open email modal or trigger send
                navigate(`/admin/invoices`);
            } else if (andAction === 'close') {
                navigate('/admin/invoices');
            } else if (andAction === 'new') {
                resetForm();
                fetchNextNumber();
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to save invoice');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setLineItems([{ id: crypto.randomUUID(), model_number: '', imei: '', description: '', qty: 1, rate: 0, taxable: true }]);
        setDiscountValue(0);
        setPaymentAmount(0);
        setMessageOnInvoice('');
        setStatementMemo('');
        setSelectedCustomer(null);
        setCustomerSearch('');
        setCustomerEmail('');
    };

    const handleRowContext = (e: React.MouseEvent, rowId: string) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, rowId });
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-[#0a0a0b]">
            {/* Top bar */}
            <header className="sticky top-0 z-30 h-14 bg-white dark:bg-[#141416] border-b border-zinc-200 dark:border-[#1f1f21] flex items-center justify-between px-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/admin/invoices')} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-[#e4e4e7]">
                        <X size={18} />
                    </button>
                    <h1 className="text-sm font-bold text-zinc-900 dark:text-[#e4e4e7]">New Invoice</h1>
                    {invoiceNumber && (
                        <span className="text-xs text-zinc-500 dark:text-[#71717a]">#{invoiceNumber}</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowGearMenu(!showGearMenu)}
                        className="relative p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-[#1f1f21] text-zinc-500"
                    >
                        <Settings size={16} />
                        {showGearMenu && (
                            <div className="absolute right-0 top-8 w-56 bg-white dark:bg-[#1a1a1c] border border-zinc-200 dark:border-[#27272a] rounded-lg shadow-lg p-2 z-40">
                                <label className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-zinc-50 dark:hover:bg-[#141416] rounded">
                                    <input type="checkbox" checked={showShipping} onChange={e => setShowShipping(e.target.checked)} className="rounded" />
                                    Shipping fields
                                </label>
                                <label className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-zinc-50 dark:hover:bg-[#141416] rounded">
                                    <input type="checkbox" disabled className="rounded opacity-50" />
                                    Schedule recurring (coming soon)
                                </label>
                                <label className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-zinc-50 dark:hover:bg-[#141416] rounded">
                                    <input type="checkbox" disabled className="rounded opacity-50" />
                                    Accept online payments
                                </label>
                            </div>
                        )}
                    </button>
                </div>
            </header>

            {error && (
                <div className="mx-6 mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-400 flex justify-between items-center">
                    <span>{error}</span>
                    <button onClick={() => setError(null)}><X size={14} /></button>
                </div>
            )}
            {success && (
                <div className="mx-6 mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-sm text-green-700 dark:text-green-400 flex justify-between items-center">
                    <span>{success}</span>
                    <button onClick={() => setSuccess(null)}><X size={14} /></button>
                </div>
            )}

            <div className="max-w-4xl mx-auto p-6 space-y-6">
                {/* Header Section */}
                <div className="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#1f1f21] rounded-lg p-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-zinc-500 dark:text-[#71717a] mb-1">Customer</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={selectedCustomer ? (selectedCustomer.company_name || `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim()) : customerSearch}
                                    onChange={e => { selectCustomer(null as any); searchCustomers(e.target.value); }}
                                    placeholder="Search or add new..."
                                    className="input-stark w-full py-2 text-sm"
                                />
                                {customerResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 bg-white dark:bg-[#1a1a1c] border border-zinc-200 dark:border-[#27272a] rounded-lg shadow-lg z-30 max-h-40 overflow-auto">
                                        {customerResults.map((c: any) => (
                                            <button
                                                key={c.crm_id}
                                                onClick={() => selectCustomer(c)}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-[#141416] border-b border-zinc-100 dark:border-[#222] last:border-0"
                                            >
                                                {c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.name}
                                                <span className="text-xs text-zinc-400 ml-2">{c.crm_id}</span>
                                            </button>
                                        ))}
                                        <button
                                            onClick={() => setShowCustomerModal(true)}
                                            className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-zinc-50 dark:hover:bg-[#141416] font-medium"
                                        >
                                            + Add new customer
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-500 dark:text-[#71717a] mb-1">Email</label>
                            <input
                                type="email"
                                value={customerEmail}
                                onChange={e => setCustomerEmail(e.target.value)}
                                placeholder="customer@email.com"
                                className="input-stark w-full py-2 text-sm"
                            />
                            {!showCC && (
                                <button onClick={() => setShowCC(true)} className="text-xs text-blue-600 mt-1">+ CC / BCC</button>
                            )}
                            {showCC && (
                                <div className="mt-2 space-y-1">
                                    <input type="email" value={cc} onChange={e => setCc(e.target.value)} placeholder="CC" className="input-stark w-full py-1.5 text-xs" />
                                    <input type="email" value={bcc} onChange={e => setBcc(e.target.value)} placeholder="BCC" className="input-stark w-full py-1.5 text-xs" />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 mt-4">
                        <div>
                            <label className="block text-xs font-medium text-zinc-500 dark:text-[#71717a] mb-1">Invoice Date</label>
                            <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className="input-stark w-full py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-500 dark:text-[#71717a] mb-1">Terms</label>
                            <select value={terms} onChange={e => setTerms(e.target.value)} className="input-stark w-full py-2 text-sm">
                                <option>Due on Receipt</option>
                                <option>Net 15</option>
                                <option>Net 30</option>
                                <option>Net 60</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-500 dark:text-[#71717a] mb-1">Due Date</label>
                            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="input-stark w-full py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-500 dark:text-[#71717a] mb-1">Invoice #</label>
                            <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="input-stark w-full py-2 text-sm font-mono" />
                        </div>
                    </div>

                    {showShipping && (
                        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-zinc-200 dark:border-[#1f1f21]">
                            <div>
                                <label className="block text-xs font-medium text-zinc-500 dark:text-[#71717a] mb-1">Fulfillment</label>
                                <select value={fulfillmentMethod} onChange={e => setFulfillmentMethod(e.target.value as any)} className="input-stark w-full py-2 text-sm">
                                    <option>Walk-in</option>
                                    <option>Shipped</option>
                                </select>
                            </div>
                            {fulfillmentMethod === 'Shipped' && (
                                <div>
                                    <label className="block text-xs font-medium text-zinc-500 dark:text-[#71717a] mb-1">Shipping Address</label>
                                    <textarea value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} className="input-stark w-full py-2 text-sm" rows={2} />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Line Items */}
                <div className="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#1f1f21] rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-50 dark:bg-[#0a0a0b]/50 border-b border-zinc-200 dark:border-[#1f1f21]">
                            <tr className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500 dark:text-[#71717a]">
                                <th className="w-8 px-2 py-3"></th>
                                <th className="px-4 py-3 text-left">Product / Service</th>
                                <th className="px-4 py-3 text-left w-48">Description</th>
                                <th className="px-4 py-3 text-right w-16">Qty</th>
                                <th className="px-4 py-3 text-right w-24">Rate</th>
                                <th className="px-4 py-3 text-right w-28">Amount</th>
                                <th className="px-4 py-3 text-center w-10">Tax</th>
                                <th className="px-2 py-3 w-8"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {lineItems.map((li, _idx) => (
                                <tr key={li.id}
                                    onContextMenu={e => handleRowContext(e, li.id)}
                                    className="border-b border-zinc-100 dark:border-[#1a1a1c] hover:bg-zinc-50 dark:hover:bg-[#0a0a0b]/30 group"
                                >
                                    <td className="px-2 py-2 text-center">
                                        <GripVertical size={14} className="text-zinc-300 dark:text-[#333] cursor-grab" />
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={li.model_number}
                                                onChange={e => {
                                                    updateLineItem(li.id, 'model_number', e.target.value);
                                                    searchProducts(e.target.value);
                                                }}
                                                onFocus={() => searchProducts(li.model_number)}
                                                onBlur={() => setTimeout(() => setProductResults([]), 200)}
                                                placeholder="Model or product..."
                                                className="w-full bg-transparent py-1 text-sm outline-none border-b border-transparent hover:border-zinc-300 dark:hover:border-[#333] focus:border-blue-500"
                                            />
                                            {productResults.length > 0 && (
                                                <div className="absolute top-full left-0 bg-white dark:bg-[#1a1a1c] border border-zinc-200 dark:border-[#27272a] rounded shadow-lg z-20 max-h-32 overflow-auto min-w-[200px]">
                                                    {productResults.map((p: any) => (
                                                        <button
                                                            key={p.model_number}
                                                            onMouseDown={() => {
                                                                updateLineItem(li.id, 'model_number', p.model_number);
                                                                updateLineItem(li.id, 'description', `${p.brand} ${p.name} ${p.storage} ${p.color}`);
                                                                setProductResults([]);
                                                            }}
                                                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-[#141416]"
                                                        >
                                                            {p.model_number} — {p.brand} {p.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2">
                                        <input
                                            type="text"
                                            value={li.description}
                                            onChange={e => updateLineItem(li.id, 'description', e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Tab') (e.target as HTMLInputElement).blur(); }}
                                            placeholder="Description..."
                                            className="w-full bg-transparent py-1 text-xs outline-none border-b border-transparent hover:border-zinc-300 dark:hover:border-[#333] focus:border-blue-500"
                                        />
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                        <input
                                            type="number"
                                            value={li.qty}
                                            onChange={e => updateLineItem(li.id, 'qty', parseInt(e.target.value) || 1)}
                                            min={1}
                                            className="w-14 bg-transparent text-right py-1 text-sm outline-none border-b border-transparent hover:border-zinc-300 dark:hover:border-[#333] focus:border-blue-500"
                                        />
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                        <input
                                            type="number"
                                            value={li.rate}
                                            onChange={e => updateLineItem(li.id, 'rate', parseFloat(e.target.value) || 0)}
                                            step="0.01"
                                            min={0}
                                            className="w-20 bg-transparent text-right py-1 text-sm outline-none border-b border-transparent hover:border-zinc-300 dark:hover:border-[#333] focus:border-blue-500"
                                        />
                                    </td>
                                    <td className="px-4 py-2 text-right font-mono text-sm tabular-nums">
                                        ${(li.rate * li.qty).toFixed(2)}
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        <button
                                            onClick={() => updateLineItem(li.id, 'taxable', !li.taxable)}
                                            className={`text-xs px-1.5 py-0.5 rounded ${li.taxable ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'}`}
                                        >
                                            T
                                        </button>
                                    </td>
                                    <td className="px-2 py-2">
                                        <button onClick={() => removeLineItem(li.id)} className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500"><Trash2 size={14} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <button onClick={addLineItem} className="w-full flex items-center justify-center gap-1 px-4 py-3 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-[#e4e4e7] hover:bg-zinc-50 dark:hover:bg-[#0a0a0b]/30 border-t border-zinc-100 dark:border-[#1a1a1c] transition-colors">
                        <Plus size={14} /> Add line
                    </button>
                </div>

                {/* Summary */}
                <div className="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#1f1f21] rounded-lg p-6">
                    <div className="flex justify-end">
                        <div className="w-72 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-zinc-500 dark:text-[#71717a]">Subtotal</span>
                                <span className="font-mono">${subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <button onClick={() => setDiscountMode(discountMode === '%' ? '$' : '%')} className="text-zinc-500 dark:text-[#71717a] hover:text-zinc-900 dark:hover:text-[#e4e4e7] text-xs">
                                    Discount ({discountMode})
                                </button>
                                <div className="flex items-center gap-1">
                                    {discountMode === '$' && <span className="text-zinc-400 text-sm">$</span>}
                                    <input
                                        type="number"
                                        value={discountValue}
                                        onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
                                        min={0}
                                        step={discountMode === '%' ? 0.1 : 0.01}
                                        className="w-20 bg-transparent text-right font-mono text-sm border-b border-zinc-200 dark:border-[#333] focus:border-blue-500 outline-none"
                                    />
                                    {discountMode === '%' && <span className="text-zinc-400 text-sm">%</span>}
                                </div>
                            </div>
                            {discountAmount > 0 && (
                                <div className="flex justify-between text-green-600 dark:text-green-400">
                                    <span></span>
                                    <span className="font-mono text-xs">-${discountAmount.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between border-t border-zinc-200 dark:border-[#1f1f21] pt-2">
                                <span className="text-zinc-500 dark:text-[#71717a]">Tax ({taxRate}%)</span>
                                <span className="font-mono">${taxAmount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between border-t border-zinc-200 dark:border-[#1f1f21] pt-2 font-bold text-base">
                                <span>Total</span>
                                <span className="font-mono">${total.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-zinc-500 dark:text-[#71717a]">Payment</span>
                                <div className="flex items-center gap-2">
                                    <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="bg-transparent text-xs border-b border-zinc-200 dark:border-[#333] outline-none py-0.5">
                                        <option>Cash</option>
                                        <option>Credit Card</option>
                                        <option>Wire Transfer</option>
                                        <option>On Terms</option>
                                        <option>Zelle</option>
                                    </select>
                                    <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)} min={0} step="0.01"
                                        className="w-24 bg-transparent text-right font-mono text-sm border-b border-zinc-200 dark:border-[#333] focus:border-blue-500 outline-none" />
                                </div>
                            </div>
                            {paymentAmount > 0 && paymentAmount < total && (
                                <div className="flex justify-between text-sm text-amber-600 dark:text-amber-400">
                                    <span>Balance Due</span>
                                    <span className="font-mono">${balanceDue.toFixed(2)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Messages */}
                <div className="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#1f1f21] rounded-lg p-6 space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-zinc-500 dark:text-[#71717a] mb-1">Message on invoice</label>
                        <textarea value={messageOnInvoice} onChange={e => setMessageOnInvoice(e.target.value)}
                            placeholder="Shows on the invoice PDF (e.g., 'Thank you for your business!')"
                            className="input-stark w-full py-2 text-sm" rows={2} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-zinc-500 dark:text-[#71717a] mb-1">Statement memo (internal)</label>
                        <textarea value={statementMemo} onChange={e => setStatementMemo(e.target.value)}
                            placeholder="Internal note, not visible to customer"
                            className="input-stark w-full py-2 text-sm" rows={2} />
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="sticky bottom-0 bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#1f1f21] rounded-lg p-4 flex items-center justify-between shadow-lg">
                    <button onClick={() => navigate('/admin/invoices')} className="btn-ghost text-sm px-4 py-2">
                        Cancel
                    </button>
                    <div className="flex items-center gap-2">
                        <button onClick={() => handleSave()} disabled={loading} className="btn-ghost text-sm px-4 py-2">
                            <Save size={14} className="mr-1" /> Save Draft
                        </button>
                        <button onClick={() => handleSave('close')} disabled={loading} className="btn-ghost text-sm px-4 py-2">
                            Save & Close
                        </button>
                        <button onClick={() => handleSave('new')} disabled={loading} className="btn-ghost text-sm px-4 py-2">
                            Save & New
                        </button>
                        <button onClick={() => handleSave('send')} disabled={loading} className="btn-primary text-sm px-4 py-2">
                            <Send size={14} className="mr-1" /> Save & Send
                        </button>
                    </div>
                </div>
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div className="fixed z-50 bg-white dark:bg-[#1a1a1c] border border-zinc-200 dark:border-[#27272a] rounded-lg shadow-xl py-1 w-48"
                    style={{ left: contextMenu.x, top: contextMenu.y }}>
                    <button onClick={() => duplicateLineItem(contextMenu.rowId)} className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-[#141416]">
                        Duplicate
                    </button>
                    <button onClick={() => insertLineAbove(contextMenu.rowId)} className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-[#141416]">
                        Insert Above
                    </button>
                    <button onClick={() => insertLineBelow(contextMenu.rowId)} className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-[#141416]">
                        Insert Below
                    </button>
                    <hr className="border-zinc-100 dark:border-[#222] my-1" />
                    <button onClick={() => removeLineItem(contextMenu.rowId)} className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600">
                        Delete
                    </button>
                </div>
            )}

            {showCustomerModal && (
                <CustomerModal
                    isOpen={true}
                    onClose={() => setShowCustomerModal(false)}
                    onSuccess={() => setShowCustomerModal(false)}
                />
            )}
        </div>
    );
}
