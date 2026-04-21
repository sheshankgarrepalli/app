import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { } from 'lucide-react';

export default function PartsPricing() {
    const { token } = useAuth();
    const [unpriced, setUnpriced] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [pricingData, setPricingData] = useState<{ [key: number]: string }>({});
    const [shippingFeesData, setShippingFeesData] = useState<{ [key: number]: string }>({});
    const [isProcessing, setIsProcessing] = useState<number | null>(null);

    useEffect(() => {
        fetchUnpriced();
    }, []);

    const fetchUnpriced = async () => {
        try {
            const res = await axios.get('http://localhost:8000/api/parts/unpriced', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUnpriced(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePriceUpdate = async (intakeId: number) => {
        const price = pricingData[intakeId];
        if (!price || isNaN(parseFloat(price))) return;

        setIsProcessing(intakeId);
        try {
            await axios.put('http://localhost:8000/api/parts/price', {
                intake_id: intakeId,
                total_price: parseFloat(price),
                shipping_fees: parseFloat(shippingFeesData[intakeId] || '0')
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchUnpriced();
            const newData = { ...pricingData };
            delete newData[intakeId];
            setPricingData(newData);
        } catch (err) {
            console.error(err);
            alert("Pricing failed");
        } finally {
            setIsProcessing(null);
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50">
            <header className="p-6 bg-white border-b border-zinc-200 flex justify-between items-center">
                <div>
                    <h1 className="text-lg font-bold text-zinc-900">Costing Engine</h1>
                    <p className="text-xs text-zinc-500 mt-1">Admin financial costing & MAC initialization</p>
                </div>
                <button
                    onClick={() => axios.post('http://localhost:8000/api/parts/seed', {}, { headers: { Authorization: `Bearer ${token}` } }).then(() => { alert("Mock Data Seeded"); fetchUnpriced(); })}
                    className="text-xs font-semibold uppercase tracking-widest text-zinc-400 hover:text-zinc-900 transition-colors"
                >
                    Seed Mock Data
                </button>
            </header>

            <div className="flex-1 overflow-auto p-6">
                <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse table-fixed">
                        <thead className="bg-zinc-50/50 border-b border-zinc-200">
                            <tr className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">
                                <th className="px-8 py-4 w-32">Intake Date</th>
                                <th className="px-8 py-4 w-48">SKU Identifier</th>
                                <th className="px-8 py-4 text-center w-20">Qty</th>
                                <th className="px-8 py-4 text-right w-40">Invoice Total</th>
                                <th className="px-8 py-4 text-right w-40">Logistics Fees</th>
                                <th className="px-8 py-4 text-right w-32">Unit Cost</th>
                                <th className="px-8 py-4 text-right w-32">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {isLoading ? (
                                <tr><td colSpan={7} className="py-32 text-center text-zinc-400 animate-pulse font-medium">Loading Unpriced Intakes...</td></tr>
                            ) : unpriced.length === 0 ? (
                                <tr><td colSpan={7} className="py-32 text-center text-zinc-300 font-semibold uppercase tracking-widest">All intakes reconciled</td></tr>
                            ) : unpriced.map(intake => (
                                <tr key={intake.id} className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors group">
                                    <td className="px-8 py-5 text-zinc-500 font-medium uppercase tracking-widest">{new Date(intake.created_at).toLocaleDateString()}</td>
                                    <td className="px-8 py-5 font-mono text-zinc-900 font-bold tracking-widest uppercase text-xs">{intake.sku}</td>
                                    <td className="px-8 py-5 text-center text-zinc-900 font-bold">{intake.qty}</td>
                                    <td className="px-8 py-5 text-right">
                                        <div className="flex justify-end items-center gap-2">
                                            <span className="text-zinc-400 text-xs">$</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={pricingData[intake.id] || ''}
                                                onChange={e => setPricingData({ ...pricingData, [intake.id]: e.target.value })}
                                                placeholder="0.00"
                                                className="w-24 bg-transparent border-b border-zinc-900 outline-none text-right font-bold text-zinc-900 text-sm py-0.5"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <div className="flex justify-end items-center gap-2">
                                            <span className="text-zinc-400 text-xs">$</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={shippingFeesData[intake.id] || ''}
                                                onChange={e => setShippingFeesData({ ...shippingFeesData, [intake.id]: e.target.value })}
                                                placeholder="0.00"
                                                className="w-24 bg-transparent border-b border-zinc-900 outline-none text-right font-bold text-zinc-900 text-sm py-0.5"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-right text-zinc-500 font-semibold">
                                        {pricingData[intake.id] ? `$${((parseFloat(pricingData[intake.id]) + parseFloat(shippingFeesData[intake.id] || '0')) / intake.qty).toFixed(2)}` : '-'}
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <button
                                            onClick={() => handlePriceUpdate(intake.id)}
                                            disabled={isProcessing === intake.id || !pricingData[intake.id]}
                                            className="btn-primary px-4 py-2 text-xs uppercase tracking-widest"
                                        >
                                            {isProcessing === intake.id ? '...' : 'Reconcile'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
