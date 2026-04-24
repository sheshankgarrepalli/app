import React, { useState, useRef, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  Package,
  Scan, AlertCircle, CreditCard,
  X
} from 'lucide-react';

interface ScannedDevice {
  imei: string;
  model: string;
  brand: string;
  price: number;
}

interface GroupedItem {
  id: string; // model + brand
  model: string;
  brand: string;
  qty: number;
  rate: number;
  amount: number;
  imeis: string[];
}

export default function WholesalePOS() {
  const { token } = useAuth();

  // --- STATE ---
  const [skuInput, setSkuInput] = useState('');
  const [scannedDevices, setScannedDevices] = useState<ScannedDevice[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [fulfillmentMethod, setFulfillmentMethod] = useState<'Walk-in' | 'Shipped'>('Walk-in');
  const [shippingAddress, setShippingAddress] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const scannerRef = useRef<HTMLInputElement>(null);
  const searchTimeout = useRef<any>(null);

  // --- ACTIONS ---

  // Keep scanner focused
  useEffect(() => {
    const keepFocus = () => {
      if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        scannerRef.current?.focus();
      }
    };
    window.addEventListener('click', keepFocus);
    scannerRef.current?.focus();
    return () => window.removeEventListener('click', keepFocus);
  }, []);

  // Async Customer Search
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
      } catch (err) {
        console.error("CRM Search Error", err);
      }
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
          setErrorStatus(`Device status: ${device.device_status} (Not Sellable)`);
        } else {
          setScannedDevices(prev => [...prev, {
            imei: device.imei,
            model: device.model.name,
            brand: device.model.brand,
            price: device.cost_basis * 1.5 // Wholesale markup
          }]);
        }
      } catch (err: any) {
        setErrorStatus(err.response?.status === 404 ? "IMEI not found in system" : "Error fetching device");
      } finally {
        setSkuInput('');
        scannerRef.current?.focus();
      }
    }
  };

  // Grouping Logic (useMemo)
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

  // Totals Calculation
  const subtotal = scannedDevices.reduce((sum, d) => sum + d.price, 0);
  const discountRate = selectedCustomer?.pricing_tier || 0;
  const discountAmount = subtotal * discountRate;
  const isTaxExempt = !!selectedCustomer?.tax_exempt_id;
  const taxRate = isTaxExempt ? 0 : 0.0825;
  const taxAmount = (subtotal - discountAmount) * taxRate;
  const totalDue = subtotal - discountAmount + taxAmount;

  const handleCheckout = async () => {
    if (!selectedCustomer) {
      setErrorStatus("Select a customer first");
      return;
    }
    if (scannedDevices.length === 0) {
      setErrorStatus("Cart is empty");
      return;
    }

    setIsProcessing(true);
    try {
      const payload = {
        imei_list: scannedDevices.map(d => d.imei),
        crm_id: selectedCustomer.crm_id,
        fulfillment_method: fulfillmentMethod,
        shipping_address: fulfillmentMethod === 'Shipped' ? shippingAddress : null
      };

      const res = await axios.post((import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/pos/wholesale', payload, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Invoice_${selectedCustomer.company_name || selectedCustomer.name}_${new Date().getTime()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setScannedDevices([]);
      setSelectedCustomer(null);
      setCustomerSearch('');
      setShippingAddress('');
      setErrorStatus(null);
      alert("Transaction Finalized. PDF Downloaded.");
    } catch (err) {
      console.error("Checkout Failed", err);
      alert("Checkout failed. Check network tab.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50">
      <header className="p-6 bg-white border-b border-zinc-200 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold text-zinc-900">Wholesale Terminal</h1>
          <p className="text-xs text-zinc-500 mt-1">High-volume transaction & fulfillment engine</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500 border border-zinc-200 px-4 py-2 rounded-lg bg-white shadow-sm">
            {scannedDevices.length} Assets Identified
          </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* LEFT COMPONENT: CONTROLS */}
        <div className="col-span-4 bg-white border-r border-zinc-200 p-6 space-y-10 overflow-y-auto">
          {/* 1. Customer Selection */}
          <section className="space-y-4">
            <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 ml-1">Entity Selection</label>
            <div className="relative group">
              <input
                placeholder="Search CRM database..."
                value={customerSearch}
                onChange={e => {
                  setCustomerSearch(e.target.value);
                  if (selectedCustomer) setSelectedCustomer(null);
                }}
                disabled={!!selectedCustomer}
                className="input-stark w-full py-4"
              />
              {selectedCustomer && (
                <button onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-900 transition-colors"><X size={16} /></button>
              )}
              {customerResults.length > 0 && !selectedCustomer && (
                <div className="absolute top-full left-0 right-0 bg-white border border-zinc-200 shadow-xl z-50 mt-1 max-h-60 overflow-auto rounded-lg">
                  {customerResults.map(c => (
                    <button
                      key={c.crm_id}
                      onClick={() => {
                        setSelectedCustomer(c);
                        setCustomerSearch(c.company_name || c.name);
                        if (c.shipping_address) setShippingAddress(c.shipping_address);
                      }}
                      className="w-full text-left p-4 hover:bg-zinc-50 border-b border-zinc-100 last:border-0 transition-colors"
                    >
                      <div className="font-bold text-sm tracking-tight uppercase text-zinc-900">{c.company_name || c.name}</div>
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mt-1">{c.phone} • {c.crm_id}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedCustomer && (
              <div className="p-6 bg-zinc-50 border border-zinc-200 rounded-lg space-y-3 animate-in fade-in duration-500">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Active Commercial Terms</div>
                <div className="text-xs font-bold text-zinc-900 uppercase tracking-widest">
                  {(selectedCustomer.pricing_tier * 100).toFixed(0)}% Loyalty Discount Applied
                </div>
                {isTaxExempt && <div className="badge-glow badge-success text-[10px]">Tax Exempt Verified</div>}
              </div>
            )}
          </section>

          {/* 2. Fulfillment */}
          <section className="space-y-4">
            <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 ml-1">Fulfillment Logistics</label>
            <div className="flex bg-zinc-100 border border-zinc-200 p-1 rounded-lg">
              <button
                onClick={() => setFulfillmentMethod('Walk-in')}
                className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-widest transition-all rounded-md ${fulfillmentMethod === 'Walk-in' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
              >
                Walk-in
              </button>
              <button
                onClick={() => setFulfillmentMethod('Shipped')}
                className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-widest transition-all rounded-md ${fulfillmentMethod === 'Shipped' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
              >
                Shipped
              </button>
            </div>

            {fulfillmentMethod === 'Shipped' && (
              <div className="animate-in slide-in-from-top-2 duration-300 space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 ml-1">Destination Address</span>
                <textarea
                  value={shippingAddress}
                  onChange={e => setShippingAddress(e.target.value)}
                  placeholder="Enter full destination address..."
                  rows={3}
                  className="input-stark w-full py-3 text-sm tracking-tight resize-none"
                />
              </div>
            )}
          </section>

          {/* 3. Scanner Engine */}
          <section className="pt-8 border-t border-zinc-100">
            <div className="relative group">
              <input
                ref={scannerRef}
                value={skuInput}
                onChange={e => setSkuInput(e.target.value)}
                onKeyDown={handleScannerKeyDown}
                placeholder="Scan asset to cart..."
                className="input-stark w-full py-5 font-mono text-xl tracking-widest placeholder:font-sans placeholder:text-xs placeholder:tracking-normal"
              />
              <Scan size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-300 group-focus-within:text-zinc-900 transition-colors" />
            </div>
            {errorStatus ? (
              <div className="mt-4 text-[10px] font-semibold text-rose-600 uppercase tracking-widest flex items-center gap-2 px-1">
                <AlertCircle size={14} /> {errorStatus}
              </div>
            ) : (
              <div className="mt-4 text-[10px] font-semibold text-zinc-400 uppercase tracking-widest flex items-center gap-2 px-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" /> Telemetry Active & Synchronized
              </div>
            )}
          </section>
        </div>

        {/* RIGHT COMPONENT: CART & SUMMARY */}
        <div className="col-span-8 flex flex-col bg-zinc-50 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6">
            <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-zinc-50/50 border-b border-zinc-200">
                  <tr className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">
                    <th className="px-8 py-4">Asset Specification</th>
                    <th className="px-8 py-4">Identified Identifiers</th>
                    <th className="px-8 py-4 text-center w-20">Qty</th>
                    <th className="px-8 py-4 text-right w-40">Valuation</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {groupedItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-32 text-center">
                        <div className="flex flex-col items-center gap-4 text-zinc-300">
                          <Package size={48} className="opacity-10" />
                          <div className="text-xs font-semibold uppercase tracking-[0.4em] opacity-40">Transaction Document Empty</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    groupedItems.map((item) => (
                      <tr key={item.id} className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors group">
                        <td className="px-8 py-6">
                          <div className="font-bold text-zinc-900 uppercase text-sm tracking-tight">{item.brand}</div>
                          <div className="text-xs text-zinc-500 font-semibold uppercase mt-1">{item.model}</div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex flex-wrap gap-1.5">
                            {item.imeis.map(i => (
                              <span key={i} className="text-[10px] font-bold font-mono px-2 py-0.5 border border-zinc-200 text-zinc-500 bg-zinc-50 uppercase tracking-tighter rounded">
                                {i}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-8 py-6 text-center font-bold text-zinc-900">{item.qty}</td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex items-center justify-end gap-4">
                            <span className="font-bold text-zinc-900 text-sm">
                              ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                            <button onClick={() => setScannedDevices(prev => prev.filter(d => !item.imeis.includes(d.imei)))} className="text-zinc-300 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100">
                              <X size={16} />
                            </button>
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
          <div className="p-8 border-t border-zinc-200 bg-white flex justify-between items-end gap-12">
            <div className="space-y-4">
              <div className="flex gap-12 text-xs font-semibold uppercase tracking-widest">
                <span className="text-zinc-400 w-32">Subtotal</span>
                <span className="text-zinc-900">${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex gap-12 text-xs font-semibold uppercase tracking-widest">
                  <span className="text-zinc-400 w-32">Loyalty Discount</span>
                  <span className="text-emerald-600">-${discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex gap-12 text-xs font-semibold uppercase tracking-widest">
                <span className="text-zinc-400 w-32">Sales Tax</span>
                <span className="text-zinc-900">{isTaxExempt ? 'EXEMPT' : `$${taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}</span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-6">
              <div className="text-right">
                <div className="text-xs font-semibold uppercase tracking-[0.4em] text-zinc-400 mb-2">Total Reconciliation</div>
                <div className="text-5xl font-bold tracking-tighter text-zinc-900">
                  ${totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={isProcessing || scannedDevices.length === 0}
                className="btn-primary w-80 h-16 text-xs font-semibold uppercase tracking-[0.2em] flex items-center justify-center gap-3"
              >
                {isProcessing ? 'Synchronizing...' : (
                  <>
                    <CreditCard size={20} /> Finalize Transaction
                  </>
                )}
              </button>

              {isProcessing && (
                <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 animate-pulse">
                  Assembling Commercial Invoice PDF...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
