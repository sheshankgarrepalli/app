import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  Search, Plus, X, Package, CheckCircle2,
  Cpu, DollarSign, Factory, Wrench, TrendingUp
} from 'lucide-react';

const TABS = [
  { id: 'ledger', label: 'Parts Ledger', icon: Cpu },
  { id: 'intake', label: 'Intake', icon: Package },
  { id: 'costing', label: 'Costing', icon: DollarSign },
  { id: 'suppliers', label: 'Suppliers', icon: Factory },
  { id: 'labor', label: 'Labor Rates', icon: Wrench },
];

const CATEGORIES = ['Screen', 'Battery', 'Charge Port', 'Camera', 'Back Glass', 'Speaker'];
const QUALITIES = ['OEM', 'Aftermarket', 'Premium'];

export default function InventoryManager() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const API = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000');
  const [activeTab, setActiveTab] = useState('ledger');

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory Manager</h1>
          <p className="text-xs text-[#6b7280] dark:text-[#71717a] mt-1">Parts, suppliers, labor rates & intake</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white dark:bg-[#141416] rounded-lg p-1 border border-[#e5e7eb] dark:border-[#1f1f21]">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-accent text-white shadow-sm'
                : 'text-[#6b7280] dark:text-[#71717a] hover:text-[#1f2937] dark:hover:text-[#e4e4e7]'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'ledger' && <PartsLedger API={API} token={token!} navigate={navigate} />}
      {activeTab === 'intake' && <IntakePanel API={API} token={token!} />}
      {activeTab === 'costing' && <CostingPanel API={API} token={token!} />}
      {activeTab === 'suppliers' && <SuppliersPanel API={API} token={token!} />}
      {activeTab === 'labor' && <LaborPanel API={API} token={token!} />}
    </div>
  );
}

function PartsLedger({ API, token, navigate }: { API: string; token: string; navigate: any }) {
  const [parts, setParts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchParts(); }, []);

  const fetchParts = async () => {
    try {
      const res = await axios.get(`${API}/api/parts/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParts(res.data);
    } catch (_) {} finally {
      setIsLoading(false);
    }
  };

  const filtered = parts.filter(p =>
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.part_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalValuation = parts.reduce((sum, p) => sum + (p.current_stock_qty * p.moving_average_cost), 0);
  const lowStockCount = parts.filter(p => p.current_stock_qty <= p.low_stock_threshold).length;

  return (
    <div className="space-y-4">
      {/* KPI bento row */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl p-4">
          <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] font-semibold uppercase tracking-wider mb-1">Total SKUs</div>
          <div className="text-2xl font-bold text-[#1f2937] dark:text-[#e4e4e7]">{parts.length}</div>
          <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] mt-1">Active components</div>
        </div>
        <div className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl p-4">
          <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] font-semibold uppercase tracking-wider mb-1">Inventory Value</div>
          <div className="text-2xl font-bold text-[#1f2937] dark:text-[#e4e4e7]">${totalValuation.toLocaleString()}</div>
          <div className="text-[11px] text-emerald-500 mt-1 flex items-center gap-1">
            <TrendingUp size={12} /> MAC-based valuation
          </div>
        </div>
        <div className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl p-4">
          <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] font-semibold uppercase tracking-wider mb-1">Low Stock</div>
          <div className="text-2xl font-bold text-amber-400">{lowStockCount}</div>
          <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] mt-1">Below threshold</div>
        </div>
        <div className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl p-4">
          <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] font-semibold uppercase tracking-wider mb-1">Throughput</div>
          <div className="text-2xl font-bold text-[#1f2937] dark:text-[#e4e4e7]">
            {parts.reduce((sum, p) => sum + p.current_stock_qty, 0)}
          </div>
          <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] mt-1">Total units on hand</div>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af] dark:text-[#52525b]" />
        <input
          type="text"
          placeholder="Search by SKU or part name..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-lg pl-9 pr-4 py-2.5 text-sm text-[#1f2937] dark:text-[#e4e4e7] placeholder-[#9ca3af] dark:placeholder-[#52525b] focus:outline-none focus:border-accent/50 transition-colors"
        />
      </div>

      {/* Parts table */}
      <div className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-[#6b7280] dark:text-[#71717a] border-b border-[#e5e7eb] dark:border-[#1f1f21]">
              <th className="px-5 py-3">SKU</th>
              <th className="px-5 py-3">Component</th>
              <th className="px-5 py-3 text-center">Stock</th>
              <th className="px-5 py-3 text-right">MAC</th>
              <th className="px-5 py-3 text-right">Valuation</th>
              <th className="px-5 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {isLoading ? (
              <tr><td colSpan={6} className="py-24 text-center text-[#9ca3af] dark:text-[#52525b]">Loading ledger...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="py-24 text-center text-[#9ca3af] dark:text-[#52525b]">No parts found</td></tr>
            ) : filtered.map(part => (
              <tr
                key={part.sku}
                onClick={() => navigate(`/admin/parts/${part.sku}`)}
                className="border-b border-[#e5e7eb] dark:border-[#1a1a1c] hover:bg-[#f9fafb] dark:hover:bg-[#1a1a1c] transition-colors cursor-pointer"
              >
                <td className="px-5 py-3 font-mono text-xs font-bold text-[#1f2937] dark:text-[#e4e4e7]">{part.sku}</td>
                <td className="px-5 py-3 font-medium text-[#1f2937] dark:text-[#e4e4e7]">{part.part_name}</td>
                <td className="px-5 py-3 text-center font-bold text-[#1f2937] dark:text-[#e4e4e7]">{part.current_stock_qty}</td>
                <td className="px-5 py-3 text-right text-[#6b7280] dark:text-[#a1a1aa]">${part.moving_average_cost.toFixed(2)}</td>
                <td className="px-5 py-3 text-right font-bold text-[#1f2937] dark:text-[#e4e4e7]">
                  ${(part.current_stock_qty * part.moving_average_cost).toFixed(2)}
                </td>
                <td className="px-5 py-3 text-center">
                  {part.current_stock_qty <= part.low_stock_threshold ? (
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Low Stock
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Healthy
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IntakePanel({ API, token }: { API: string; token: string }) {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [recentIntakes, setRecentIntakes] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    model_number: '', category: 'Screen', quality: 'OEM', supplier_id: '', qty: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [supRes, modRes, invRes] = await Promise.all([
        axios.get(`${API}/api/parts/suppliers`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/api/models/`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/api/parts/`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setSuppliers(supRes.data);
      setModels(modRes.data);
      setRecentIntakes(invRes.data.slice(0, 8));
    } catch (_) {}
  };

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      await axios.post(`${API}/api/parts/receive`, {
        ...formData,
        supplier_id: parseInt(formData.supplier_id),
        qty: parseInt(formData.qty)
      }, { headers: { Authorization: `Bearer ${token}` } });
      setSuccess(true);
      setFormData({ ...formData, qty: '' });
      fetchData();
      setTimeout(() => setSuccess(false), 3000);
    } catch (_) {
      alert('Intake failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Intake form */}
      <div className="col-span-4">
        <div className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl p-5">
          <h3 className="text-sm font-bold text-[#1f2937] dark:text-[#e4e4e7] mb-4">Intake Form</h3>
          <form onSubmit={handleReceive} className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-[#6b7280] dark:text-[#71717a] uppercase tracking-wider block mb-1">Model</label>
              <select
                required
                value={formData.model_number}
                onChange={e => setFormData({ ...formData, model_number: e.target.value })}
                className="w-full bg-[#f5f5f5] dark:bg-[#1a1a1c] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-lg px-3 py-2 text-sm text-[#1f2937] dark:text-[#e4e4e7] focus:outline-none focus:border-accent/50"
              >
                <option value="">Select Model...</option>
                {models.map(m => (
                  <option key={m.model_number} value={m.model_number}>{m.model_number} - {m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#6b7280] dark:text-[#71717a] uppercase tracking-wider block mb-1">Category</label>
              <select
                required
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-[#f5f5f5] dark:bg-[#1a1a1c] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-lg px-3 py-2 text-sm text-[#1f2937] dark:text-[#e4e4e7] focus:outline-none focus:border-accent/50"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#6b7280] dark:text-[#71717a] uppercase tracking-wider block mb-1">Quality</label>
              <select
                required
                value={formData.quality}
                onChange={e => setFormData({ ...formData, quality: e.target.value })}
                className="w-full bg-[#f5f5f5] dark:bg-[#1a1a1c] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-lg px-3 py-2 text-sm text-[#1f2937] dark:text-[#e4e4e7] focus:outline-none focus:border-accent/50"
              >
                {QUALITIES.map(q => (
                  <option key={q} value={q}>{q.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#6b7280] dark:text-[#71717a] uppercase tracking-wider block mb-1">Supplier</label>
              <select
                required
                value={formData.supplier_id}
                onChange={e => setFormData({ ...formData, supplier_id: e.target.value })}
                className="w-full bg-[#f5f5f5] dark:bg-[#1a1a1c] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-lg px-3 py-2 text-sm text-[#1f2937] dark:text-[#e4e4e7] focus:outline-none focus:border-accent/50"
              >
                <option value="">Select Supplier...</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#6b7280] dark:text-[#71717a] uppercase tracking-wider block mb-1">Quantity</label>
              <input
                required
                type="number"
                value={formData.qty}
                onChange={e => setFormData({ ...formData, qty: e.target.value })}
                placeholder="0"
                className="w-full bg-[#f5f5f5] dark:bg-[#1a1a1c] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-lg px-3 py-2 text-sm text-[#1f2937] dark:text-[#e4e4e7] placeholder-[#9ca3af] dark:placeholder-[#52525b] focus:outline-none focus:border-accent/50"
              />
            </div>
            <button
              disabled={isProcessing}
              className="w-full bg-accent hover:bg-accent/90 text-white rounded-lg py-2.5 text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isProcessing ? 'Processing...' : (
                <><Package size={16} /> Log Physical Intake</>
              )}
            </button>
            {success && (
              <div className="flex items-center justify-center gap-2 text-emerald-400 text-xs font-bold">
                <CheckCircle2 size={14} /> Intake Synchronized
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Recent intakes */}
      <div className="col-span-8">
        <div className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#e5e7eb] dark:border-[#1f1f21]">
            <h3 className="text-sm font-bold text-[#1f2937] dark:text-[#e4e4e7]">Recent Inventory Updates</h3>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-[#6b7280] dark:text-[#71717a] border-b border-[#e5e7eb] dark:border-[#1f1f21]">
                <th className="px-5 py-3">SKU</th>
                <th className="px-5 py-3">Component</th>
                <th className="px-5 py-3 text-center">Stock</th>
                <th className="px-5 py-3 text-right">MAC</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {recentIntakes.map(item => (
                <tr key={item.sku} className="border-b border-[#e5e7eb] dark:border-[#1a1a1c] hover:bg-[#f9fafb] dark:hover:bg-[#1a1a1c] transition-colors">
                  <td className="px-5 py-3 font-mono text-xs font-bold text-[#1f2937] dark:text-[#e4e4e7]">{item.sku}</td>
                  <td className="px-5 py-3 font-semibold text-[#1f2937] dark:text-[#e4e4e7]">{item.part_name}</td>
                  <td className="px-5 py-3 text-center font-bold text-[#1f2937] dark:text-[#e4e4e7]">{item.current_stock_qty}</td>
                  <td className="px-5 py-3 text-right text-[#6b7280] dark:text-[#a1a1aa]">${item.moving_average_cost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CostingPanel({ API, token }: { API: string; token: string }) {
  const [unpriced, setUnpriced] = useState<any[]>([]);
  const [editingSku, setEditingSku] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchUnpriced(); }, []);

  const fetchUnpriced = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${API}/api/parts/unpriced`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUnpriced(res.data);
    } catch (_) {} finally {
      setIsLoading(false);
    }
  };

  const handlePriceUpdate = async (sku: string) => {
    if (!priceInput) return;
    try {
      await axios.put(`${API}/api/parts/price`, {
        sku,
        unit_cost: parseFloat(priceInput)
      }, { headers: { Authorization: `Bearer ${token}` } });
      setEditingSku(null);
      setPriceInput('');
      fetchUnpriced();
    } catch (_) {
      alert('Price update failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl p-4">
          <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] font-semibold uppercase tracking-wider mb-1">Unpriced SKUs</div>
          <div className="text-2xl font-bold text-amber-400">{unpriced.length}</div>
        </div>
        <div className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl p-4">
          <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] font-semibold uppercase tracking-wider mb-1">Pending Cost Basis</div>
          <div className="text-2xl font-bold text-[#1f2937] dark:text-[#e4e4e7]">{unpriced.reduce((s, i) => s + (i.qty || 0), 0)}</div>
          <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] mt-1">Units awaiting price</div>
        </div>
        <div className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl p-4">
          <div className="text-[11px] text-[#6b7280] dark:text-[#71717a] font-semibold uppercase tracking-wider mb-1">MAC Health</div>
          <div className="text-2xl font-bold text-emerald-400">
            {unpriced.length === 0 ? 'Clean' : 'Action Needed'}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#e5e7eb] dark:border-[#1f1f21]">
          <h3 className="text-sm font-bold text-[#1f2937] dark:text-[#e4e4e7]">Unpriced Intakes</h3>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-[#6b7280] dark:text-[#71717a] border-b border-[#e5e7eb] dark:border-[#1f1f21]">
              <th className="px-5 py-3">SKU</th>
              <th className="px-5 py-3">Part Name</th>
              <th className="px-5 py-3 text-center">Qty</th>
              <th className="px-5 py-3 text-right">Unit Cost</th>
              <th className="px-5 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {isLoading ? (
              <tr><td colSpan={5} className="py-24 text-center text-[#9ca3af] dark:text-[#52525b]">Loading...</td></tr>
            ) : unpriced.length === 0 ? (
              <tr><td colSpan={5} className="py-24 text-center text-[#9ca3af] dark:text-[#52525b]">All intakes priced</td></tr>
            ) : unpriced.map((item: any, idx: number) => (
              <tr key={idx} className="border-b border-[#e5e7eb] dark:border-[#1a1a1c] hover:bg-[#f9fafb] dark:hover:bg-[#1a1a1c] transition-colors">
                <td className="px-5 py-3 font-mono text-xs font-bold text-[#1f2937] dark:text-[#e4e4e7]">{item.sku}</td>
                <td className="px-5 py-3 font-medium text-[#1f2937] dark:text-[#e4e4e7]">{item.part_name}</td>
                <td className="px-5 py-3 text-center font-bold text-[#1f2937] dark:text-[#e4e4e7]">{item.qty}</td>
                <td className="px-5 py-3 text-right">
                  {editingSku === item.sku ? (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-[#9ca3af] dark:text-[#52525b]">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={priceInput}
                        onChange={e => setPriceInput(e.target.value)}
                        className="w-24 bg-white dark:bg-[#0a0a0b] border border-[#e5e7eb] dark:border-[#1f1f21] rounded px-2 py-1 text-right text-sm text-[#1f2937] dark:text-[#e4e4e7] focus:outline-none focus:border-accent/50"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <span className="text-amber-400 font-bold">Unpriced</span>
                  )}
                </td>
                <td className="px-5 py-3 text-center">
                  {editingSku === item.sku ? (
                    <button
                      onClick={() => handlePriceUpdate(item.sku)}
                      className="text-xs font-bold text-emerald-400 hover:text-emerald-300"
                    >
                      Save
                    </button>
                  ) : (
                    <button
                      onClick={() => { setEditingSku(item.sku); setPriceInput(''); }}
                      className="text-xs font-semibold text-accent hover:text-accent/80"
                    >
                      Set Price
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SuppliersPanel({ API, token }: { API: string; token: string }) {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetchSuppliers(); }, []);

  const fetchSuppliers = async () => {
    try {
      const res = await axios.get(`${API}/api/parts/suppliers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuppliers(res.data);
    } catch (_) {} finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsSubmitting(true);
    setError('');
    try {
      await axios.post(`${API}/api/parts/suppliers?name=${encodeURIComponent(newName.trim())}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewName('');
      setShowForm(false);
      fetchSuppliers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create supplier');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(true)} className="bg-accent hover:bg-accent/90 text-white rounded-lg px-4 py-2 text-sm font-bold transition-colors flex items-center gap-2">
          <Plus size={16} /> Add Supplier
        </button>
      </div>

      <div className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-[#6b7280] dark:text-[#71717a] border-b border-[#e5e7eb] dark:border-[#1f1f21]">
              <th className="px-5 py-3">ID</th>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3 text-right">Parts Supplied</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {isLoading ? (
              <tr><td colSpan={3} className="py-24 text-center text-[#9ca3af] dark:text-[#52525b]">Loading suppliers...</td></tr>
            ) : suppliers.length === 0 ? (
              <tr><td colSpan={3} className="py-24 text-center text-[#9ca3af] dark:text-[#52525b]">No suppliers configured</td></tr>
            ) : suppliers.map(s => (
              <tr key={s.id} className="border-b border-[#e5e7eb] dark:border-[#1a1a1c] hover:bg-[#f9fafb] dark:hover:bg-[#1a1a1c] transition-colors">
                <td className="px-5 py-3 text-[#6b7280] dark:text-[#71717a] font-mono text-xs">{s.id}</td>
                <td className="px-5 py-3 font-bold text-[#1f2937] dark:text-[#e4e4e7]">{s.name}</td>
                <td className="px-5 py-3 text-right text-[#6b7280] dark:text-[#71717a]">--</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#e5e7eb] dark:border-[#1f1f21]">
              <h3 className="text-sm font-bold text-[#1f2937] dark:text-[#e4e4e7]">New Supplier</h3>
              <button onClick={() => { setShowForm(false); setError(''); }} className="text-[#9ca3af] dark:text-[#52525b] hover:text-[#1f2937] dark:hover:text-[#e4e4e7]">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="p-5 space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#6b7280] dark:text-[#71717a] uppercase tracking-wider block mb-1">Supplier Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. MobileSentrix"
                    className="w-full bg-[#f5f5f5] dark:bg-[#1a1a1c] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-lg px-3 py-2 text-sm text-[#1f2937] dark:text-[#e4e4e7] placeholder-[#9ca3af] dark:placeholder-[#52525b] focus:outline-none focus:border-accent/50"
                    autoFocus
                    required
                  />
                </div>
                {error && <p className="text-xs text-red-400 font-semibold">{error}</p>}
              </div>
              <div className="flex justify-end gap-2 px-5 py-3 border-t border-[#e5e7eb] dark:border-[#1f1f21]">
                <button type="button" onClick={() => { setShowForm(false); setError(''); }} className="px-4 py-2 text-xs font-semibold text-[#6b7280] dark:text-[#71717a] hover:text-[#1f2937] dark:hover:text-[#e4e4e7] transition-colors">
                  Cancel
                </button>
                <button disabled={isSubmitting} className="bg-accent hover:bg-accent/90 text-white rounded-lg px-4 py-2 text-xs font-bold transition-colors disabled:opacity-50">
                  {isSubmitting ? 'Creating...' : 'Create Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function LaborPanel({ API, token }: { API: string; token: string }) {
  const [rates, setRates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ action_name: '', fee_amount: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { fetchRates(); }, []);

  const fetchRates = async () => {
    try {
      const res = await axios.get(`${API}/api/parts/labor-rates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRates(res.data);
    } catch (_) {} finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.action_name || !formData.fee_amount) return;
    setIsSubmitting(true);
    try {
      await axios.post(`${API}/api/parts/labor-rates`, {
        action_name: formData.action_name,
        fee_amount: parseFloat(formData.fee_amount)
      }, { headers: { Authorization: `Bearer ${token}` } });
      setFormData({ action_name: '', fee_amount: '' });
      setShowForm(false);
      fetchRates();
    } catch (_) {} finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (id: number) => {
    if (!editAmount) return;
    try {
      await axios.put(`${API}/api/parts/labor-rates/${id}`, {
        fee_amount: parseFloat(editAmount)
      }, { headers: { Authorization: `Bearer ${token}` } });
      setEditingId(null);
      setEditAmount('');
      fetchRates();
    } catch (_) {}
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-3">
        <button onClick={() => setShowForm(true)} className="bg-accent hover:bg-accent/90 text-white rounded-lg px-4 py-2 text-sm font-bold transition-colors flex items-center gap-2">
          <Plus size={16} /> Add Rate
        </button>
      </div>

      <div className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-[#6b7280] dark:text-[#71717a] border-b border-[#e5e7eb] dark:border-[#1f1f21]">
              <th className="px-5 py-3">ID</th>
              <th className="px-5 py-3">Action</th>
              <th className="px-5 py-3 text-right">Fee Amount</th>
              <th className="px-5 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {isLoading ? (
              <tr><td colSpan={4} className="py-24 text-center text-[#9ca3af] dark:text-[#52525b]">Loading rates...</td></tr>
            ) : rates.length === 0 ? (
              <tr><td colSpan={4} className="py-24 text-center text-[#9ca3af] dark:text-[#52525b]">No labor rates configured</td></tr>
            ) : rates.map(r => (
              <tr key={r.id} className="border-b border-[#e5e7eb] dark:border-[#1a1a1c] hover:bg-[#f9fafb] dark:hover:bg-[#1a1a1c] transition-colors">
                <td className="px-5 py-3 text-[#6b7280] dark:text-[#71717a] font-mono text-xs">{r.id}</td>
                <td className="px-5 py-3 font-bold text-[#1f2937] dark:text-[#e4e4e7]">{r.action_name.replace(/_/g, ' ')}</td>
                <td className="px-5 py-3 text-right">
                  {editingId === r.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-[#9ca3af] dark:text-[#52525b]">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={editAmount}
                        onChange={e => setEditAmount(e.target.value)}
                        className="w-24 bg-white dark:bg-[#0a0a0b] border border-[#e5e7eb] dark:border-[#1f1f21] rounded px-2 py-1 text-right text-sm text-[#1f2937] dark:text-[#e4e4e7] focus:outline-none focus:border-accent/50"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <span className="font-bold text-[#1f2937] dark:text-[#e4e4e7]">${r.fee_amount.toFixed(2)}</span>
                  )}
                </td>
                <td className="px-5 py-3 text-center">
                  {editingId === r.id ? (
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => handleUpdate(r.id)} className="text-xs font-bold text-emerald-400 hover:text-emerald-300">Save</button>
                      <button onClick={() => { setEditingId(null); setEditAmount(''); }} className="text-[#9ca3af] dark:text-[#52525b] hover:text-[#1f2937] dark:hover:text-[#e4e4e7]">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingId(r.id); setEditAmount(String(r.fee_amount)); }}
                      className="text-xs font-semibold text-accent hover:text-accent/80"
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#141416] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#e5e7eb] dark:border-[#1f1f21]">
              <h3 className="text-sm font-bold text-[#1f2937] dark:text-[#e4e4e7]">New Labor Rate</h3>
              <button onClick={() => setShowForm(false)} className="text-[#9ca3af] dark:text-[#52525b] hover:text-[#1f2937] dark:hover:text-[#e4e4e7]">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="p-5 space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#6b7280] dark:text-[#71717a] uppercase tracking-wider block mb-1">Action Name</label>
                  <input
                    type="text"
                    value={formData.action_name}
                    onChange={e => setFormData({ ...formData, action_name: e.target.value })}
                    placeholder="e.g. Repair_Screen"
                    className="w-full bg-[#f5f5f5] dark:bg-[#1a1a1c] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-lg px-3 py-2 text-sm text-[#1f2937] dark:text-[#e4e4e7] placeholder-[#9ca3af] dark:placeholder-[#52525b] focus:outline-none focus:border-accent/50"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#6b7280] dark:text-[#71717a] uppercase tracking-wider block mb-1">Fee Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.fee_amount}
                    onChange={e => setFormData({ ...formData, fee_amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-[#f5f5f5] dark:bg-[#1a1a1c] border border-[#e5e7eb] dark:border-[#1f1f21] rounded-lg px-3 py-2 text-sm text-[#1f2937] dark:text-[#e4e4e7] placeholder-[#9ca3af] dark:placeholder-[#52525b] focus:outline-none focus:border-accent/50"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 px-5 py-3 border-t border-[#e5e7eb] dark:border-[#1f1f21]">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-xs font-semibold text-[#6b7280] dark:text-[#71717a] hover:text-[#1f2937] dark:hover:text-[#e4e4e7] transition-colors">
                  Cancel
                </button>
                <button disabled={isSubmitting} className="bg-accent hover:bg-accent/90 text-white rounded-lg px-4 py-2 text-xs font-bold transition-colors disabled:opacity-50">
                  {isSubmitting ? 'Creating...' : 'Create Rate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
