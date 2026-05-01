import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { X, DollarSign, AlertCircle } from 'lucide-react';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoice: any;
    onSuccess: () => void;
}

export default function PaymentModal({ isOpen, onClose, invoice, onSuccess }: PaymentModalProps) {
    const { token } = useAuth();
    const [amount, setAmount] = useState<string>(invoice.total.toString());
    const [method, setMethod] = useState('Cash');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        setError(null);

        try {
            await axios.post(`/api/pos/invoices/${invoice.invoice_number}/pay`, {
                amount_paid: parseFloat(amount),
                payment_method: method
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            onSuccess();
        } catch (err: any) {
            setError(err.response?.data?.detail || "Payment failed");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#141416] w-full max-w-md border border-gray-100 dark:border-[#1f1f21] shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="p-8 border-b border-gray-50 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-black uppercase tracking-[0.2em] text-gray-900 dark:text-[#e4e4e7]">Log Payment</h2>
                        <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mt-1">Invoice: {invoice.invoice_number}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-300 hover:text-gray-900 dark:text-[#e4e4e7] transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-8">
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 block">Payment Amount</label>
                        <div className="relative">
                            <DollarSign size={16} className="absolute left-4 top-4 text-gray-300" />
                            <input
                                type="number"
                                step="0.01"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                className="w-full pl-10 pr-4 py-4 border border-gray-100 dark:border-[#1f1f21] rounded-none outline-none focus:border-gray-900 transition text-xl font-black tracking-tight"
                                required
                            />
                        </div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-gray-300 flex justify-between">
                            <span>Total Due: ${invoice.total.toLocaleString()}</span>
                            <span>Remaining: ${(invoice.total - parseFloat(amount || '0')).toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 block">Payment Method</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['Cash', 'Card', 'Wire'].map(m => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => setMethod(m)}
                                    className={`py-3 text-[9px] font-black uppercase tracking-widest border transition-all ${method === m ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white dark:bg-[#141416] border-gray-100 dark:border-[#1f1f21] text-gray-400 hover:border-gray-200'}`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                            <AlertCircle size={14} /> {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isProcessing}
                        className="w-full py-5 bg-gray-900 text-white font-black text-xs uppercase tracking-[0.3em] hover:bg-black transition-all disabled:bg-gray-100 disabled:text-gray-300"
                    >
                        {isProcessing ? 'PROCESSING...' : 'Confirm Payment'}
                    </button>
                </form>
            </div>
        </div>
    );
}
