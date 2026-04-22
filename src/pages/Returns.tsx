import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Scan, AlertCircle, Package, ArrowRight, ShieldCheck, ShieldAlert } from 'lucide-react';

export default function Returns() {
    const { token } = useAuth();
    const [skuInput, setSkuInput] = useState('');
    const [scannedDevice, setScannedDevice] = useState<any>(null);
    const [errorStatus, setErrorStatus] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [overridePolicy, setOverridePolicy] = useState(false);
    const scannerRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        scannerRef.current?.focus();
    }, []);

    const handleScannerKeyDown = async (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && skuInput.trim()) {
            fetchDeviceDetails(skuInput.trim());
            setSkuInput('');
        }
    };

    const fetchDeviceDetails = async (imei: string) => {
        setErrorStatus('');
        setScannedDevice(null);
        try {
            const res = await axios.get(`http://localhost:8000/api/inventory/track/${imei}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const deviceData = res.data.device;
            if (deviceData.device_status !== 'Sold') {
                setErrorStatus("Device is not in 'Sold' status. Only sold devices can be returned.");
                return;
            }
            setScannedDevice(res.data);
        } catch (err: any) {
            setErrorStatus(err.response?.data?.detail || "Device not found");
        }
    };

    const handleProcessReturn = async () => {
        if (!scannedDevice) return;
        setIsProcessing(true);
        try {
            await axios.post((import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/pos/returns', {
                customer_id: scannedDevice.device.sold_to_crm_id,
                imei_list: [scannedDevice.device.imei],
                override_policy: overridePolicy
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert("Return processed successfully. Device moved to QC.");
            setScannedDevice(null);
            setOverridePolicy(false);
        } catch (err: any) {
            alert(err.response?.data?.detail || "Error processing return");
        } finally {
            setIsProcessing(false);
        }
    };

    const isUnderWarranty = (expiry: string | null) => {
        if (!expiry) return false;
        return new Date(expiry) > new Date();
    };

    const daysSinceSale = scannedDevice ? Math.floor((new Date().getTime() - new Date(scannedDevice.device.received_date).getTime()) / (1000 * 3600 * 24)) : 0;

    return (
        <div className="flex flex-col h-full bg-zinc-50">
            <header className="p-6 bg-white border-b border-zinc-200 flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold text-zinc-900">Reverse Logistics</h1>
                    <p className="text-xs text-zinc-500 mt-1">RMA processing & warranty validation</p>
                </div>
            </header>

            <div className="flex-1 grid grid-cols-12 overflow-hidden">
                {/* LEFT PANEL: SCANNER */}
                <div className="col-span-4 bg-white border-r border-zinc-200 p-6 space-y-8 overflow-y-auto">
                    <section className="space-y-4">
                        <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">Scanner Input</label>
                        <div className="relative group">
                            <input
                                ref={scannerRef}
                                value={skuInput}
                                onChange={e => setSkuInput(e.target.value)}
                                onKeyDown={handleScannerKeyDown}
                                placeholder="Scan asset to initiate RMA..."
                                className="input-stark w-full py-5 font-mono text-xl tracking-widest placeholder:font-sans placeholder:text-xs placeholder:tracking-normal"
                            />
                            <Scan size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-300 group-focus-within:text-zinc-900 transition-colors" />
                        </div>
                        {errorStatus && (
                            <div className="text-[10px] font-semibold text-rose-600 uppercase tracking-widest flex items-center gap-2 px-1">
                                <AlertCircle size={14} /> {errorStatus}
                            </div>
                        )}
                    </section>
                </div>

                {/* RIGHT PANEL: DEVICE INFO & ACTION */}
                <div className="col-span-8 flex flex-col bg-zinc-50 overflow-hidden">
                    {scannedDevice ? (
                        <div className="flex-1 flex flex-col p-12 space-y-12 animate-in fade-in duration-500 overflow-y-auto">
                            <div className="bg-white border border-zinc-200 rounded-lg p-8 shadow-sm">
                                <div className="flex justify-between items-start border-b border-zinc-100 pb-8">
                                    <div>
                                        <div className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-2">Identified Asset</div>
                                        <h2 className="text-4xl font-bold text-zinc-900 tracking-tighter">
                                            {scannedDevice.device.model.brand} {scannedDevice.device.model.name}
                                        </h2>
                                        <div className="text-xs font-medium text-zinc-500 mt-2 uppercase tracking-widest">IMEI: {scannedDevice.device.imei}</div>

                                        <div className="mt-6">
                                            {daysSinceSale <= 15 ? (
                                                <span className="badge-glow badge-success">
                                                    ELIGIBLE ({15 - daysSinceSale} DAYS REMAINING)
                                                </span>
                                            ) : (
                                                <span className="badge-glow badge-error">
                                                    EXPIRED ({daysSinceSale} DAYS AGO)
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-2">Warranty Status</div>
                                        {isUnderWarranty(scannedDevice.device.warranty_expiry_date) ? (
                                            <div className="badge-glow badge-success inline-flex items-center gap-2">
                                                <ShieldCheck size={14} /> ACTIVE COVERAGE
                                            </div>
                                        ) : (
                                            <div className="badge-glow badge-error inline-flex items-center gap-2">
                                                <ShieldAlert size={14} /> EXPIRED / NO COVERAGE
                                            </div>
                                        )}
                                        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mt-2">
                                            Expires: {scannedDevice.device.warranty_expiry_date ? new Date(scannedDevice.device.warranty_expiry_date).toLocaleDateString() : 'N/A'}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-12 py-8">
                                    <div className="space-y-6">
                                        <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">Transaction Context</label>
                                        <div className="space-y-4">
                                            <div className="flex justify-between border-b border-zinc-100 pb-3">
                                                <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Entity ID</span>
                                                <span className="text-sm font-bold uppercase text-zinc-900">{scannedDevice.device.sold_to_crm_id}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-zinc-100 pb-3">
                                                <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Sale Date</span>
                                                <span className="text-sm font-bold uppercase text-zinc-900">{new Date(scannedDevice.device.received_date).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">RMA Execution</label>

                                        {daysSinceSale > 15 && (
                                            <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-100 rounded-lg mb-4">
                                                <input
                                                    type="checkbox"
                                                    id="override"
                                                    checked={overridePolicy}
                                                    onChange={e => setOverridePolicy(e.target.checked)}
                                                    className="w-4 h-4 accent-zinc-900 bg-white border-zinc-300 rounded"
                                                />
                                                <label htmlFor="override" className="text-xs font-bold uppercase tracking-widest text-rose-600 cursor-pointer">
                                                    Managerial Override Required
                                                </label>
                                            </div>
                                        )}

                                        <button
                                            onClick={handleProcessReturn}
                                            disabled={isProcessing || (daysSinceSale > 15 && !overridePolicy)}
                                            className="btn-primary w-full h-16 text-xs font-semibold uppercase tracking-[0.2em] flex items-center justify-center gap-3"
                                        >
                                            {isProcessing ? 'Synchronizing...' : (
                                                <>
                                                    <ArrowRight size={20} /> Process Return & Move to QC
                                                </>
                                            )}
                                        </button>
                                        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 text-center flex items-center justify-center gap-2">
                                            <AlertCircle size={12} /> Customer balance will be credited and asset routed to QC node.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-zinc-300 space-y-4">
                            <Package size={64} className="opacity-10" />
                            <div className="text-xs font-semibold uppercase tracking-[0.4em] opacity-40">Waiting for Asset Scan...</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
