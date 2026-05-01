import { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  Scan, Search, Trash2,
  Receipt, Wallet,
  CheckCircle2, X, AlertTriangle, Package,
  Plus, Clock, User, Phone, ShoppingCart
} from 'lucide-react';

type PaymentMethod = 'Cash' | 'Credit_Card' | 'Wire' | 'Store_Credit' | 'On_Terms' | 'Zelle';

interface TenderSlot {
  id: string;
  method: PaymentMethod;
  amount: number;
  reference_id: string;
}

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

const PAYMENT_COLORS: Record<PaymentMethod, string> = {
  Cash: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400',
  Credit_Card: 'border-sky-500/30 bg-sky-500/5 text-sky-400',
  Wire: 'border-violet-500/30 bg-violet-500/5 text-violet-400',
  Store_Credit: 'border-amber-500/30 bg-amber-500/5 text-amber-400',
  On_Terms: 'border-rose-500/30 bg-rose-500/5 text-rose-400',
  Zelle: 'border-indigo-500/30 bg-indigo-500/5 text-indigo-400'
};

export default function POS() {
  const { token } = useAuth();
  const API = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000');

  // Cart
  const [scanInput, setScanInput] = useState('');
  const [scannedDevices, setScannedDevices] = useState<ScannedDevice[]>([]);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  // Customer
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<any[]>([]);

  // Tender
  const [tenderSlots, setTenderSlots] = useState<TenderSlot[]>([
    { id: '1', method: 'Cash', amount: 0, reference_id: '' }
  ]);

  // Transaction mode
  const [txMode, setTxMode] = useState<'sale' | 'layaway'>('sale');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successState, setSuccessState] = useState<{
    invoiceNumber: string;
    total: number;
    paid: number;
    isLayaway: boolean;
    invoiceTerms: string | null;
  } | null>(null);

  // Layaway payment
  const [layawaySearch, setLayawaySearch] = useState('');
  const [layawayInvoice, setLayawayInvoice] = useState<any>(null);
  const [layawayResults, setLayawayResults] = useState<any[]>([]);
  const [layawayPaymentAmount, setLayawayPaymentAmount] = useState(0);
  const [layawayPaymentMethod, setLayawayPaymentMethod] = useState<PaymentMethod>('Cash');

  const scannerRef = useRef<HTMLInputElement>(null);
  const searchTimeout = useRef<any>(null);
  const layawaySearchTimeout = useRef<any>(null);

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

  // CRM search
  useEffect(() => {
    if (!customerSearch || customerSearch.length < 2 || selectedCustomer) {
      setCustomerResults([]);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await axios.get(`${API}/api/crm/?search=${customerSearch}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCustomerResults(res.data);
      } catch (_) {}
    }, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [customerSearch, token, API, selectedCustomer]);

  // Layaway invoice search
  useEffect(() => {
    if (!layawaySearch || layawaySearch.length < 2) {
      setLayawayResults([]);
      return;
    }
    if (layawaySearchTimeout.current) clearTimeout(layawaySearchTimeout.current);
    layawaySearchTimeout.current = setTimeout(async () => {
      try {
        const res = await axios.get(`${API}/api/pos/invoices?query=${layawaySearch}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLayawayResults(res.data.filter((inv: any) =>
          inv.status === 'Partially_Paid' || inv.payment_status === 'Partial_Layaway'
        ));
      } catch (_) {}
    }, 300);
    return () => clearTimeout(layawaySearchTimeout.current);
  }, [layawaySearch, token, API]);

  // Scan IMEI
  const handleScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const imei = scanInput.trim();
    if (!imei) return;

    if (scannedDevices.some(d => d.imei === imei)) {
      setErrorStatus('IMEI already in cart');
      setScanInput('');
      return;
    }

    try {
      setErrorStatus(null);
      const res = await axios.get(`${API}/api/inventory/${imei}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const device = res.data;
      if (device.device_status !== 'Sellable') {
        setErrorStatus(`Device ${imei} is ${device.device_status}`);
      } else {
        const price = device.cost_basis * 1.5;
        setScannedDevices(prev => [...prev, {
          imei: device.imei,
          model: device.model?.name || device.model_number,
          brand: device.model?.brand || 'Generic',
          price,
          cost_basis: device.cost_basis
        }]);
      }
    } catch (err: any) {
      setErrorStatus(err.response?.status === 404 ? 'IMEI not found' : 'Lookup error');
    } finally {
      setScanInput('');
      scannerRef.current?.focus();
    }
  };

  // Grouped cart items
  const groupedItems = useMemo(() => {
    const groups: { [key: string]: GroupedItem } = {};
    scannedDevices.forEach(d => {
      const key = `${d.brand}-${d.model}-${d.price}`;
      if (!groups[key]) {
        groups[key] = { id: key, model: d.model, brand: d.brand, qty: 0, rate: d.price, amount: 0, imeis: [] };
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
      return dKey === key ? { ...d, price: newPrice } : d;
    }));
  };

  // Math
  const subtotal = scannedDevices.reduce((sum, d) => sum + d.price, 0);
  const discountRate = selectedCustomer?.pricing_tier || 0;
  const discountAmount = subtotal * discountRate;
  const isTaxExempt = !!selectedCustomer?.tax_exempt_id;
  const taxRate = isTaxExempt ? 0 : 8.5;
  const taxAmount = (subtotal - discountAmount) * (taxRate / 100);
  const total = subtotal - discountAmount + taxAmount;

  const totalTendered = tenderSlots.reduce((sum, s) => sum + s.amount, 0);
  const balanceDue = total - totalTendered;
  const isFullyPaid = balanceDue <= 0.01 && total > 0;

  // Tender management
  const addTenderSlot = () => {
    const methods: PaymentMethod[] = ['Cash', 'Credit_Card', 'Wire', 'Store_Credit', 'On_Terms', 'Zelle'];
    const used = new Set(tenderSlots.map(s => s.method));
    const available = methods.find(m => !used.has(m)) || 'Cash';
    setTenderSlots(prev => [...prev, { id: Date.now().toString(), method: available, amount: 0, reference_id: '' }]);
  };

  const updateTenderSlot = (id: string, field: string, value: any) => {
    setTenderSlots(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const removeTenderSlot = (id: string) => {
    setTenderSlots(prev => prev.filter(s => s.id !== id));
  };

  const fillRemaining = () => {
    if (balanceDue <= 0) return;
    setTenderSlots(prev => [{ ...prev[0], amount: (prev[0].amount || 0) + balanceDue }]);
  };

  // Checkout
  const handleCheckout = async () => {
    if (scannedDevices.length === 0) { setErrorStatus('Cart is empty'); return; }
    if (!selectedCustomer) { setErrorStatus('Select a customer'); return; }

    const activeSlots = tenderSlots.filter(s => s.amount > 0);
    if (activeSlots.length === 0) { setErrorStatus('Enter at least one payment amount'); return; }

    setIsProcessing(true);
    try {
      const res = await axios.post(`${API}/api/pos/checkout`, {
        customer_id: selectedCustomer.crm_id,
        items: scannedDevices.map(d => ({ imei: d.imei, unit_price: d.price })),
        tax_percent: taxRate,
        payments: activeSlots.map(s => ({
          amount: s.amount,
          payment_method: s.method,
          reference_id: s.reference_id || undefined
        }))
      }, { headers: { Authorization: `Bearer ${token}` } });

      const invoice = res.data;
      setSuccessState({
        invoiceNumber: invoice.invoice_number,
        total: invoice.total,
        paid: totalTendered,
        isLayaway: invoice.payment_status === 'Partial_Layaway',
        invoiceTerms: invoice.invoice_terms || null
      });

      setScannedDevices([]);
      setSelectedCustomer(null);
      setCustomerSearch('');
      setTenderSlots([{ id: '1', method: 'Cash', amount: 0, reference_id: '' }]);
      setErrorStatus(null);
    } catch (err: any) {
      setErrorStatus(err.response?.data?.detail || 'Checkout failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Layaway payment
  const handleLayawayPayment = async () => {
    if (!layawayInvoice || layawayPaymentAmount <= 0) return;
    setIsProcessing(true);
    try {
      await axios.post(
        `${API}/api/pos/invoices/${layawayInvoice.invoice_number}/payments`,
        { amount: layawayPaymentAmount, payment_method: layawayPaymentMethod },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const paid = (layawayInvoice.payments || []).reduce((s: number, p: any) => s + p.amount, 0) + layawayPaymentAmount;
      setSuccessState({
        invoiceNumber: layawayInvoice.invoice_number,
        total: layawayInvoice.total,
        paid,
        isLayaway: paid < layawayInvoice.total,
        invoiceTerms: layawayInvoice.invoice_terms || null
      });

      setLayawayInvoice(null);
      setLayawaySearch('');
      setLayawayPaymentAmount(0);
    } catch (err: any) {
      setErrorStatus(err.response?.data?.detail || 'Layaway payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetFlow = () => {
    setSuccessState(null);
    setScanInput('');
    scannerRef.current?.focus();
  };

  // Success screen
  if (successState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-6">
        <div className="max-w-xl w-full p-12 card text-center">
          <div className="flex justify-center mb-8">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center border ${
              successState.isLayaway
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            }`}>
              <CheckCircle2 size={40} />
            </div>
          </div>
          <h1 className="text-[22px] font-bold text-[#1f2937] dark:text-[#e4e4e7] mb-2">
            {successState.isLayaway ? 'Layaway Reserved' : 'Sale Complete'}
          </h1>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#6b7280] dark:text-[#71717a] mb-6">
            {successState.invoiceNumber}
          </p>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-[#f5f5f5] dark:bg-[#1a1a1c] rounded-xl p-4">
              <div className="text-[10px] text-[#6b7280] dark:text-[#71717a] uppercase tracking-wider mb-1">Total</div>
              <div className="text-xl font-bold text-[#1f2937] dark:text-[#e4e4e7]">
                ${successState.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-[#f5f5f5] dark:bg-[#1a1a1c] rounded-xl p-4">
              <div className="text-[10px] text-[#6b7280] dark:text-[#71717a] uppercase tracking-wider mb-1">Paid</div>
              <div className={`text-xl font-bold ${successState.isLayaway ? 'text-amber-400' : 'text-emerald-400'}`}>
                ${successState.paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {successState.isLayaway && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mb-6 text-left">
              <div className="flex items-center gap-2 mb-1">
                <Clock size={14} className="text-amber-400" />
                <span className="text-xs font-bold text-amber-400 uppercase">Layaway Active</span>
              </div>
              <p className="text-[11px] text-[#6b7280] dark:text-[#71717a]">
                Balance: ${(successState.total - successState.paid).toFixed(2)} due. Use the Layaway tab for additional payments.
              </p>
            </div>
          )}

          {successState.invoiceTerms && (
            <div className="mt-6 pt-6 border-t border-[#e5e7eb] dark:border-[#1f1f21]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] dark:text-[#52525b] mb-2">Terms & Conditions</div>
              <p className="text-[11px] text-[#6b7280] dark:text-[#71717a] leading-relaxed whitespace-pre-line">{successState.invoiceTerms}</p>
            </div>
          )}

          <button onClick={resetFlow} className="btn-primary w-full h-14 text-sm font-semibold">
            New Transaction
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0 h-full flex flex-col">
      {/* Mode tabs */}
      <div className="flex bg-[#f5f5f5] dark:bg-[#0a0a0b] border border-[#e5e7eb] dark:border-[#1f1f21] p-1 rounded-lg w-fit mb-4">
        <button
          onClick={() => setTxMode('sale')}
          className={`px-5 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${
            txMode === 'sale'
              ? 'bg-white dark:bg-[#141416] text-[#1f2937] dark:text-[#e4e4e7] shadow-sm'
              : 'text-[#6b7280] dark:text-[#71717a] hover:text-[#1f2937] dark:hover:text-[#e4e4e7]'
          }`}
        >
          <ShoppingCart size={14} /> New Sale
        </button>
        <button
          onClick={() => setTxMode('layaway')}
          className={`px-5 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${
            txMode === 'layaway'
              ? 'bg-white dark:bg-[#141416] text-[#1f2937] dark:text-[#e4e4e7] shadow-sm'
              : 'text-[#6b7280] dark:text-[#71717a] hover:text-[#1f2937] dark:hover:text-[#e4e4e7]'
          }`}
        >
          <Wallet size={14} /> Layaway Payment
        </button>
      </div>

      {txMode === 'layaway' ? (
        /* ── LAYAWAY MODE ── */
        <div className="flex-1 grid grid-cols-12 gap-4">
          <div className="col-span-5 space-y-4">
            <div className="card p-5">
              <h2 className="text-xs font-bold text-[#1f2937] dark:text-[#e4e4e7] uppercase tracking-wider mb-4 flex items-center gap-2">
                <Search size={14} /> Find Layaway Invoice
              </h2>
              <input
                placeholder="Search by invoice # or customer..."
                value={layawaySearch}
                onChange={e => { setLayawaySearch(e.target.value); setLayawayInvoice(null); }}
                className="form-input w-full py-3 text-sm"
              />
              {layawayResults.length > 0 && !layawayInvoice && (
                <div className="mt-2 border border-[#e5e7eb] dark:border-[#1f1f21] rounded-lg overflow-hidden">
                  {layawayResults.map((inv: any) => {
                    const alreadyPaid = (inv.payments || []).reduce((s: number, p: any) => s + p.amount, 0);
                    return (
                      <button
                        key={inv.id}
                        onClick={() => {
                          setLayawayInvoice(inv);
                          setLayawaySearch(inv.invoice_number);
                          setLayawayPaymentAmount(Math.max(0, inv.total - alreadyPaid));
                        }}
                        className="w-full p-3 hover:bg-[#f9fafb] dark:hover:bg-[#1a1a1c] border-b border-[#e5e7eb] dark:border-[#1f1f21] last:border-0 text-left transition-colors"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-sm text-[#1f2937] dark:text-[#e4e4e7]">{inv.invoice_number}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {inv.payment_status}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] mt-1">
                          {inv.customer?.company_name || inv.customer?.name || 'Unknown'} &middot; ${inv.total?.toFixed(2)} &middot; Paid: ${alreadyPaid.toFixed(2)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {layawayInvoice && (
              <div className="card p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] text-[#6b7280] dark:text-[#71717a] uppercase tracking-wider mb-1">Total</div>
                    <div className="text-lg font-bold text-[#1f2937] dark:text-[#e4e4e7]">${layawayInvoice.total?.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#6b7280] dark:text-[#71717a] uppercase tracking-wider mb-1">Already Paid</div>
                    <div className="text-lg font-bold text-emerald-400">
                      ${(layawayInvoice.payments || []).reduce((s: number, p: any) => s + p.amount, 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-[#6b7280] dark:text-[#71717a] uppercase tracking-wider mb-1">Payment Amount</div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af] dark:text-[#52525b]">$</span>
                    <input
                      type="number"
                      value={layawayPaymentAmount}
                      onChange={e => setLayawayPaymentAmount(parseFloat(e.target.value) || 0)}
                      className="form-input w-full pl-7 py-3 text-lg font-bold"
                    />
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-[#6b7280] dark:text-[#71717a] uppercase tracking-wider mb-1">Method</div>
                  <select
                    value={layawayPaymentMethod}
                    onChange={e => setLayawayPaymentMethod(e.target.value as PaymentMethod)}
                    className="form-select w-full py-2.5 text-sm"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Credit_Card">Credit Card</option>
                    <option value="Wire">Wire Transfer</option>
                    <option value="Zelle">Zelle</option>
                    <option value="Store_Credit">Store Credit</option>
                  </select>
                </div>

                <button
                  onClick={handleLayawayPayment}
                  disabled={isProcessing || layawayPaymentAmount <= 0}
                  className="btn-primary w-full h-12 text-sm font-bold"
                >
                  {isProcessing ? 'Processing...' : 'Apply Payment'}
                </button>
              </div>
            )}
          </div>

          <div className="col-span-7">
            {layawayInvoice ? (
              <div className="card overflow-hidden">
                <table className="table-standard">
                  <thead>
                    <tr>
                      <th>IMEI</th>
                      <th>Model</th>
                      <th className="text-right">Price</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(layawayInvoice.items || []).map((item: any) => (
                      <tr key={item.imei}>
                        <td className="font-mono text-xs font-bold text-[#1f2937] dark:text-[#e4e4e7]">{item.imei}</td>
                        <td className="text-xs text-[#6b7280] dark:text-[#71717a] uppercase">{item.model_number}</td>
                        <td className="text-right font-bold text-[#1f2937] dark:text-[#e4e4e7]">${item.unit_price?.toFixed(2)}</td>
                        <td>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Reserved</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="card p-16 text-center flex flex-col items-center gap-4 text-[#d1d5db] dark:text-[#52525b]">
                <Receipt size={64} className="opacity-20" />
                <p className="text-xs font-semibold uppercase tracking-widest">Search for a layaway invoice to apply payment</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── SALE MODE ── */
        <div className="flex-1 grid grid-cols-12 gap-4 overflow-hidden">
          {/* LEFT: Customer + Scanner */}
          <div className="col-span-4 space-y-4 overflow-y-auto">
            <div className="card p-5 space-y-3">
              <h2 className="text-xs font-bold text-[#1f2937] dark:text-[#e4e4e7] uppercase tracking-wider flex items-center gap-2">
                <User size={14} /> Customer
              </h2>
              <div className="relative">
                <input
                  placeholder="Search customer..."
                  value={customerSearch}
                  onChange={e => {
                    setCustomerSearch(e.target.value);
                    if (selectedCustomer) setSelectedCustomer(null);
                  }}
                  className="form-input w-full py-3 text-sm"
                />
                {selectedCustomer && (
                  <button
                    onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] dark:text-[#52525b] hover:text-[#1f2937] dark:hover:text-[#e4e4e7]"
                  ><X size={16} /></button>
                )}
                {customerResults.length > 0 && !selectedCustomer && (
                  <div className="absolute top-full left-0 right-0 bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] shadow-xl z-50 mt-1 rounded-lg overflow-hidden">
                    {customerResults.map((c: any) => (
                      <button
                        key={c.crm_id}
                        onClick={() => { setSelectedCustomer(c); setCustomerSearch(c.company_name || c.name || ''); }}
                        className="w-full p-3 hover:bg-[#f9fafb] dark:hover:bg-[#1a1a1c] border-b border-[#e5e7eb] dark:border-[#1f1f21] last:border-0 text-left"
                      >
                        <div className="font-bold text-sm text-[#1f2937] dark:text-[#e4e4e7]">
                          {c.company_name || c.name || 'Unknown'}
                        </div>
                        <div className="text-[10px] text-[#6b7280] dark:text-[#71717a] mt-0.5">
                          {c.phone} {c.tax_exempt_id ? '• TAX EXEMPT' : ''} {c.pricing_tier > 0 ? `• ${(c.pricing_tier * 100).toFixed(0)}% TIER` : ''}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedCustomer && (
                <div className="bg-[#f5f5f5] dark:bg-[#1a1a1c] rounded-lg p-3 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-[#1f2937] dark:text-[#e4e4e7] font-bold">
                    <User size={12} /> {selectedCustomer.company_name || selectedCustomer.name}
                  </div>
                  {selectedCustomer.phone && (
                    <div className="flex items-center gap-1.5 text-[#6b7280] dark:text-[#71717a]">
                      <Phone size={12} /> {selectedCustomer.phone}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="card p-5 space-y-3">
              <h2 className="text-xs font-bold text-[#1f2937] dark:text-[#e4e4e7] uppercase tracking-wider flex items-center gap-2">
                <Scan size={14} /> Scan IMEI
              </h2>
              <div className="relative">
                <input
                  ref={scannerRef}
                  value={scanInput}
                  onChange={e => setScanInput(e.target.value)}
                  onKeyDown={handleScan}
                  placeholder="Scan or type IMEI..."
                  className="form-input w-full py-4 font-mono text-lg tracking-widest placeholder:font-sans placeholder:text-xs placeholder:tracking-normal"
                />
                <Scan size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#d1d5db] dark:text-[#52525b]" />
              </div>
              {errorStatus ? (
                <div className="flex items-center gap-2 text-[10px] font-semibold text-red-400 uppercase tracking-wider">
                  <AlertTriangle size={14} /> {errorStatus}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[10px] font-semibold text-[#6b7280] dark:text-[#71717a] uppercase tracking-wider">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Scanner ready
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Cart + Tender */}
          <div className="col-span-8 flex flex-col overflow-hidden space-y-4">
            {/* Cart */}
            <div className="flex-1 card overflow-hidden overflow-y-auto">
              {groupedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-24 text-[#d1d5db] dark:text-[#52525b]">
                  <Package size={64} className="opacity-20 mb-4" />
                  <p className="text-xs font-semibold uppercase tracking-widest">Cart empty — scan IMEIs to begin</p>
                </div>
              ) : (
                <table className="table-standard">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>IMEIs</th>
                      <th className="text-center">Qty</th>
                      <th className="text-right">Price</th>
                      <th className="w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedItems.map(item => (
                      <tr key={item.id} className="group">
                        <td className="py-4">
                          <div className="font-bold text-[#1f2937] dark:text-[#e4e4e7] uppercase text-xs">{item.brand}</div>
                          <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] font-semibold mt-0.5">{item.model}</div>
                        </td>
                        <td className="py-4">
                          <div className="flex flex-wrap gap-1">
                            {item.imeis.map(i => (
                              <span key={i} className="text-[10px] font-bold font-mono px-2 py-0.5 border border-[#e5e7eb] dark:border-[#1f1f21] text-[#6b7280] dark:text-[#71717a] bg-[#f5f5f5] dark:bg-[#0a0a0b] rounded">{i}</span>
                            ))}
                          </div>
                        </td>
                        <td className="py-4 text-center font-bold text-[#1f2937] dark:text-[#e4e4e7]">{item.qty}</td>
                        <td className="py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-[#9ca3af] dark:text-[#52525b]">$</span>
                            <input
                              type="number"
                              value={item.rate}
                              onChange={e => handlePriceChange(item.id, parseFloat(e.target.value) || 0)}
                              className="w-24 bg-transparent border-b border-[#e5e7eb] dark:border-[#1f1f21] focus:border-accent outline-none text-right font-bold text-[#1f2937] dark:text-[#e4e4e7] text-sm py-1"
                            />
                          </div>
                        </td>
                        <td className="py-4">
                          <button
                            onClick={() => setScannedDevices(prev => prev.filter(d => !item.imeis.includes(d.imei)))}
                            className="text-[#d1d5db] dark:text-[#52525b] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                          ><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Bento: Totals + Tender side by side */}
            <div className="grid grid-cols-2 gap-4">
              {/* Summary */}
              <div className="card p-5 space-y-3">
                <h2 className="text-xs font-bold text-[#1f2937] dark:text-[#e4e4e7] uppercase tracking-wider mb-1">Summary</h2>
                <div className="flex justify-between text-xs font-semibold uppercase tracking-wider">
                  <span className="text-[#6b7280] dark:text-[#71717a]">Subtotal</span>
                  <span className="text-[#1f2937] dark:text-[#e4e4e7]">${subtotal.toFixed(2)}</span>
                </div>
                {discountRate > 0 && (
                  <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-emerald-400">
                    <span>Discount ({(discountRate * 100).toFixed(0)}%)</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-semibold uppercase tracking-wider">
                  <span className="text-[#6b7280] dark:text-[#71717a]">Tax ({taxRate}%)</span>
                  <span className="text-[#1f2937] dark:text-[#e4e4e7]">{isTaxExempt ? 'EXEMPT' : `$${taxAmount.toFixed(2)}`}</span>
                </div>
                <div className="flex justify-between text-sm font-bold uppercase tracking-wider pt-2 border-t border-[#e5e7eb] dark:border-[#1f1f21]">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                {totalTendered > 0 && (
                  <div className={`flex justify-between text-xs font-bold uppercase tracking-wider pt-2 border-t border-[#e5e7eb] dark:border-[#1f1f21] ${
                    balanceDue <= 0.01 ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    <span>{balanceDue > 0.01 ? 'Remaining' : balanceDue < -0.01 ? 'Change Due' : 'Balanced'}</span>
                    <span>${Math.abs(balanceDue).toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Split Tender */}
              <div className="card p-5 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-xs font-bold text-[#1f2937] dark:text-[#e4e4e7] uppercase tracking-wider">Split Tender</h2>
                  <div className="flex gap-2">
                    {tenderSlots.length < 6 && (
                      <button onClick={addTenderSlot} className="text-[10px] font-bold text-accent hover:text-accent/80 uppercase tracking-wider flex items-center gap-1">
                        <Plus size={12} /> Split
                      </button>
                    )}
                    {balanceDue > 0.01 && (
                      <button onClick={fillRemaining} className="text-[10px] font-bold text-[#6b7280] dark:text-[#71717a] hover:text-[#1f2937] dark:hover:text-[#e4e4e7] uppercase tracking-wider">
                        Fill
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-2 max-h-[180px] overflow-y-auto">
                  {tenderSlots.map(slot => (
                    <div key={slot.id} className={`flex items-center gap-2 p-2 rounded-lg border ${PAYMENT_COLORS[slot.method]}`}>
                      <select
                        value={slot.method}
                        onChange={e => updateTenderSlot(slot.id, 'method', e.target.value)}
                        className="bg-transparent text-xs font-bold uppercase outline-none"
                      >
                        {(['Cash', 'Credit_Card', 'Wire', 'Store_Credit', 'On_Terms', 'Zelle'] as PaymentMethod[]).map(m => (
                          <option key={m} value={m} className="bg-[#141416] text-[#e4e4e7]">{m.replace('_', ' ')}</option>
                        ))}
                      </select>
                      <div className="flex-1 relative">
                        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] opacity-50">$</span>
                        <input
                          type="number"
                          value={slot.amount || ''}
                          onChange={e => updateTenderSlot(slot.id, 'amount', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="w-full bg-transparent pl-4 py-1 text-sm font-bold text-right outline-none placeholder:opacity-30"
                        />
                      </div>
                      {tenderSlots.length > 1 && (
                        <button onClick={() => removeTenderSlot(slot.id)} className="opacity-50 hover:opacity-100"><X size={14} /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Action */}
            <button
              onClick={handleCheckout}
              disabled={isProcessing || scannedDevices.length === 0 || totalTendered <= 0}
              className={`w-full h-14 rounded-xl text-sm font-bold uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${
                isFullyPaid
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                  : 'bg-accent hover:bg-accent/90 text-white'
              } disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              {isProcessing ? 'Processing...' : isFullyPaid ? (
                <><CheckCircle2 size={20} /> Complete Sale — ${total.toFixed(2)}</>
              ) : (
                <><Wallet size={20} /> Start Layaway — ${balanceDue.toFixed(2)} Remaining</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
