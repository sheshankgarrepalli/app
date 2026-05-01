import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Shield, Mail, Store, Key } from 'lucide-react';

export default function UserManagement() {
    const { token } = useAuth();
    const [users, setUsers] = useState<any[]>([]);
    const [stores, setStores] = useState<any[]>([]);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('technician');
    const [storeId, setStoreId] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const fetchData = async () => {
        try {
            const [uRes, sRes] = await Promise.all([
                axios.get((import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
                axios.get((import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/admin/stores', { headers: { Authorization: `Bearer ${token}` } })
            ]);
            setUsers(uRes.data);
            setStores(sRes.data);
            if (sRes.data.length > 0) setStoreId(sRes.data[0].id);
        } catch (err) {
            console.error("Fetch error:", err);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await axios.post((import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/admin/users', {
                email, password, role, store_id: storeId
            }, { headers: { Authorization: `Bearer ${token}` } });
            setEmail(''); setPassword('');
            fetchData();
            alert("User created successfully");
        } catch (err: any) {
            alert(err.response?.data?.detail || "Error creating user");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-12">
            <header>
                <h1 className="text-xl font-bold text-zinc-900 dark:text-[#e4e4e7] mb-1">Identity & Access</h1>
                <p className="text-xs text-zinc-500 dark:text-[#71717a] mt-1">Manage employee credentials and store assignments</p>
            </header>

            <div className="grid grid-cols-12 gap-12">
                {/* CREATE USER FORM */}
                <div className="col-span-12 lg:col-span-4">
                    <form onSubmit={handleCreateUser} className="space-y-6 border border-zinc-200 dark:border-[#1f1f21] p-8 bg-white dark:bg-[#141416] rounded-lg shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <UserPlus size={18} className="text-zinc-400 dark:text-[#a1a1aa]" />
                            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-[#71717a]">Provision New User</h2>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-[#a1a1aa] ml-1">Email Address</label>
                                <div className="relative group">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300 dark:text-[#52525b] group-focus-within:text-zinc-900 dark:text-[#e4e4e7] transition-colors" size={14} />
                                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="input-stark w-full pl-10 py-3" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-[#a1a1aa] ml-1">Temporary Password</label>
                                <div className="relative group">
                                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300 dark:text-[#52525b] group-focus-within:text-zinc-900 dark:text-[#e4e4e7] transition-colors" size={14} />
                                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="input-stark w-full pl-10 py-3" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-[#a1a1aa] ml-1">System Role</label>
                                    <select value={role} onChange={e => setRole(e.target.value)} className="input-stark w-full py-3 text-xs font-bold uppercase tracking-widest">
                                        <option value="admin">ADMIN</option>
                                        <option value="technician">TECHNICIAN</option>
                                        <option value="qc">QC SPECIALIST</option>
                                        <option value="floor_manager">FLOOR MANAGER</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-[#a1a1aa] ml-1">Assignment</label>
                                    <select value={storeId} onChange={e => setStoreId(e.target.value)} className="input-stark w-full py-3 text-xs font-bold uppercase tracking-widest">
                                        {stores.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <button type="submit" disabled={isLoading} className="btn-primary w-full py-4 text-xs font-semibold uppercase tracking-[0.2em]">
                            {isLoading ? 'Provisioning...' : 'Create User Account'}
                        </button>
                    </form>
                </div>

                {/* USER LIST */}
                <div className="col-span-12 lg:col-span-8">
                    <div className="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#1f1f21] rounded-lg shadow-sm overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-zinc-50 dark:bg-[#0a0a0b]/50 border-b border-zinc-200 dark:border-[#1f1f21]">
                                <tr className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 dark:text-[#71717a]">
                                    <th className="px-8 py-4">Employee Email</th>
                                    <th className="px-8 py-4">System Role</th>
                                    <th className="px-8 py-4">Store Assignment</th>
                                    <th className="px-8 py-4 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {users.map(u => (
                                    <tr key={u.id} className="border-b border-zinc-100 dark:border-[#1a1a1c] hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] dark:bg-[#0a0a0b]/50 transition-colors">
                                        <td className="px-8 py-5 text-zinc-900 dark:text-[#e4e4e7] font-semibold">{u.email}</td>
                                        <td className="px-8 py-5">
                                            <span className="flex items-center gap-2 text-zinc-500 dark:text-[#71717a] uppercase tracking-widest text-[10px] font-bold">
                                                <Shield size={12} className="text-zinc-300 dark:text-[#52525b]" />
                                                {u.role.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="flex items-center gap-2 text-zinc-500 dark:text-[#71717a] uppercase tracking-widest text-[10px] font-bold">
                                                <Store size={12} className="text-zinc-300 dark:text-[#52525b]" />
                                                {u.store_id || 'GLOBAL'}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <span className="badge-glow badge-success">Active</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
