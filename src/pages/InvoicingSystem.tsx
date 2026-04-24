import { useState, useRef, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
    Package, Trash2, Printer,
    Scan, AlertCircle,
    CheckCircle2, X, FileText,
    Share2, Mail
} from 'lucide-react';

type TransactionType = 'Retail' | 'Wholesale' | 'Transfer' | 'Estimate';
type PaymentMethod = 'Cash' | 'Credit Card' | 'Wire Transfer' | 'On Terms' | 'Unpaid';

interface ScannedDevice {
    imei: string;
    model: string;
    brand: string;
    price: number;
    cost_basis: number;
}

interface GroupedItem {
    id: string;
    model: string;
    brand: string;
    qty: number;
    rate: number;
    amount: number;
    imeis: string[];
}

export default function InvoicingSystem() {
    const { token } = useAuth();

    // --- CORE STATE ---
    const [txType, setTxType] = useState<TransactionType>('Retail');
    const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
    const [nextNumber, setNextNumber] = useState('');
    const [skuInput, setSkuInput] = useState('');
    const [scannedDevices, setScannedDevices] = useState<ScannedDevice[]>([]);
    const [errorStatus, setErrorStatus] = useState<string | null>(null);

    // --- CUSTOMER / DESTINATION STATE ---
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const [customerResults, setCustomerResults] = useState<any[]>([]);
    const [destinationLocation, setDestinationLocation] = useState('');
    const [locations, setLocations] = useState<any[]>([]);

    // --- ADDITIONAL FIELDS ---
    const [poNumber, setPoNumber] = useState('');
    const [terms, setTerms] = useState('Due on Receipt');
    const [fulfillmentMethod, setFulfillmentMethod] = useState<'Walk-in' | 'Shipped'>('Walk-in');
    const [shippingAddress, setShippingAddress] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
    const [upfrontPayment, setUpfrontPayment] = useState<number>(0);

    // --- FLOW STATE ---
    const [isProcessing, setIsProcessing] = useState(false);
    const [successState, setSuccessState] = useState<{ id: string; pdfUrl: string; total: number } | null>(null);

    const scannerRef = useRef<HTMLInputElement>(null);
    const searchTimeout = useRef<any>(null);

    // --- INITIALIZATION ---
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const editId = params.get('edit');
        if (editId) {
            loadInvoice(editId);
        } else {
            fetchNextNumber();
        }
        if (txType === 'Transfer') fetchLocations();
    }, [txType]);

    const loadInvoice = async (id: string) => {
        try {
            const res = await axios.get(`/api/pos/invoices`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const invoice = res.data.find((inv: any) => inv.invoice_number === id);
            if (invoice) {
                setEditingInvoiceId(id);
                setNextNumber(id);
                setTxType(invoice.is_estimate ? 'Estimate' : 'Wholesale');
                setSelectedCustomer(invoice.customer);
                setScannedDevices(invoice.items.map((item: any) => ({
                    imei: item.imei,
                    model: item.model_number,
                    brand: '',
                    price: item.unit_price,
                    cost_basis: 0
                })));
                setFulfillmentMethod(invoice.fulfillment_method as any);
                setShippingAddress(invoice.shipping_address || '');
                setPaymentMethod(invoice.payment_method as any);
            }
        } catch (err) {
            console.error("Failed to load invoice", err);
        }
    };

    const fetchNextNumber = async () => {
        try {
            const typeParam = txType === 'Transfer' ? 'transfer' : 'invoice';
            const res = await axios.get(`/api/pos/next-number?type=${typeParam}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNextNumber(res.data.next);
        } catch (err) {
            console.error("Failed to fetch next number", err);
        }
    };

    const fetchLocations = async () => {
        try {
            const res = await axios.get((import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/pos/locations', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setLocations(res.data);
        } catch (err) {
            console.error("Failed to fetch locations", err);
        }
    };

    // Keep scanner focused
    useEffect(() => {
        const keepFocus = () => {
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return;
            scannerRef.current?.focus();
        };
        window.addEventListener('click', keepFocus);
        scannerRef.current?.focus();
        return () => window.removeEventListener('click', keepFocus);
    }, []);

    // Async CRM Search
    useEffect(() => {
        if (!customerSearch || customerSearch.length < 2 || selectedCustomer) {
            setCustomerResults([]);
            return;
        }
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(async () => {
            try {
                const res = await axios.get(`/api/crm/?search=${customerSearch}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setCustomerResults(res.data);
            } catch (err) { console.error(err); }
        }, 300);
        return () => clearTimeout(searchTimeout.current);
    }, [customerSearch, token, selectedCustomer]);

    // Barcode Scanner Engine
    const handleScannerKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const imei = skuInput.trim();
            if (!imei) return;

            if (scannedDevices.some(d => d.imei === imei)) {
                setErrorStatus("IMEI already in cart");
                setSkuInput('');
                return;
            }

            try {
                setErrorStatus(null);
                const res = await axios.get(`/api/inventory/${imei}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                const device = res.data;
                if (device.device_status !== 'Sellable') {
                    setErrorStatus(`Device ${imei} is ${device.device_status}`);
                } else {
                    const basePrice = txType === 'Transfer' ? 0 : device.cost_basis * 1.5;
                    setScannedDevices(prev => [...prev, {
                        imei: device.imei,
                        model: device.model.name,
                        brand: device.model.brand,
                        price: basePrice,
                        cost_basis: device.cost_basis
                    }]);
                }
            } catch (err: any) {
                setErrorStatus(err.response?.status === 404 ? "IMEI not found" : "Fetch error");
            } finally {
                setSkuInput('');
                scannerRef.current?.focus();
            }
        }
    };

    // Grouping Logic
    const groupedItems = useMemo(() => {
        const groups: { [key: string]: GroupedItem } = {};
        scannedDevices.forEach(d => {
            const key = `${d.brand}-${d.model}-${d.price}`;
            if (!groups[key]) {
                groups[key] = {
                    id: key,
                    model: d.model,
                    brand: d.brand,
                    qty: 0,
                    rate: d.price,
                    amount: 0,
                    imeis: []
                };
            }
            groups[key].qty += 1;
            groups[key].amount += d.price;
            groups[key].imeis.push(d.imei);
        });
        return Object.values(groups);
    }, [scannedDevices]);

    const handlePriceChange = (key: string, newPrice: number) => {
        setScannedDevices(prev => prev.map(d => {
            const dKey = `${d.brand}-${d.model}-${d.price}`;
            if (dKey === key) {
                return { ...d, price: newPrice };
            }
            return d;
        }));
    };

    // Calculations
    const subtotal = scannedDevices.reduce((sum, d) => sum + d.price, 0);
    const discountRate = (txType === 'Wholesale' || txType === 'Estimate') ? (selectedCustomer?.pricing_tier || 0) : 0;
    const discountAmount = subtotal * discountRate;
    const isTaxExempt = txType === 'Transfer' || ((txType === 'Wholesale' || txType === 'Estimate') && !!selectedCustomer?.tax_exempt_id);
    const taxRate = isTaxExempt ? 0 : 0.0825;
    const taxAmount = (subtotal - discountAmount) * taxRate;
    const totalDue = subtotal - discountAmount + taxAmount;

    const handleCheckout = async () => {
        if (scannedDevices.length === 0) {
            setErrorStatus("Cart is empty");
            return;
        }
        if (txType === 'Transfer' && !destinationLocation) {
            setErrorStatus("Select destination location");
            return;
        }

        setIsProcessing(true);
        try {
            let endpoint = editingInvoiceId
                ? `/api/pos/invoices/${editingInvoiceId}`
                : (import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/pos/wholesale';

            let method = editingInvoiceId ? 'put' : 'post';

            let payload: any = {
                imei_list: scannedDevices.map(d => d.imei),
                items: scannedDevices.map(d => ({ imei: d.imei, unit_price: d.price })),
                fulfillment_method: fulfillmentMethod,
                shipping_address: shippingAddress,
                payment_method: paymentMethod,
                po_number: poNumber,
                terms: terms,
                transaction_type: txType,
                is_estimate: txType === 'Estimate',
                upfront_payment: upfrontPayment
            };

            if (txType === 'Transfer') {
                endpoint = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/transfers/';
                payload = {
                    imei_list: scannedDevices.map(d => d.imei),
                    destination_location_id: destinationLocation,
                    transfer_type: 'Restock'
                };
            } else {
                payload.crm_id = selectedCustomer?.crm_id || 'RETAIL-WALKIN';
            }

            const res = await (axios as any)[method](endpoint, payload, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: (txType === 'Transfer' || editingInvoiceId) ? 'json' : 'blob'
            });

            if (txType === 'Transfer' || editingInvoiceId) {
                setSuccessState({ id: editingInvoiceId || res.data.transfer_order_id, pdfUrl: '#', total: totalDue });
            } else {
                const blob = new Blob([res.data], { type: 'application/pdf' });
                const url = window.URL.createObjectURL(blob);
                setSuccessState({ id: nextNumber, pdfUrl: url, total: totalDue });

                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `${nextNumber}.pdf`);
                document.body.appendChild(link);
                link.click();
                link.remove();
            }

            setScannedDevices([]);
            setSelectedCustomer(null);
            setCustomerSearch('');
            setErrorStatus(null);
            setEditingInvoiceId(null);
        } catch (err) {
            console.error(err);
            alert("Checkout failed");
        } finally {
            setIsProcessing(false);
        }
    };

    const resetFlow = () => {
        setSuccessState(null);
        setEditingInvoiceId(null);
        fetchNextNumber();
    };

    if (successState) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 p-6">
                <div className="max-w-xl w-full p-12 bg-white border border-zinc-200 rounded-lg text-center shadow-sm animate-in zoom-in-95 duration-500">
                    <div className="flex justify-center mb-8">
                        <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-100">
                            <CheckCircle2 size={40} />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-zinc-900 mb-2">Transaction Success</h1>
                    <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-10">Reference: {successState.id}</p>

                    <div className="space-y-4 mb-10">
                        <button onClick={() => window.open(successState.pdfUrl)} className="btn-primary w-full h-16 text-xs font-semibold uppercase tracking-[0.2em] flex items-center justify-center gap-3">
                            <Printer size={20} /> Print Commercial Invoice
                        </button>
                        <div className="grid grid-cols-2 gap-4">
                            <button className="btn-secondary px-6 py-4 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest">
                                <Mail size={16} /> Email PDF
                            </button>
                            <button className="btn-secondary px-6 py-4 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest">
                                <Share2 size={16} /> WhatsApp
                            </button>
                        </div>
                    </div>

                    <button onClick={resetFlow} className="text-xs font-semibold uppercase tracking-widest text-zinc-400 hover:text-zinc-900 transition-colors">
                        Initialize Next Transaction
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-zinc-50">
            <header className="p-6 bg-white border-b border-zinc-200 flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold text-zinc-900">{editingInvoiceId ? 'Modify Document' : 'Invoicing Engine'}</h1>
                    <div className="text-xs text-zinc-500 flex items-center gap-2 mt-1">
                        <FileText size={14} /> Omni-Channel Terminal • {nextNumber}
                    </div>
                </div>

                <div className="flex bg-zinc-100 border border-zinc-200 p-1 rounded-lg">
                    {(['Retail', 'Wholesale', 'Transfer', 'Estimate'] as TransactionType[]).map(type => (
                        <button
                            key={type}
                            onClick={() => setTxType(type)}
                            className={`px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-widest transition-all ${txType === type ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
                        >
                            {type}
                        </button>
                    ))}
                </div>
            </header>

            <div className="flex-1 grid grid-cols-12 overflow-hidden">
                {/* LEFT PANEL: CONFIGURATION */}
                <div className="col-span-4 bg-white border-r border-zinc-200 p-6 space-y-8 overflow-y-auto">
                    <section className="space-y-3">
                        <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 ml-1">
                            {txType === 'Transfer' ? 'Destination Node' : 'Entity Selection'}
                        </label>

                        {txType === 'Transfer' ? (
                            <select
                                value={destinationLocation}
                                onChange={e => setDestinationLocation(e.target.value)}
                                className="input-stark w-full py-3 text-xs font-bold uppercase tracking-widest"
                            >
                                <option value="">Select Destination...</option>
                                {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                            </select>
                        ) : (
                            <div className="relative group">
                                <input
                                    placeholder="Search CRM database..."
                                    value={customerSearch}
                                    onChange={e => {
                                        setCustomerSearch(e.target.value);
                                        if (selectedCustomer) setSelectedCustomer(null);
                                    }}
                                    className="input-stark w-full py-3"
                                />
                                {selectedCustomer && (
                                    <button onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-900 transition"><X size={16} /></button>
                                )}
                                {customerResults.length > 0 && !selectedCustomer && (
                                    <div className="absolute top-full left-0 right-0 bg-white border border-zinc-200 shadow-xl z-50 mt-1 rounded-lg overflow-hidden">
                                        {customerResults.map(c => (
                                            <button
                                                key={c.crm_id}
                                                onClick={() => { setSelectedCustomer(c); setCustomerSearch(c.company_name || c.name); }}
                                                className="w-full text-left p-3 hover:bg-zinc-50 border-b border-zinc-100 last:border-0 transition-colors"
                                            >
                                                <div className="font-bold text-sm text-zinc-900">{c.company_name || c.name}</div>
                                                <div className="text-[10px] font-semibold text-zinc-500 mt-1 uppercase tracking-widest">{c.phone} • {c.crm_id}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    {(txType === 'Wholesale' || txType === 'Estimate') && (
                        <section className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 ml-1">Contract Parameters</label>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 ml-1">Terms</span>
                                    <select value={terms} onChange={e => setTerms(e.target.value)} className="input-stark w-full py-2.5 text-xs font-bold uppercase tracking-widest">
                                        <option>Due on Receipt</option>
                                        <option>Net 15</option>
                                        <option>Net 30</option>
                                        <option>Net 60</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 ml-1">PO Ref</span>
                                    <input value={poNumber} onChange={e => setPoNumber(e.target.value)} placeholder="ST-XXXX" className="input-stark w-full py-2.5 text-xs font-bold uppercase tracking-widest" />
                                </div>
                            </div>
                        </section>
                    )}

                    <section className="space-y-3">
                        <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 ml-1">Asset Acquisition</label>
                        <div className="relative group">
                            <input
                                ref={scannerRef}
                                value={skuInput}
                                onChange={e => setSkuInput(e.target.value)}
                                onKeyDown={handleScannerKeyDown}
                                placeholder="Scan IMEI..."
                                className="input-stark w-full py-4 font-mono text-lg tracking-widest placeholder:font-sans placeholder:text-xs placeholder:tracking-normal"
                            />
                            <Scan size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-300 group-focus-within:text-zinc-900 transition-colors" />
                        </div>
                        {errorStatus ? (
                            <div className="text-[10px] font-semibold text-rose-600 uppercase tracking-widest flex items-center gap-2 px-1">
                                <AlertCircle size={14} /> {errorStatus}
                            </div>
                        ) : (
                            <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" /> Scanner Synchronized
                            </div>
                        )}
                    </section>

                    {(txType === 'Wholesale' || txType === 'Estimate') && (
                        <section className="space-y-4">
                            <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 ml-1">Logistics</label>
                            <div className="flex bg-zinc-100 border border-zinc-200 p-1 rounded-lg">
                                <button
                                    onClick={() => setFulfillmentMethod('Walk-in')}
                                    className={`flex-1 py-1.5 text-xs font-semibold uppercase tracking-widest rounded-md transition-all ${fulfillmentMethod === 'Walk-in' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
                                >
                                    Walk-in
                                </button>
                                <button
                                    onClick={() => setFulfillmentMethod('Shipped')}
                                    className={`flex-1 py-1.5 text-xs font-semibold uppercase tracking-widest rounded-md transition-all ${fulfillmentMethod === 'Shipped' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
                                >
                                    Shipped
                                </button>
                            </div>
                            {fulfillmentMethod === 'Shipped' && (
                                <textarea
                                    value={shippingAddress}
                                    onChange={e => setShippingAddress(e.target.value)}
                                    placeholder="Destination address..."
                                    rows={2}
                                    className="input-stark w-full py-3 text-sm tracking-tight resize-none"
                                />
                            )}
                        </section>
                    )}

                    {txType !== 'Transfer' && txType !== 'Estimate' && (
                        <section className="space-y-4">
                            <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 ml-1">Financial Tender</label>
                            {txType === 'Wholesale' && (
                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 ml-1">Upfront Credit</span>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">$</span>
                                        <input
                                            type="number"
                                            value={upfrontPayment}
                                            onChange={e => setUpfrontPayment(parseFloat(e.target.value) || 0)}
                                            className="input-stark w-full pl-7 py-2.5 text-sm font-bold"
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-2">
                                {(['Cash', 'Credit Card', 'Wire Transfer', 'On Terms', 'Unpaid'] as PaymentMethod[]).map(method => (
                                    <button
                                        key={method}
                                        onClick={() => setPaymentMethod(method)}
                                        className={`py-2.5 text-[10px] font-bold uppercase tracking-widest border rounded-lg transition-all ${paymentMethod === method ? 'bg-zinc-900 border-zinc-900 text-white shadow-sm' : 'bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50'}`}
                                    >
                                        {method}
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                {/* RIGHT PANEL: CART & SUMMARY */}
                <div className="col-span-8 flex flex-col bg-zinc-50 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-zinc-50/50 border-b border-zinc-200">
                                    <tr className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">
                                        <th className="px-8 py-4">Asset Specification</th>
                                        <th className="px-8 py-4">Identifiers</th>
                                        <th className="px-8 py-4 text-center w-20">Qty</th>
                                        <th className="px-8 py-4 text-right w-40">Unit Price</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {groupedItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="py-32 text-center">
                                                <div className="flex flex-col items-center gap-4 text-zinc-300">
                                                    <Package size={64} className="opacity-10" />
                                                    <div className="text-xs font-semibold uppercase tracking-[0.4em] opacity-40">Transaction Ledger Empty</div>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        groupedItems.map((item) => (
                                            <tr key={item.id} className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors group">
                                                <td className="px-8 py-6">
                                                    <div className="font-bold text-zinc-900 uppercase tracking-tight text-xs">{item.brand}</div>
                                                    <div className="text-xs text-zinc-500 font-semibold mt-0.5 uppercase">{item.model}</div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {item.imeis.map(i => (
                                                            <span key={i} className="text-[10px] font-bold font-mono px-2 py-0.5 border border-zinc-200 text-zinc-500 bg-zinc-50 uppercase rounded">
                                                                {i}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-center font-bold text-zinc-900">{item.qty}</td>
                                                <td className="px-8 py-6 text-right">
                                                    <div className="flex items-center justify-end gap-3">
                                                        <span className="text-zinc-400 text-sm">$</span>
                                                        <input
                                                            type="number"
                                                            value={item.rate}
                                                            onChange={(e) => handlePriceChange(item.id, parseFloat(e.target.value) || 0)}
                                                            className="w-24 bg-transparent border-b border-zinc-200 focus:border-zinc-900 outline-none text-right font-bold text-zinc-900 text-sm py-1 transition-colors"
                                                        />
                                                        <button onClick={() => setScannedDevices(prev => prev.filter(d => !item.imeis.includes(d.imei)))} className="ml-3 text-zinc-300 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* SUMMARY BLOCK */}
                    <div className="p-8 bg-white border-t border-zinc-200 flex justify-between items-end gap-12">
                        <div className="space-y-3 min-w-[240px]">
                            <div className="flex justify-between text-sm font-bold uppercase tracking-widest">
                                <span className="text-zinc-400">Subtotal</span>
                                <span className="text-zinc-900">${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            {discountAmount > 0 && (
                                <div className="flex justify-between text-sm font-bold uppercase tracking-widest text-emerald-600">
                                    <span>Loyalty Discount ({(discountRate * 100).toFixed(0)}%)</span>
                                    <span>-${discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm font-bold uppercase tracking-widest">
                                <span className="text-zinc-400">Sales Tax</span>
                                <span className="text-zinc-900">{isTaxExempt ? 'EXEMPT' : `$${taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}</span>
                            </div>
                            {upfrontPayment > 0 && (
                                <div className="flex justify-between text-sm font-bold uppercase tracking-widest text-zinc-900 border-t border-zinc-100 pt-2 mt-2">
                                    <span className="text-zinc-400">Upfront Credit</span>
                                    <span>-${upfrontPayment.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col items-end gap-6">
                            <div className="text-right">
                                <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400 mb-2">{upfrontPayment > 0 ? 'Balance Due' : 'Total Reconciliation'}</div>
                                <div className="text-6xl font-bold tracking-tighter text-zinc-900">
                                    ${(totalDue - upfrontPayment).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </div>
                            </div>

                            <button
                                onClick={handleCheckout}
                                disabled={isProcessing || scannedDevices.length === 0}
                                className="btn-primary w-80 h-16 text-xs font-semibold uppercase tracking-[0.2em] flex items-center justify-center gap-3"
                            >
                                {isProcessing ? 'Synchronizing...' : (
                                    <>
                                        <CheckCircle2 size={24} /> {editingInvoiceId ? 'Update Document' : 'Process Transaction'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
