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
        return <div className="flex h-full items-center justify-center"><div className="text-[#6b7280] dark:text-[#71717a] text-xs font-bold">Loading part...</div></div>;
    }
    if (error) {
        return (
            <div className="flex flex-col h-full items-center justify-center gap-4">
                <p className="text-[#6b7280] dark:text-[#71717a] font-semibold">{error}</p>
                <button onClick={() => navigate(-1)} className="btn-primary">Go Back</button>
            </div>
        );
    }

    const isLowStock = part.current_stock_qty <= part.low_stock_threshold;

    return (
        <div className="space-y-4">
            {feedback && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-navy text-white px-6 py-2.5 rounded-lg text-xs font-bold shadow-lg">
                    {feedback}
                </div>
            )}

            <div className="card p-6 space-y-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="text-[#9ca3af] dark:text-[#52525b] hover:text-[#1f2937] dark:text-[#e4e4e7] transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-[#1f2937] dark:text-[#e4e4e7] font-mono">{part.sku}</h1>
                        <p className="text-xs text-[#6b7280] dark:text-[#71717a] mt-0.5">Part detail and inventory actions</p>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                    <div className="kpi-card">
                        <p className="kpi-label">In Stock</p>
                        <p className={`text-2xl font-bold ${isLowStock ? 'text-red-500' : 'text-[#1f2937] dark:text-[#e4e4e7]'}`}>
                            {part.current_stock_qty}
                        </p>
                    </div>
                    <div className="kpi-card">
                        <p className="kpi-label">MAC (Cost)</p>
                        <p className="text-2xl font-bold text-[#1f2937] dark:text-[#e4e4e7]">${part.moving_average_cost.toFixed(2)}</p>
                    </div>
                    <div className="kpi-card">
                        <p className="kpi-label">Total Valuation</p>
                        <p className="text-2xl font-bold text-[#1f2937] dark:text-[#e4e4e7]">${part.total_valuation.toFixed(2)}</p>
                    </div>
                    <div className={`kpi-card ${isLowStock ? 'border border-red-200' : ''}`}>
                        {isLowStock && <AlertTriangle size={20} className="text-red-500" />}
                        <p className="kpi-label">Low-Stock Threshold</p>
                        <p className="text-lg font-bold text-[#1f2937] dark:text-[#e4e4e7]">{part.low_stock_threshold}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {isEditing ? (
                        <div className="flex items-center gap-3 flex-wrap">
                            <input
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                className="form-input py-2 px-3 text-sm font-bold w-64"
                            />
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-[#6b7280] dark:text-[#71717a]">Threshold:</span>
                                <input
                                    type="number"
                                    value={editThreshold}
                                    onChange={e => setEditThreshold(e.target.value)}
                                    className="form-input py-2 px-3 w-20 text-sm font-bold"
                                />
                            </div>
                            <button onClick={handleSave} disabled={isSaving} className="btn-primary text-xs">
                                {isSaving ? 'Saving...' : 'Save'}
                            </button>
                            <button onClick={() => setIsEditing(false)} className="text-[#9ca3af] dark:text-[#52525b] hover:text-[#1f2937] dark:text-[#e4e4e7]"><X size={18} /></button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-[#1f2937] dark:text-[#e4e4e7] font-semibold">{part.part_name}</span>
                            <button onClick={startEditing} className="text-[#9ca3af] dark:text-[#52525b] hover:text-[#1f2937] dark:text-[#e4e4e7]"><Edit2 size={14} /></button>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-3 px-2">
                <button onClick={() => setShowIntake(true)} className="btn-primary">
                    <Plus size={14} /> Receive Stock
                </button>
                <button onClick={() => setShowReturn(true)} disabled={part.current_stock_qty === 0}
                    className="btn-secondary">
                    Return to Supplier
                </button>
                <button onClick={() => setShowAdjust(true)}
                    className="btn-secondary">
                    <RefreshCw size={14} /> Adjust Stock
                </button>
            </div>

            <div className="card overflow-hidden">
                <table className="table-standard">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th className="text-center">Qty</th>
                            <th className="text-right">Total Price</th>
                            <th className="text-right">Unit Cost</th>
                            <th className="text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!part.intakes || part.intakes.length === 0 ? (
                            <tr><td colSpan={5} className="py-24 text-center text-[#9ca3af] dark:text-[#52525b]">No intake history</td></tr>
                        ) : part.intakes.map((i: any) => (
                            <tr key={i.id}>
                                <td className="text-[#6b7280] dark:text-[#71717a] text-xs">{new Date(i.created_at).toLocaleDateString()}</td>
                                <td className={`text-center font-bold ${i.qty < 0 ? 'text-red-500' : 'text-[#1f2937] dark:text-[#e4e4e7]'}`}>{i.qty}</td>
                                <td className="text-right text-[#6b7280] dark:text-[#71717a]">${(i.total_price || 0).toFixed(2)}</td>
                                <td className="text-right text-[#6b7280] dark:text-[#71717a]">${i.qty !== 0 ? ((i.total_price || 0) / Math.abs(i.qty)).toFixed(2) : '0.00'}</td>
                                <td className="text-center">
                                    {i.is_priced ? <span className="badge badge-neutral">Priced</span> : <span className="badge badge-error">Unpriced</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showIntake && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h2>Receive Stock — {sku}</h2>
                            <button onClick={() => setShowIntake(false)} className="text-[#9ca3af] dark:text-[#52525b] hover:text-[#1f2937] dark:text-[#e4e4e7]"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleIntake}>
                            <div className="modal-body space-y-4">
                                <div className="form-group">
                                    <label className="form-label">Supplier</label>
                                    <select
                                        required value={intakeForm.supplier_id}
                                        onChange={e => setIntakeForm({ ...intakeForm, supplier_id: e.target.value })}
                                        className="form-select"
                                    >
                                        <option value="">Select supplier...</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="form-group">
                                        <label className="form-label">Quantity</label>
                                        <input type="number" required value={intakeForm.qty}
                                            onChange={e => setIntakeForm({ ...intakeForm, qty: e.target.value })}
                                            className="form-input" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Total Price ($)</label>
                                        <input type="number" step="0.01" required value={intakeForm.total_price}
                                            onChange={e => setIntakeForm({ ...intakeForm, total_price: e.target.value })}
                                            className="form-input" />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Shipping Fees ($)</label>
                                    <input type="number" step="0.01" value={intakeForm.shipping_fees}
                                        onChange={e => setIntakeForm({ ...intakeForm, shipping_fees: e.target.value })}
                                        className="form-input" />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" onClick={() => setShowIntake(false)} className="btn-secondary">Cancel</button>
                                <button disabled={isIntakeSubmitting} className="btn-primary">
                                    {isIntakeSubmitting ? 'Processing...' : 'Receive Stock'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showReturn && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h2>Return to Supplier</h2>
                            <button onClick={() => setShowReturn(false)} className="text-[#9ca3af] dark:text-[#52525b] hover:text-[#1f2937] dark:text-[#e4e4e7]"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleReturn}>
                            <div className="modal-body space-y-4">
                                <div className="form-group">
                                    <label className="form-label">Quantity to Return (max {part.current_stock_qty})</label>
                                    <input type="number" required value={returnForm.qty}
                                        onChange={e => setReturnForm({ ...returnForm, qty: e.target.value })}
                                        max={part.current_stock_qty}
                                        className="form-input" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Reason</label>
                                    <input type="text" value={returnForm.reason}
                                        onChange={e => setReturnForm({ ...returnForm, reason: e.target.value })}
                                        placeholder="Defective, wrong part, etc."
                                        className="form-input" />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" onClick={() => setShowReturn(false)} className="btn-secondary">Cancel</button>
                                <button disabled={isReturnSubmitting} className="btn-primary">
                                    {isReturnSubmitting ? 'Processing...' : 'Confirm Return'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showAdjust && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h2>Manual Stock Adjustment</h2>
                            <button onClick={() => setShowAdjust(false)} className="text-[#9ca3af] dark:text-[#52525b] hover:text-[#1f2937] dark:text-[#e4e4e7]"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleAdjust}>
                            <div className="modal-body space-y-4">
                                <div className="form-group">
                                    <label className="form-label">New Stock Count (current: {part.current_stock_qty})</label>
                                    <input type="number" required value={adjustForm.new_qty} min="0"
                                        onChange={e => setAdjustForm({ ...adjustForm, new_qty: e.target.value })}
                                        className="form-input" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Reason</label>
                                    <input type="text" value={adjustForm.reason}
                                        onChange={e => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                                        placeholder="Physical count reconciliation"
                                        className="form-input" />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" onClick={() => setShowAdjust(false)} className="btn-secondary">Cancel</button>
                                <button disabled={isAdjustSubmitting} className="btn-primary">
                                    {isAdjustSubmitting ? 'Processing...' : 'Adjust Stock'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
