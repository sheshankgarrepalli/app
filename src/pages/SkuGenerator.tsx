import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Plus, Printer, X, Loader2, AlertCircle, QrCode, Package, Check } from 'lucide-react';
import api from '../api/api';
import { useToast } from '../components/Toast';

interface SkuRow {
  sku: string;
  part_name: string;
  current_stock_qty: number;
  moving_average_cost: number;
  created_at: string;
}

const PRODUCT_TYPES = ['Device', 'Case', 'Screen Protector', 'Charger & Cable', 'Audio & Accessory', 'Repair Part', 'Other'];

const TYPE_CODE_MAP: Record<string, string> = {
  'Device': 'DEV', 'Case': 'CASE', 'Screen Protector': 'PROT',
  'Charger & Cable': 'PWR', 'Audio & Accessory': 'ACC',
  'Repair Part': 'PRT', 'Other': 'GEN',
};

export default function SkuGenerator() {
  const [skus, setSkus] = useState<SkuRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [productName, setProductName] = useState('');
  const [productType, setProductType] = useState('Phone Case');
  const [brand, setBrand] = useState('');
  const [price, setPrice] = useState('');
  const [customSku, setCustomSku] = useState('');
  const [useCustomSku, setUseCustomSku] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generatedSku, setGeneratedSku] = useState<{ sku: string; name: string } | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | undefined> = {};
      if (search) params.search = search;
      const { data } = await api.get('/api/parts/', { params });
      setSkus(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load SKUs');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search) return skus;
    const q = search.toLowerCase();
    return skus.filter(s => s.sku.toLowerCase().includes(q) || s.part_name.toLowerCase().includes(q));
  }, [skus, search]);

  const resetForm = () => {
    setProductName('');
    setProductType('Phone Case');
    setBrand('');
    setPrice('');
    setCustomSku('');
    setUseCustomSku(false);
    setGenerateError(null);
  };

  const handleGenerate = async () => {
    if (!productName.trim()) return;
    setSubmitting(true);
    setGenerateError(null);
    try {
      const { data } = await api.post('/api/parts/create-custom', {
        product_name: productName.trim(),
        product_type: productType,
        brand: brand.trim() || null,
        price: price ? parseFloat(price) : null,
        custom_sku: useCustomSku ? customSku.trim() : null,
      });
      setSkus(prev => [data, ...prev]);
      setGeneratedSku({ sku: data.sku, name: data.part_name });
      resetForm();
      setShowModal(false);
      toast.success(`Created SKU ${data.sku}`);
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to create SKU';
      setGenerateError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = (sku: string, name: string, cost: number) => {
    const w = window.open('', '_blank', 'width=450,height=350');
    if (!w) return;
    const labelHtml = `<!DOCTYPE html><html><head>
<meta charset="utf-8"><title>Label - ${sku}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { display: flex; justify-content: center; align-items: center; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.label { width: 2.5in; padding: 0.15in; text-align: center; }
.label svg { max-width: 100%; height: auto; display: block; margin: 0 auto; }
.sku { font-size: 14px; font-weight: 700; margin-top: 4px; color: #0F172A; font-family: 'Courier New', monospace; }
.name { font-size: 9px; color: #475569; margin-top: 2px; line-height: 1.2; }
.price { font-size: 10px; color: #059669; margin-top: 1px; font-weight: 700; }
@media print { body { margin: 0; padding: 0; } }
</style>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
</head><body>
<div class="label">
<svg id="bc"></svg>
<div class="sku">${sku}</div>
<div class="name">${name}</div>
${cost > 0 ? `<div class="price">$${cost.toFixed(2)}</div>` : ''}
</div>
<script>
JsBarcode("#bc", "${sku}", { format: "CODE128", width: 2, height: 60, displayValue: false, margin: 1 });
setTimeout(() => window.print(), 600);
</script>
</body></html>`;
    w.document.write(labelHtml);
    w.document.close();
  };

  const previewSku = useMemo(() => {
    if (useCustomSku && customSku.trim()) return customSku.trim().toUpperCase();
    if (!productName.trim()) return '';
    const typeCode = TYPE_CODE_MAP[productType] || 'GEN';
    const nameSlug = productName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8);
    return `${typeCode}-${nameSlug}-XXXXX`;
  }, [productName, productType, useCustomSku, customSku]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">SKU Generator</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">Create SKUs and print barcode labels for your products</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus size={16} />
          Generate SKU
        </button>
      </div>

      {/* Search */}
      <form onSubmit={e => { e.preventDefault(); load(); }} className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            type="text"
            className="form-input pl-9 text-sm w-full"
            placeholder="Search by SKU or name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Generated toast */}
      {generatedSku && (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Check size={16} />
            <span>SKU <strong className="font-mono">{generatedSku.sku}</strong> created — ready to print</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePrint(generatedSku.sku, generatedSku.name, 0)}
              className="btn-primary text-xs flex items-center gap-1 px-3 py-1.5 rounded-md"
            >
              <Printer size={12} /> Print Label
            </button>
            <button onClick={() => setGeneratedSku(null)} className="text-green-600 hover:text-green-800">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 size={24} className="animate-spin text-[var(--text-tertiary)]" />
        </div>
      ) : filtered.length === 0 ? (
        /* Empty */
        <div className="text-center py-12 text-[var(--text-tertiary)]">
          <Package size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">{search ? 'No SKUs match your search' : 'No SKUs yet'}</p>
          <p className="text-xs mt-1">Click "Generate SKU" to create your first barcode label</p>
        </div>
      ) : (
        /* Table */
        <div className="card">
          <table className="table-standard">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product Name</th>
                <th>Stock</th>
                <th>Price</th>
                <th className="w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.sku} className="group">
                  <td>
                    <span className="font-mono text-xs font-semibold bg-[var(--bg-muted)] px-2 py-0.5 rounded">
                      {s.sku}
                    </span>
                  </td>
                  <td className="text-sm">{s.part_name}</td>
                  <td className="text-sm">
                    <span className={`badge-${s.current_stock_qty > 0 ? 'success' : 'error'}`}>
                      {s.current_stock_qty}
                    </span>
                  </td>
                  <td className="text-sm font-medium">
                    {(s.moving_average_cost || 0) > 0 ? `$${(s.moving_average_cost || 0).toFixed(2)}` : '-'}
                  </td>
                  <td>
                    <button
                      onClick={() => handlePrint(s.sku, s.part_name, s.moving_average_cost)}
                      className="btn-ghost text-xs flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Print barcode label"
                    >
                      <Printer size={14} /> Print Label
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <QrCode size={18} className="text-[var(--accent)]" />
                <h2 className="text-base font-bold text-[var(--text)]">Generate SKU</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="text-[var(--text-tertiary)] hover:text-[var(--text)]">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body space-y-4">
              {generateError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
                  <AlertCircle size={16} /> {generateError}
                </div>
              )}

              {/* Product Name */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  className="form-input text-sm w-full"
                  placeholder="e.g. iPhone 16 Pro Max 512GB Black"
                  value={productName}
                  onChange={e => setProductName(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Product Type + Brand row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Product Type
                  </label>
                  <select
                    className="form-select text-sm w-full"
                    value={productType}
                    onChange={e => setProductType(e.target.value)}
                  >
                    {PRODUCT_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Brand
                  </label>
                  <input
                    type="text"
                    className="form-input text-sm w-full"
                    placeholder="e.g. Apple, Samsung"
                    value={brand}
                    onChange={e => setBrand(e.target.value)}
                  />
                </div>
              </div>

              {/* Price + Custom SKU toggle */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Sale Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input text-sm w-full"
                    placeholder="0.00"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setUseCustomSku(!useCustomSku)}
                    className={`w-full text-xs flex items-center gap-2 px-3 py-2 rounded-md border transition-colors ${useCustomSku ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)] font-semibold' : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-tertiary)]'}`}
                  >
                    {useCustomSku ? <Check size={14} /> : <QrCode size={14} />}
                    {useCustomSku ? 'Custom SKU Enabled' : 'Use Custom SKU'}
                  </button>
                </div>
              </div>

              {/* Custom SKU input */}
              {useCustomSku && (
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Custom SKU
                  </label>
                  <input
                    type="text"
                    className="form-input text-sm w-full font-mono"
                    placeholder="e.g. MY-PRODUCT-001"
                    value={customSku}
                    onChange={e => setCustomSku(e.target.value.toUpperCase())}
                  />
                </div>
              )}

              {/* SKU Preview */}
              {!useCustomSku && previewSku && (
                <div className="bg-[var(--bg-muted)] rounded-lg p-3 border border-[var(--border)]">
                  <div className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                    Generated SKU Preview
                  </div>
                  <div className="flex items-center gap-2">
                    <QrCode size={16} className="text-[var(--text-secondary)]" />
                    <span className="font-mono text-sm font-bold text-[var(--text)]">{previewSku}</span>
                  </div>
                  <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
                    XXXXX will be replaced with an auto-incrementing number
                  </p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} className="btn-ghost text-sm px-4 py-2 rounded-lg">
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={!productName.trim() || submitting}
                className="btn-primary text-sm px-5 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <QrCode size={16} />
                )}
                {submitting ? 'Creating...' : 'Generate SKU'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
