import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Search } from 'lucide-react';

export default function CheckoutCRMWidget({ onSelect }: { onSelect: (customer: any) => void }) {
  const { token } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    axios.get((import.meta.env.VITE_API_URL ?? 'http://localhost:8000') + '/api/crm/', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setCustomers(res.data))
      .catch(err => console.error(err));
  }, [token]);

  const matches = query.trim() === '' ? [] : customers.filter(c => 
    c.name.toLowerCase().includes(query.toLowerCase()) || 
    (c.phone && c.phone.includes(query)) ||
    c.crm_id.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 5);

  const handleSelect = (c: any) => {
    setSelected(c);
    setQuery('');
    onSelect(c);
  };

  const clearSelection = () => {
    setSelected(null);
    onSelect(null);
  };

  if (selected) {
    return (
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex justify-between items-center shadow-sm">
        <div>
          <div className="font-bold text-blue-900">{selected.name}</div>
          <div className="text-sm text-blue-700">Type: {selected.customer_type} | Discount: {(selected.pricing_tier * 100).toFixed(0)}%</div>
          {selected.tax_exempt_id && <div className="text-xs text-green-600 font-bold uppercase mt-1">Tax Exempt</div>}
        </div>
        <button onClick={clearSelection} className="text-sm text-red-500 hover:text-red-700 font-medium px-3 py-1 bg-white dark:bg-[#141416] rounded shadow-sm border border-red-100">Remove</button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
        <input 
          placeholder="Search Customer by Name, Phone, or ID..." 
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition"
        />
      </div>
      {matches.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-[#141416] border border-slate-200 rounded-lg shadow-xl overflow-hidden">
          {matches.map(c => (
            <div 
              key={c.crm_id} 
              onClick={() => handleSelect(c)}
              className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
            >
              <div className="font-bold text-slate-800">{c.name} <span className="text-xs font-normal text-slate-500 ml-2">{c.customer_type}</span></div>
              <div className="text-sm text-slate-500">{c.phone || c.email || c.crm_id}</div>
            </div>
          ))}
        </div>
      )}
      {query.trim() !== '' && matches.length === 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-[#141416] border border-slate-200 rounded-lg shadow-xl p-3 text-sm text-slate-500 italic">
          No matching customers found. Proceed without CRM profile to register a new walk-in.
        </div>
      )}
    </div>
  );
}
