import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Save, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface EditDeviceModalProps {
    isOpen: boolean;
    onClose: () => void;
    device: any;
    onSuccess: () => void;
}

export default function EditDeviceModal({ isOpen, onClose, device, onSuccess }: EditDeviceModalProps) {
    const { token } = useAuth();
    const [formData, setFormData] = useState({
        location_id: '',
        sub_location_bin: '',
        notes: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (device) {
            setFormData({
                location_id: device.location_id,
                sub_location_bin: device.sub_location_bin || '',
                notes: ''
            });
        }
    }, [device]);

    if (!isOpen || !device) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');
        try {
            await axios.put(`/api/inventory/${device.imei}`, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Update failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const locations = ['Warehouse_Alpha', 'Store_A', 'Store_B', 'Store_C'];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-[#141416] w-full max-w-md rounded-lg shadow-2xl border border-zinc-200 dark:border-[#1f1f21] overflow-hidden">
                <div className="p-6 border-b border-zinc-100 dark:border-[#1a1a1c] flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-[#e4e4e7] uppercase tracking-tight">Edit Asset</h2>
                        <p className="text-[10px] font-bold text-zinc-400 dark:text-[#a1a1aa] uppercase tracking-widest mt-1">IMEI: {device.imei}</p>
                    </div>
                    <button onClick={onClose} className="text-zinc-400 dark:text-[#a1a1aa] hover:text-zinc-900 dark:text-[#e4e4e7] transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#71717a] ml-1">Current Node (Location)</label>
                            <select
                                value={formData.location_id}
                                onChange={e => setFormData({ ...formData, location_id: e.target.value })}
                                className="input-stark w-full py-2.5 text-xs font-bold uppercase tracking-widest"
                                required
                            >
                                {locations.map(l => (
                                    <option key={l} value={l}>{l.replace('_', ' ')}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#71717a] ml-1">Sub-Location / Bin</label>
                            <input
                                type="text"
                                value={formData.sub_location_bin}
                                onChange={e => setFormData({ ...formData, sub_location_bin: e.target.value })}
                                placeholder="E.G. BIN-A1"
                                className="input-stark w-full py-2.5 text-xs font-bold uppercase tracking-widest"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#71717a] ml-1">Audit Notes</label>
                            <textarea
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="REASON FOR UPDATE..."
                                className="input-stark w-full py-2.5 text-xs font-bold h-20 resize-none"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-[10px] font-bold uppercase tracking-widest">
                            <AlertCircle size={14} /> {error}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary flex-1 py-3 text-[10px] font-bold uppercase tracking-widest"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="btn-primary flex-1 py-3 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? 'Synchronizing...' : (
                                <>
                                    <Save size={14} /> Commit Changes
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
