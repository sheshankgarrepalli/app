import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash2, Building, User as UserIcon, CreditCard, Receipt } from 'lucide-react';
import CheckoutCRMWidget from './CheckoutCRMWidget';

export default function POS() {
  const { token, user } = useAuth();

  // Tab control
  const [activeTab, setActiveTab] = useState<'retail' | 'b2b'>('retail');

  // Retail State
  const [selectedCrmCustomer, setSelectedCrmCustomer] = useState<any>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [retailItems, setRetailItems] = useState<{ imei: string, price: string }[]>([{ imei: '', price: '' }]);
  const [taxPercent, setTaxPercent] = useState('8.5');

  // B2B State
  const [crmId, setCrmId] = useState('');
  const [b2bImeis, setB2bImeis] = useState('');

  // B2B CRM Object helper for address autofill
  const [b2bCustomer, setB2bCustomer] = useState<any>(null);
  const [fulfillmentMethod, setFulfillmentMethod] = useState<'Walk-in' | 'Ship'>('Walk-in');
  const [shippingAddress, setShippingAddress] = useState('');

  // Retail Handlers
  const addRetailItem = () => setRetailItems([...retailItems, { imei: '', price: '' }]);
  const removeRetailItem = (idx: number) => setRetailItems(retailItems.filter((_, i) => i !== idx));
  const updateRetailItem = (idx: number, field: string, value: string) => {
    const newItems = [...retailItems];
    newItems[idx] = { ...newItems[idx], [field]: value };
    setRetailItems(newItems);
  };

  const handleRetailCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (retailItems.some(i => !i.imei || !i.price)) return alert("Please fill all items cleanly");

    const payload = {
      customer_id: selectedCrmCustomer ? selectedCrmCustomer.crm_id : undefined,
      customer: selectedCrmCustomer ? undefined : { name: customerName, phone: customerPhone, customer_type: 'Retail' },
      items: retailItems.map(i => ({ imei: i.imei, unit_price: parseFloat(i.price) })),
      tax_percent: parseFloat(taxPercent)
    };

    try {
      const res = await axios.post((import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/pos/invoice', payload, { headers: { Authorization: `Bearer ${token}` } });
      const invoiceId = res.data.id;
      window.open(`/api/pos/invoice/${invoiceId}/pdf`, '_blank');

      setCustomerName(''); setCustomerPhone(''); setRetailItems([{ imei: '', price: '' }]);
      alert("Retail sale complete and invoice generated!");
    } catch (err: any) {
      alert(err.response?.data?.detail || "Error during retail checkout");
    }
  };

  const retailSubtotal = retailItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);

  // Calculate retail discount
  const retailDiscountRate = selectedCrmCustomer?.pricing_tier || 0;
  const discountedSubtotal = retailSubtotal * (1 - retailDiscountRate);

  // Calculate tax
  const effectiveTaxPercent = selectedCrmCustomer?.tax_exempt_id ? 0 : (parseFloat(taxPercent) || 0);
  const retailTax = discountedSubtotal * (effectiveTaxPercent / 100);
  const retailTotal = discountedSubtotal + retailTax;

  // B2B Handlers
  const handleB2BCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crmId || !b2bImeis) return alert("Please provide CRM ID and at least one IMEI");

    const imeiList = b2bImeis.split(/[\s,]+/).filter(i => i.trim().length > 0);

    try {
      const payload = {
        imei_list: imeiList,
        crm_id: crmId,
        fulfillment_method: fulfillmentMethod === 'Walk-in' ? 'Walk-in' : 'Ship to Customer',
        shipping_address: fulfillmentMethod === 'Ship' ? shippingAddress : null
      };

      const res = await axios.post((import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/pos/bulk-checkout', payload, { headers: { Authorization: `Bearer ${token}` } });
      alert(`B2B Checkout Successful!\nTotal Items: ${res.data.summary.total_items}\nTotal Due: $${res.data.summary.total_due}`);

      setCrmId(''); setB2bImeis(''); setB2bCustomer(null); setFulfillmentMethod('Walk-in'); setShippingAddress('');
    } catch (err: any) {
      alert(err.response?.data?.detail || "Error during B2B bulk checkout");
    }
  };


  return (
    <div className="flex flex-col h-full bg-zinc-50">
      <header className="p-6 bg-white border-b border-zinc-200 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold text-zinc-900">Point of Sale</h1>
          <p className="text-xs text-zinc-500 mt-1">Transaction processing & invoice generation</p>
        </div>

        {user?.role === 'admin' && (
          <div className="flex bg-zinc-100 border border-zinc-200 p-1 rounded-lg">
            {(['retail', 'b2b'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2 rounded-md text-xs font-semibold uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
              >
                {tab === 'retail' ? <div className="flex items-center gap-2"><UserIcon size={14} /> Retail</div> : <div className="flex items-center gap-2"><Building size={14} /> Wholesale</div>}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'retail' ? (
          <form onSubmit={handleRetailCheckout} className="grid grid-cols-12 h-full">
            {/* LEFT: CONTROLS */}
            <div className="col-span-8 bg-white border-r border-zinc-200 p-8 space-y-12 overflow-y-auto">
              <section className="space-y-6">
                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 ml-1">Entity Selection</label>
                <CheckoutCRMWidget onSelect={(c) => setSelectedCrmCustomer(c)} />

                {!selectedCrmCustomer && (
                  <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-500">
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 ml-1">Customer Name</span>
                      <input placeholder="Walk-in Name" required value={customerName} onChange={e => setCustomerName(e.target.value)} className="input-stark w-full py-3" />
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 ml-1">Phone Number</span>
                      <input placeholder="Walk-in Phone" required value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="input-stark w-full py-3" />
                    </div>
                  </div>
                )}
              </section>

              <section className="space-y-6">
                <div className="flex justify-between items-center border-b border-zinc-200 pb-4">
                  <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 ml-1">Line Items</label>
                  <button type="button" onClick={addRetailItem} className="text-xs font-semibold uppercase tracking-widest text-zinc-900 flex items-center gap-2 hover:text-zinc-600 transition-colors"><Plus size={16} /> Add Item</button>
                </div>
                <div className="space-y-3">
                  {retailItems.map((item, idx) => (
                    <div key={idx} className="flex gap-4 items-center animate-in slide-in-from-left-2 duration-300">
                      <div className="flex-1">
                        <input placeholder="Scan or type IMEI" required value={item.imei} onChange={e => updateRetailItem(idx, 'imei', e.target.value)} className="input-stark w-full py-4 font-mono text-sm tracking-widest uppercase" />
                      </div>
                      <div className="w-48">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">$</span>
                          <input placeholder="Price" type="number" required value={item.price} onChange={e => updateRetailItem(idx, 'price', e.target.value)} className="input-stark w-full pl-8 py-4 text-sm font-bold text-right" />
                        </div>
                      </div>
                      <button type="button" onClick={() => removeRetailItem(idx)} className="p-2 text-zinc-300 hover:text-rose-600 transition-colors"><Trash2 size={18} /></button>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* RIGHT: SUMMARY */}
            <div className="col-span-4 p-8 space-y-12 bg-zinc-50">
              <section className="p-8 bg-white border border-zinc-200 rounded-lg shadow-sm space-y-8">
                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 block border-b border-zinc-100 pb-4">Transaction Summary</label>

                <div className="space-y-4">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-zinc-500">Subtotal</span>
                    <span className="text-zinc-900">${retailSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  {retailDiscountRate > 0 && (
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-zinc-500">Wholesale Discount ({(retailDiscountRate * 100).toFixed(0)}%)</span>
                      <span className="text-emerald-600">-${(retailSubtotal - discountedSubtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span className="text-zinc-500 flex items-center gap-2">Tax (%) {selectedCrmCustomer?.tax_exempt_id && <span className="badge-glow badge-success">Exempt</span>}</span>
                    <input
                      type="number"
                      step="0.1"
                      value={taxPercent}
                      onChange={e => setTaxPercent(e.target.value)}
                      disabled={!!selectedCrmCustomer?.tax_exempt_id}
                      className="w-16 bg-transparent border-b border-zinc-200 text-right outline-none focus:border-zinc-900 transition-colors text-zinc-900 font-bold disabled:opacity-30"
                    />
                  </div>
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-zinc-500">Tax Amount</span>
                    <span className="text-zinc-900">${retailTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="pt-8 border-t border-zinc-100">
                  <div className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 mb-2">Total Amount Due</div>
                  <div className="text-5xl font-bold tracking-tighter text-zinc-900">
                    ${retailTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-primary w-full h-16 text-xs font-semibold uppercase tracking-[0.2em] flex items-center justify-center gap-3"
                >
                  <Receipt size={20} /> Process Checkout
                </button>
              </section>
            </div>
          </form>
        ) : (
          <form onSubmit={handleB2BCheckout} className="grid grid-cols-12 h-full">
            {/* LEFT: B2B CONTROLS */}
            <div className="col-span-8 bg-white border-r border-zinc-200 p-8 space-y-12 overflow-y-auto">
              <section className="space-y-8">
                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 ml-1">Wholesale Entity</label>
                <div className="grid grid-cols-2 gap-12">
                  <div className="space-y-4">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 ml-1">Customer CRM ID *</span>
                    <div className="flex gap-2">
                      <input
                        placeholder="CRM-XXXX-XXXX"
                        required
                        value={crmId}
                        onChange={e => setCrmId(e.target.value)}
                        className="input-stark flex-1 py-4 font-mono text-sm tracking-widest uppercase"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (!crmId) return;
                          try {
                            const res = await axios.get(`/api/crm/${crmId}/history`, { headers: { Authorization: `Bearer ${token}` } });
                            setB2bCustomer(res.data.customer);
                            if (res.data.customer.shipping_address) setShippingAddress(res.data.customer.shipping_address);
                          } catch (err) {
                            alert("Failed to lookup CRM ID.");
                          }
                        }}
                        className="btn-secondary px-6"
                      >
                        Lookup
                      </button>
                    </div>
                    {b2bCustomer && (
                      <div className="text-xs font-semibold text-zinc-900 animate-in fade-in duration-300 px-1">
                        Verified: <span className="text-zinc-500">{b2bCustomer.company_name || b2bCustomer.name}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-6">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 ml-1">Fulfillment Method *</span>
                    <div className="flex bg-zinc-100 border border-zinc-200 p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setFulfillmentMethod('Walk-in')}
                        className={`flex-1 py-2 text-xs font-semibold uppercase tracking-widest transition-all rounded-md ${fulfillmentMethod === 'Walk-in' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
                      >
                        Walk-in
                      </button>
                      <button
                        type="button"
                        onClick={() => setFulfillmentMethod('Ship')}
                        className={`flex-1 py-2 text-xs font-semibold uppercase tracking-widest transition-all rounded-md ${fulfillmentMethod === 'Ship' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
                      >
                        Shipped
                      </button>
                    </div>

                    {fulfillmentMethod === 'Ship' && (
                      <div className="animate-in slide-in-from-top-2 duration-300 space-y-2">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 ml-1">Destination Address</span>
                        <textarea
                          required
                          rows={3}
                          placeholder="Enter full destination address..."
                          className="input-stark w-full py-3 text-sm tracking-tight resize-none"
                          value={shippingAddress}
                          onChange={e => setShippingAddress(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="space-y-6">
                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 ml-1">Bulk Items Scan</label>
                <div className="space-y-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 ml-1">Enter IMEIs (Comma or Line Separated) *</span>
                  <textarea
                    required
                    value={b2bImeis}
                    onChange={e => setB2bImeis(e.target.value)}
                    placeholder="123456789012345, 987654321098765..."
                    className="input-stark w-full h-48 py-4 font-mono text-sm tracking-widest uppercase resize-none"
                  />
                  <div className="text-xs font-semibold text-zinc-400 text-right px-1">
                    Total Items Identified: {b2bImeis.split(/[\s,]+/).filter(i => i.trim().length > 0).length}
                  </div>
                </div>
              </section>
            </div>

            {/* RIGHT: B2B ACTIONS */}
            <div className="col-span-4 p-8 space-y-12 bg-zinc-50">
              <section className="p-8 bg-white border border-zinc-200 rounded-lg shadow-sm space-y-8">
                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 block border-b border-zinc-100 pb-4">Wholesale Action</label>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  Bulk checkout will process all scanned IMEIs against the selected CRM entity. Pricing and tax rules will be applied automatically based on the customer profile.
                </p>
                <button
                  type="submit"
                  className="btn-primary w-full h-16 text-xs font-semibold uppercase tracking-[0.2em] flex items-center justify-center gap-3"
                >
                  <CreditCard size={20} /> Process B2B Checkout
                </button>
              </section>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
