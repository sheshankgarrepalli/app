import { useState, useEffect } from 'react';
import { X, Plus, Trash2, AlertCircle } from 'lucide-react';

interface PaymentLine {
    id: string;
    method: 'Cash' | 'Credit Card' | 'Wire' | 'Store Credit' | 'On Terms' | 'Zelle';
    amount: number;
    reference_id?: string;
}

interface CheckoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    totalAmount: number;
    onComplete: (payments: PaymentLine[]) => void;
    isProcessing: boolean;
}

export default function CheckoutModal({ isOpen, onClose, totalAmount, onComplete, isProcessing }: CheckoutModalProps) {
    const [payments, setPayments] = useState<PaymentLine[]>([]);

    useEffect(() => {
        if (isOpen) {
            setPayments([{ id: Math.random().toString(), method: 'Cash', amount: parseFloat(totalAmount.toFixed(2)) }]);
        }
    }, [isOpen, totalAmount]);

    if (!isOpen) return null;

    const totalTendered = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const remainingBalance = Math.max(0, totalAmount - totalTendered);
    
    // Allow partial payments for layaway, but prevent overpayment
    const isOverpaid = totalTendered > totalAmount + 0.01;
    const isCompleteEnabled = !isOverpaid && payments.length > 0;

    const handleAddPayment = () => {
        setPayments([...payments, { id: Math.random().toString(), method: 'Credit Card', amount: parseFloat(remainingBalance.toFixed(2)) }]);
    };

    const handleRemovePayment = (id: string) => {
        setPayments(payments.filter(p => p.id !== id));
    };

    const handleUpdatePayment = (id: string, field: keyof PaymentLine, value: any) => {
        setPayments(payments.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#141416] w-full max-w-2xl border border-zinc-200 dark:border-[#1f1f21] shadow-2xl animate-in fade-in zoom-in duration-200 rounded-xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-zinc-100 dark:border-[#1a1a1c] flex justify-between items-center bg-zinc-50 dark:bg-[#0a0a0b]">
                    <div>
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-[#e4e4e7]">Checkout / Tender</h2>
                        <p className="text-xs text-zinc-500 dark:text-[#71717a] mt-1">Split payments and finalize transaction</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-zinc-400 dark:text-[#a1a1aa] hover:text-zinc-900 dark:text-[#e4e4e7] transition-colors bg-white dark:bg-[#141416] rounded-full border border-zinc-200 dark:border-[#1f1f21] shadow-sm">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    <div className="flex justify-between items-end mb-6">
                        <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 dark:text-[#71717a] mb-1">Amount Due</div>
                            <div className="text-4xl font-bold text-zinc-900 dark:text-[#e4e4e7]">${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 dark:text-[#71717a] mb-1">Remaining Balance</div>
                            <div className={`text-2xl font-bold ${remainingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                ${remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-zinc-100 dark:border-[#1a1a1c] pb-2">
                            <h3 className="text-sm font-semibold text-zinc-700 dark:text-[#e4e4e7]">Payment Methods</h3>
                            <button type="button" onClick={handleAddPayment} className="text-xs font-semibold uppercase tracking-widest text-zinc-900 dark:text-[#e4e4e7] flex items-center gap-1 hover:text-zinc-600 dark:text-[#a1a1aa] transition-colors">
                                <Plus size={14} /> Add Tender
                            </button>
                        </div>
                        
                        <div className="space-y-3">
                            {payments.map((p) => (
                                <div key={p.id} className="flex items-center gap-3 bg-zinc-50 dark:bg-[#0a0a0b] p-3 rounded-lg border border-zinc-100 dark:border-[#1a1a1c] animate-in slide-in-from-left-2">
                                    <div className="w-1/3">
                                        <select 
                                            value={p.method}
                                            onChange={(e) => handleUpdatePayment(p.id, 'method', e.target.value)}
                                            className="w-full bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#1f1f21] rounded-md py-2 px-3 text-sm font-medium focus:border-zinc-900 outline-none"
                                        >
                                            <option value="Cash">Cash</option>
                                            <option value="Credit Card">Credit Card</option>
                                            <option value="Wire">Wire</option>
                                            <option value="Store Credit">Store Credit</option>
                                            <option value="On Terms">On Terms</option>
                                            <option value="Zelle">Zelle</option>
                                        </select>
                                    </div>
                                    <div className="flex-1 relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-[#a1a1aa] font-medium">$</span>
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            value={p.amount === 0 ? '' : p.amount}
                                            onChange={(e) => handleUpdatePayment(p.id, 'amount', parseFloat(e.target.value) || 0)}
                                            className="w-full pl-8 pr-3 py-2 bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#1f1f21] rounded-md text-sm font-bold text-right focus:border-zinc-900 outline-none"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <input 
                                            type="text" 
                                            placeholder="Ref / Check # (Optional)"
                                            value={p.reference_id || ''}
                                            onChange={(e) => handleUpdatePayment(p.id, 'reference_id', e.target.value)}
                                            className="w-full px-3 py-2 bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#1f1f21] rounded-md text-sm focus:border-zinc-900 outline-none"
                                        />
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => handleRemovePayment(p.id)}
                                        className="p-2 text-zinc-400 dark:text-[#a1a1aa] hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-zinc-50 dark:bg-[#0a0a0b] border-t border-zinc-100 dark:border-[#1a1a1c] flex gap-4 items-center">
                    {isOverpaid && (
                        <div className="flex-1 flex items-center gap-2 text-rose-600 text-xs font-semibold">
                            <AlertCircle size={14} /> Total tendered exceeds amount due
                        </div>
                    )}
                    {!isOverpaid && <div className="flex-1"></div>}
                    <button type="button" onClick={onClose} className="px-6 py-3 text-sm font-semibold text-zinc-600 dark:text-[#a1a1aa] hover:text-zinc-900 dark:text-[#e4e4e7] transition-colors">
                        Cancel
                    </button>
                    <button 
                        type="button"
                        onClick={() => onComplete(payments)}
                        disabled={!isCompleteEnabled || isProcessing}
                        className="btn-primary px-8 py-3 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isProcessing 
                            ? 'Processing...' 
                            : remainingBalance > 0.01 
                                ? 'Save as Layaway' 
                                : 'Complete Sale & Release Devices'
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}
