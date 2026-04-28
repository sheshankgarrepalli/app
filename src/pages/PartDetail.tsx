import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Edit2, X, Plus, RefreshCw, AlertTriangle } from 'lucide-react';

export default function PartDetail() {
    const { sku } = useParams<{ sku: string }>();
    const navigate = useNavigate();
    const { token } = useAuth();
    const API = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000');

    const [part, setPart] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    // Edit mode
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editThreshold, setEditThreshold] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Intake form
    const [showIntake, setShowIntake] = useState(false);
    const [intakeForm, setIntakeForm] = useState({ qty: '', total_price: '', shipping_fees: '0', supplier_id: '' });
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [isIntakeSubmitting, setIsIntakeSubmitting] = useState(false);

    // Return form
    const [showReturn, setShowReturn] = useState(false);
    const [returnForm, setReturnForm] = useState({ qty: '', reason: '' });
    const [isReturnSubmitting, setIsReturnSubmitting] = useState(false);

    // Adjust form
    const [showAdjust, setShowAdjust] = useState(false);
    const [adjustForm, setAdjustForm] = useState({ new_qty: '', reason: '' });
    const [isAdjustSubmitting, setIsAdjustSubmitting] = useState(false);

    // Feedback
    const [feedback, setFeedback] = useState('');

    useEffect(() => { fetchPart(); fetchSuppliers(); }, [sku]);

    const fetchPart = async () => {
        try {
            const res = await axios.get(`${API}/api/parts/${sku}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPart(res.data);
        } catch (err: any) {
            setError(err.response?.status === 404 ? 'Part not found' : 'Failed to load part');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSuppliers = async () => {
        try {
            const res = await axios.get(`${API}/api/parts/suppliers`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSuppliers(res.data);
        } catch (_) {}
    };

    const showFeedback = (msg: string) => { setFeedback(msg); setTimeout(() => setFeedback(''), 3000); };

    // Edit
    const startEditing = () => {
        setEditName(part.part_name);
        setEditThreshold(String(part.low_stock_threshold));
        setIsEditing(true);
    };
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await axios.put(`${API}/api/parts/${sku}`, {
                part_name: editName,
                low_stock_threshold: parseInt(editThreshold)
            }, { headers: { Authorization: `Bearer ${token}` } });
            setPart(res.data);
            setIsEditing(false);
            showFeedback('Part updated');
        } catch (_) {} finally { setIsSaving(false); }
    };

    // Intake
    const handleIntake = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsIntakeSubmitting(true);
        try {
            const res = await axios.post(`${API}/api/parts/${sku}/intake`, {
                qty: parseInt(intakeForm.qty),
                total_price: parseFloat(intakeForm.total_price),
                shipping_fees: parseFloat(intakeForm.shipping_fees),
                supplier_id: parseInt(intakeForm.supplier_id)
            }, { headers: { Authorization: `Bearer ${token}` } });
            setPart(res.data);
            setShowIntake(false);
            setIntakeForm({ qty: '', total_price: '', shipping_fees: '0', supplier_id: '' });
            showFeedback('Stock received');
            fetchPart();
        } catch (_) {} finally { setIsIntakeSubmitting(false); }
    };

    // Return
    const handleReturn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (parseInt(returnForm.qty) > part.current_stock_qty) return;
        setIsReturnSubmitting(true);
        try {
            const res = await axios.post(`${API}/api/parts/${sku}/return`, {
                qty: parseInt(returnForm.qty),
                reason: returnForm.reason
            }, { headers: { Authorization: `Bearer ${token}` } });
            setPart(res.data);
            setShowReturn(false);
            setReturnForm({ qty: '', reason: '' });
            showFeedback('Return processed');
            fetchPart();
        } catch (_) {} finally { setIsReturnSubmitting(false); }
    };

    // Adjust
    const handleAdjust = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsAdjustSubmitting(true);
        try {
            const res = await axios.post(`${API}/api/parts/${sku}/adjust`, {
                new_qty: parseInt(adjustForm.new_qty),
                reason: adjustForm.reason
            }, { headers: { Authorization: `Bearer ${token}` } });
            setPart(res.data);
            setShowAdjust(false);
            setAdjustForm({ new_qty: '', reason: '' });
            showFeedback('Stock adjusted');
            fetchPart();
        } catch (_) {} finally { setIsAdjustSubmitting(false); }
    };

    if (isLoading) {
        return <div className="flex h-full items-center justify-center"><div className="animate-pulse text-zinc-400 text-xs font-black uppercase tracking-widest">Loading part...</div></div>;
    }
    if (error) {
        return (
            <div className="flex flex-col h-full items-center justify-center gap-4">
                <p className="text-zinc-500 font-semibold">{error}</p>
                <button onClick={() => navigate(-1)} className="btn-primary px-6 py-2 text-xs uppercase tracking-widest">Go Back</button>
            </div>
        );
    }

    const isLowStock = part.current_stock_qty <= part.low_stock_threshold;

    return (
        <div className="flex flex-col h-full bg-zinc-50 relative">
            {/* Feedback toast */}
            {feedback && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest shadow-lg animate-in fade-in slide-in-from-top-2">
                    {feedback}
                </div>
            )}

            <header className="p-6 bg-white border-b border-zinc-200">
                <div className="flex items-center gap-4 mb-4">
                    <button onClick={() => navigate(-1)} className="text-zinc-400 hover:text-zinc-900 transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-zinc-900 font-mono tracking-widest">{part.sku}</h1>
                        <p className="text-xs text-zinc-500 mt-0.5">Part detail and inventory actions</p>
                    </div>
                </div>

                {/* Metrics row */}
                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400 mb-1">In Stock</p>
                        <p className={`text-2xl font-bold ${isLowStock ? 'text-red-600' : 'text-zinc-900'}`}>
                            {part.current_stock_qty}
                        </p>
                    </div>
                    <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400 mb-1">MAC (Cost)</p>
                        <p className="text-2xl font-bold text-zinc-900">${part.moving_average_cost.toFixed(2)}</p>
                    </div>
                    <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400 mb-1">Total Valuation</p>
                        <p className="text-2xl font-bold text-zinc-900">${part.total_valuation.toFixed(2)}</p>
                    </div>
                    <div className={`border rounded-lg p-4 flex items-center gap-3 ${isLowStock ? 'bg-red-50 border-red-200' : 'bg-zinc-50 border-zinc-200'}`}>
                        {isLowStock && <AlertTriangle size={20} className="text-red-500" />}
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400 mb-1">Low-Stock Threshold</p>
                            <p className="text-lg font-bold text-zinc-900">{part.low_stock_threshold}</p>
                        </div>
                    </div>
                </div>

                {/* Edit metadata toggle */}
                <div className="flex items-center gap-2 mt-4">
                    {isEditing ? (
                        <div className="flex items-center gap-3 flex-wrap">
                            <input
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                className="input-stark py-2 px-3 text-sm font-bold w-64"
                            />
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-500 uppercase tracking-widest">Threshold:</span>
                                <input
                                    type="number"
                                    value={editThreshold}
                                    onChange={e => setEditThreshold(e.target.value)}
                                    className="input-stark py-2 px-3 w-20 text-sm font-bold"
                                />
                            </div>
                            <button onClick={handleSave} disabled={isSaving} className="btn-primary px-4 py-2 text-xs uppercase tracking-widest">
                                {isSaving ? 'Saving...' : 'Save'}
                            </button>
                            <button onClick={() => setIsEditing(false)} className="text-zinc-400 hover:text-zinc-900"><X size={18} /></button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-zinc-700 font-semibold uppercase tracking-wider">{part.part_name}</span>
                            <button onClick={startEditing} className="text-zinc-400 hover:text-zinc-900"><Edit2 size={14} /></button>
                        </div>
                    )}
                </div>
            </header>

            {/* Action toolbar */}
            <div className="px-6 py-3 bg-white border-b border-zinc-100 flex items-center gap-3">
                <button onClick={() => setShowIntake(true)} className="btn-primary flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-widest">
                    <Plus size={14} /> Receive Stock
                </button>
                <button onClick={() => setShowReturn(true)} disabled={part.current_stock_qty === 0}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-widest border border-zinc-300 rounded-lg text-zinc-600 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed">
                    Return to Supplier
                </button>
                <button onClick={() => setShowAdjust(true)}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-widest border border-zinc-300 rounded-lg text-zinc-600 hover:bg-zinc-50">
                    <RefreshCw size={14} /> Adjust Stock
                </button>
            </div>

            {/* Intake history */}
            <div className="flex-1 overflow-auto p-6">
                <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-zinc-50/50 border-b border-zinc-200">
                            <tr className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3 text-center">Qty</th>
                                <th className="px-6 py-3 text-right">Total Price</th>
                                <th className="px-6 py-3 text-right">Unit Cost</th>
                                <th className="px-6 py-3 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {!part.intakes || part.intakes.length === 0 ? (
                                <tr><td colSpan={5} className="py-24 text-center text-zinc-300 font-semibold uppercase tracking-widest">No intake history</td></tr>
                            ) : part.intakes.map((i: any) => (
                                <tr key={i.id} className="border-b border-zinc-100">
                                    <td className="px-6 py-4 text-zinc-500 font-medium uppercase tracking-wider text-xs">{new Date(i.created_at).toLocaleDateString()}</td>
                                    <td className={`px-6 py-4 text-center font-bold ${i.qty < 0 ? 'text-red-600' : 'text-zinc-900'}`}>{i.qty}</td>
                                    <td className="px-6 py-4 text-right text-zinc-500">${(i.total_price || 0).toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right text-zinc-500">${i.qty !== 0 ? ((i.total_price || 0) / Math.abs(i.qty)).toFixed(2) : '0.00'}</td>
                                    <td className="px-6 py-4 text-center">
                                        {i.is_priced ? <span className="badge-glow badge-neutral">Priced</span> : <span className="badge-glow badge-error">Unpriced</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Intake Modal */}
            {showIntake && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 w-full max-w-md p-8">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-widest">Receive Stock — {sku}</h2>
                            <button onClick={() => setShowIntake(false)} className="text-zinc-400 hover:text-zinc-900"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleIntake} className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">Supplier</label>
                                <select
                                    required value={intakeForm.supplier_id}
                                    onChange={e => setIntakeForm({ ...intakeForm, supplier_id: e.target.value })}
                                    className="input-stark w-full py-3 text-xs font-bold mt-1"
                                >
                                    <option value="">Select supplier...</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">Quantity</label>
                                    <input type="number" required value={intakeForm.qty}
                                        onChange={e => setIntakeForm({ ...intakeForm, qty: e.target.value })}
                                        className="input-stark w-full py-3 text-sm font-bold mt-1" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">Total Price ($)</label>
                                    <input type="number" step="0.01" required value={intakeForm.total_price}
                                        onChange={e => setIntakeForm({ ...intakeForm, total_price: e.target.value })}
                                        className="input-stark w-full py-3 text-sm font-bold mt-1" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">Shipping Fees ($)</label>
                                <input type="number" step="0.01" value={intakeForm.shipping_fees}
                                    onChange={e => setIntakeForm({ ...intakeForm, shipping_fees: e.target.value })}
                                    className="input-stark w-full py-3 text-sm font-bold mt-1" />
                            </div>
                            <button disabled={isIntakeSubmitting} className="btn-primary w-full py-3 text-xs font-semibold uppercase tracking-[0.2em]">
                                {isIntakeSubmitting ? 'Processing...' : 'Receive Stock'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Return Modal */}
            {showReturn && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 w-full max-w-md p-8">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-widest">Return to Supplier</h2>
                            <button onClick={() => setShowReturn(false)} className="text-zinc-400 hover:text-zinc-900"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleReturn} className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">Quantity to Return (max {part.current_stock_qty})</label>
                                <input type="number" required value={returnForm.qty}
                                    onChange={e => setReturnForm({ ...returnForm, qty: e.target.value })}
                                    max={part.current_stock_qty}
                                    className="input-stark w-full py-3 text-sm font-bold mt-1" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">Reason</label>
                                <input type="text" value={returnForm.reason}
                                    onChange={e => setReturnForm({ ...returnForm, reason: e.target.value })}
                                    placeholder="Defective, wrong part, etc."
                                    className="input-stark w-full py-3 text-sm font-bold mt-1" />
                            </div>
                            <button disabled={isReturnSubmitting} className="btn-primary w-full py-3 text-xs font-semibold uppercase tracking-[0.2em]">
                                {isReturnSubmitting ? 'Processing...' : 'Confirm Return'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Adjust Modal */}
            {showAdjust && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 w-full max-w-md p-8">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-widest">Manual Stock Adjustment</h2>
                            <button onClick={() => setShowAdjust(false)} className="text-zinc-400 hover:text-zinc-900"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleAdjust} className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">New Stock Count (current: {part.current_stock_qty})</label>
                                <input type="number" required value={adjustForm.new_qty} min="0"
                                    onChange={e => setAdjustForm({ ...adjustForm, new_qty: e.target.value })}
                                    className="input-stark w-full py-3 text-sm font-bold mt-1" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">Reason</label>
                                <input type="text" value={adjustForm.reason}
                                    onChange={e => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                                    placeholder="Physical count reconciliation"
                                    className="input-stark w-full py-3 text-sm font-bold mt-1" />
                            </div>
                            <button disabled={isAdjustSubmitting} className="btn-primary w-full py-3 text-xs font-semibold uppercase tracking-[0.2em]">
                                {isAdjustSubmitting ? 'Processing...' : 'Adjust Stock'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
