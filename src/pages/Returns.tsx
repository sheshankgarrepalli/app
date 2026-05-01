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
            const res = await axios.get(`/api/inventory/track/${imei}`, {
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
        <div className="space-y-0">
            <div className="page-header px-6 pt-6 pb-4">
                <div>
                    <h1 className="page-title">Reverse Logistics</h1>
                    <p className="text-xs text-[#6b7280] dark:text-[#71717a] mt-1">RMA processing & warranty validation</p>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-12 overflow-hidden">
                <div className="col-span-4 bg-white dark:bg-[#141416] border-r border-[#e5e7eb] dark:border-[#1f1f21] p-6 space-y-8 overflow-y-auto">
                    <section className="space-y-4">
                        <label className="text-xs font-semibold uppercase tracking-wider text-[#6b7280] dark:text-[#71717a]">Scanner Input</label>
                        <div className="relative">
                            <input
                                ref={scannerRef}
                                value={skuInput}
                                onChange={e => setSkuInput(e.target.value)}
                                onKeyDown={handleScannerKeyDown}
                                placeholder="Scan asset to initiate RMA..."
                                className="form-input w-full py-5 font-mono text-xl tracking-widest placeholder:font-sans placeholder:text-xs placeholder:tracking-normal"
                            />
                            <Scan size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#d1d5db]" />
                        </div>
                        {errorStatus && (
                            <div className="text-xs font-semibold text-red-500 flex items-center gap-2 px-1">
                                <AlertCircle size={14} /> {errorStatus}
                            </div>
                        )}
                    </section>
                </div>

                {/* RIGHT PANEL: DEVICE INFO & ACTION */}
                <div className="col-span-8 flex flex-col bg-[#f5f5f5] dark:bg-[#0a0a0b] overflow-hidden">
                    {scannedDevice ? (
                        <div className="flex-1 flex flex-col p-12 space-y-12 overflow-y-auto">
                            <div className="card p-8">
                                <div className="flex justify-between items-start border-b border-[#e5e7eb] dark:border-[#1f1f21] pb-8">
                                    <div>
                                        <div className="text-xs font-semibold uppercase tracking-wider text-[#6b7280] dark:text-[#71717a] mb-2">Identified Asset</div>
                                        <h2 className="text-3xl font-bold text-[#1f2937] dark:text-[#e4e4e7]">
                                            {scannedDevice.device.model.brand} {scannedDevice.device.model.name}
                                        </h2>
                                        <div className="text-xs font-medium text-[#6b7280] dark:text-[#71717a] mt-2 uppercase tracking-wider">IMEI: {scannedDevice.device.imei}</div>

                                        <div className="mt-6">
                                            {daysSinceSale <= 15 ? (
                                                <span className="badge badge-success">
                                                    ELIGIBLE ({15 - daysSinceSale} DAYS REMAINING)
                                                </span>
                                            ) : (
                                                <span className="badge badge-error">
                                                    EXPIRED ({daysSinceSale} DAYS AGO)
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-semibold uppercase tracking-wider text-[#6b7280] dark:text-[#71717a] mb-2">Warranty Status</div>
                                        {isUnderWarranty(scannedDevice.device.warranty_expiry_date) ? (
                                            <div className="badge badge-success inline-flex items-center gap-2">
                                                <ShieldCheck size={14} /> ACTIVE COVERAGE
                                            </div>
                                        ) : (
                                            <div className="badge badge-error inline-flex items-center gap-2">
                                                <ShieldAlert size={14} /> EXPIRED / NO COVERAGE
                                            </div>
                                        )}
                                        <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6b7280] dark:text-[#71717a] mt-2">
                                            Expires: {scannedDevice.device.warranty_expiry_date ? new Date(scannedDevice.device.warranty_expiry_date).toLocaleDateString() : 'N/A'}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-12 py-8">
                                    <div className="space-y-6">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-[#6b7280] dark:text-[#71717a]">Transaction Context</label>
                                        <div className="space-y-4">
                                            <div className="flex justify-between border-b border-[#e5e7eb] dark:border-[#1f1f21] pb-3">
                                                <span className="text-xs font-semibold uppercase tracking-wider text-[#6b7280] dark:text-[#71717a]">Entity ID</span>
                                                <span className="text-sm font-bold uppercase text-[#1f2937] dark:text-[#e4e4e7]">{scannedDevice.device.sold_to_crm_id}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-[#e5e7eb] dark:border-[#1f1f21] pb-3">
                                                <span className="text-xs font-semibold uppercase tracking-wider text-[#6b7280] dark:text-[#71717a]">Sale Date</span>
                                                <span className="text-sm font-bold uppercase text-[#1f2937] dark:text-[#e4e4e7]">{new Date(scannedDevice.device.received_date).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-[#6b7280] dark:text-[#71717a]">RMA Execution</label>

                                        {daysSinceSale > 15 && (
                                            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-lg mb-4">
                                                <input
                                                    type="checkbox"
                                                    id="override"
                                                    checked={overridePolicy}
                                                    onChange={e => setOverridePolicy(e.target.checked)}
                                                    className="w-4 h-4 accent-accent bg-white dark:bg-[#141416] border-[#e5e7eb] dark:border-[#1f1f21] rounded"
                                                />
                                                <label htmlFor="override" className="text-xs font-bold uppercase tracking-wider text-red-500 cursor-pointer">
                                                    Managerial Override Required
                                                </label>
                                            </div>
                                        )}

                                        <button
                                            onClick={handleProcessReturn}
                                            disabled={isProcessing || (daysSinceSale > 15 && !overridePolicy)}
                                            className="btn-primary w-full h-14 text-sm font-semibold flex items-center justify-center gap-3"
                                        >
                                            {isProcessing ? 'Synchronizing...' : (
                                                <>
                                                    <ArrowRight size={20} /> Process Return & Move to QC
                                                </>
                                            )}
                                        </button>
                                        <p className="text-xs font-semibold text-[#6b7280] dark:text-[#71717a] text-center flex items-center justify-center gap-2">
                                            <AlertCircle size={12} /> Customer balance will be credited and asset routed to QC node.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-[#d1d5db] space-y-4">
                            <Package size={64} className="opacity-10" />
                            <div className="text-xs font-semibold uppercase tracking-widest">Waiting for Asset Scan...</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
