import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, Save, ArrowLeft, Building2, User, Phone, Mail, MapPin, FileText } from 'lucide-react';
import { fetchCustomer, updateCustomer, createCustomer, CustomerCreate, extractError } from '../api/crm';

const emptyForm: CustomerCreate = {
  customer_type: 'Retail',
  first_name: '',
  last_name: '',
  company_name: '',
  contact_person: '',
  shipping_address: '',
  phone: '',
  email: '',
  tax_exempt_id: '',
  tax_exempt_expiry: '',
  pricing_tier: 0,
  credit_limit: 0,
  payment_terms_days: 0,
  wholesale_subtype: 'standard',
  default_consignment_days: 15,
  notes: '',
};

function sanitize(form: CustomerCreate): CustomerCreate {
  return {
    ...form,
    first_name: form.first_name || undefined,
    last_name: form.last_name || undefined,
    company_name: form.company_name || undefined,
    contact_person: form.contact_person || undefined,
    shipping_address: form.shipping_address || undefined,
    email: form.email || undefined,
    tax_exempt_id: form.tax_exempt_id || undefined,
    tax_exempt_expiry: form.tax_exempt_expiry || undefined,
    notes: form.notes || undefined,
  };
}

export default function CustomerDetail() {
  const { crmId } = useParams<{ crmId: string }>();
  const navigate = useNavigate();
  const isNew = crmId === 'new';

  const [form, setForm] = useState<CustomerCreate>(emptyForm);
  const [initialForm, setInitialForm] = useState<CustomerCreate | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [customerMeta, setCustomerMeta] = useState<{ is_active?: number; contacts?: any[]; documents?: any[]; current_balance?: number } | null>(null);

  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const c = await fetchCustomer(crmId!);
      const mapped = {
        customer_type: c.customer_type,
        first_name: c.first_name || '',
        last_name: c.last_name || '',
        company_name: c.company_name || '',
        contact_person: c.contact_person || '',
        shipping_address: c.shipping_address || '',
        phone: c.phone || '',
        email: c.email || '',
        tax_exempt_id: c.tax_exempt_id || '',
        tax_exempt_expiry: c.tax_exempt_expiry?.split?.('T')?.[0] || '',
        pricing_tier: c.pricing_tier,
        credit_limit: c.credit_limit,
        payment_terms_days: c.payment_terms_days,
        wholesale_subtype: c.wholesale_subtype || 'standard',
        default_consignment_days: c.default_consignment_days || 15,
        notes: c.notes || '',
      };
      setForm(mapped);
      setInitialForm(mapped);
      setCustomerMeta({ is_active: c.is_active, contacts: c.contacts, documents: c.documents, current_balance: c.current_balance });
    } catch (err: any) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [crmId, isNew]);

  useEffect(() => { load(); }, [load]);

  const hasChanges = isNew
    ? JSON.stringify(form) !== JSON.stringify(emptyForm)
    : initialForm && JSON.stringify(form) !== JSON.stringify(initialForm);

  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasChanges]);

  const handleDeactivate = async () => {
    if (!window.confirm(customerMeta?.is_active ? 'Deactivate this customer? They will no longer appear in customer lists.' : 'Reactivate this customer?')) return;
    try {
      await updateCustomer(crmId!, { ...form, is_active: customerMeta?.is_active ? 0 : 1 } as any);
      setCustomerMeta(prev => prev ? { ...prev, is_active: prev.is_active ? 0 : 1 } : null);
      setSuccess(customerMeta?.is_active ? 'Customer deactivated' : 'Customer reactivated');
    } catch (err: any) {
      setError(extractError(err));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const clean = sanitize(form);
      if (isNew) {
        const c = await createCustomer(clean);
        setSuccess('Customer created');
        navigate(`/admin/customers/${c.crm_id}`, { replace: true });
      } else {
        await updateCustomer(crmId!, clean);
        setSuccess('Customer updated');
        setInitialForm(form);
      }
    } catch (err: any) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  };

  const update = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={28} className="animate-spin text-[var(--text-tertiary)]" />
      </div>
    );
  }

  const isWholesale = form.customer_type === 'Wholesale';

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-[var(--text-tertiary)] hover:text-[var(--text)]">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-bold text-[var(--text)]">
          {isNew ? 'New Customer' : 'Edit Customer'}
        </h1>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[#FEE2E2] border border-[var(--destructive)]/20 text-[var(--destructive)] text-sm">
          <AlertCircle size={16} />{error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-[#DCFCE7] border border-[var(--success)]/20 text-[var(--success)] text-sm">{success}</div>
      )}

      <div className="card space-y-5">
        {/* Customer Type */}
        <div className="flex gap-3">
          <button
            onClick={() => update('customer_type', 'Retail')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border text-sm font-medium transition-colors ${
              form.customer_type === 'Retail'
                ? 'border-accent badge-neutral'
                : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-secondary)]'
            }`}
          >
            <User size={16} /> Retail
          </button>
          <button
            onClick={() => update('customer_type', 'Wholesale')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border text-sm font-medium transition-colors ${
              form.customer_type === 'Wholesale'
                ? 'border-accent badge-neutral'
                : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-secondary)]'
            }`}
          >
            <Building2 size={16} /> Wholesale
          </button>
        </div>

        {/* Retail Fields */}
        {!isWholesale && (
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">First Name</label>
              <input type="text" className="form-input" value={form.first_name || ''} onChange={e => update('first_name', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input type="text" className="form-input" value={form.last_name || ''} onChange={e => update('last_name', e.target.value)} />
            </div>
          </div>
        )}

        {/* Wholesale Fields */}
        {isWholesale && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Company Name</label>
                <input type="text" className="form-input" value={form.company_name || ''} onChange={e => update('company_name', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Person</label>
                <input type="text" className="form-input" value={form.contact_person || ''} onChange={e => update('contact_person', e.target.value)} />
              </div>
            </div>

            {/* Wholesale Subtype */}
            <div className="form-group">
              <label className="form-label">Wholesale Subtype</label>
              <select
                className="form-input"
                value={form.wholesale_subtype || 'standard'}
                onChange={e => update('wholesale_subtype', e.target.value)}
              >
                <option value="standard">Standard</option>
                <option value="consignee">Consignee</option>
              </select>
            </div>

            {/* Tax Exempt */}
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Tax Exempt ID</label>
                <input type="text" className="form-input" value={form.tax_exempt_id || ''} onChange={e => update('tax_exempt_id', e.target.value)}
                  placeholder="e.g. TX-839201" />
              </div>
              <div className="form-group">
                <label className="form-label">Tax Exempt Expiry</label>
                <input type="date" className="form-input" value={form.tax_exempt_expiry || ''} onChange={e => update('tax_exempt_expiry', e.target.value)} />
              </div>
            </div>

            {/* Pricing & Credit */}
            <div className="grid grid-cols-3 gap-4">
              <div className="form-group">
                <label className="form-label">Pricing Tier (%)</label>
                <input type="number" step="0.01" className="form-input" value={form.pricing_tier}
                  onChange={e => update('pricing_tier', parseFloat(e.target.value) || 0)} />
              </div>
              <div className="form-group">
                <label className="form-label">Credit Limit ($)</label>
                <input type="number" step="0.01" className="form-input" value={form.credit_limit}
                  onChange={e => update('credit_limit', parseFloat(e.target.value) || 0)} />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Terms (Days)</label>
                <input type="number" className="form-input" value={form.payment_terms_days}
                  onChange={e => update('payment_terms_days', parseInt(e.target.value) || 0)} />
              </div>
            </div>

            {/* Consignee-specific */}
            {form.wholesale_subtype === 'consignee' && (
              <div className="form-group">
                <label className="form-label">Default Consignment Period (Days)</label>
                <input type="number" className="form-input w-32" value={form.default_consignment_days || 15}
                  onChange={e => update('default_consignment_days', parseInt(e.target.value) || 15)} />
              </div>
            )}
          </>
        )}

        {/* Common Fields */}
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label flex items-center gap-1.5"><Phone size={13} /> Phone *</label>
            <input type="text" className="form-input" value={form.phone} onChange={e => update('phone', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label flex items-center gap-1.5"><Mail size={13} /> Email</label>
            <input type="email" className="form-input" value={form.email || ''} onChange={e => update('email', e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label flex items-center gap-1.5"><MapPin size={13} /> Shipping Address</label>
          <input type="text" className="form-input" value={form.shipping_address || ''} onChange={e => update('shipping_address', e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label flex items-center gap-1.5"><FileText size={13} /> Notes</label>
          <textarea className="form-input" rows={3} value={form.notes || ''} onChange={e => update('notes', e.target.value)} />
        </div>
      </div>

      {/* Save + Deactivate */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !form.phone}
          className="btn-primary flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {isNew ? 'Create Customer' : 'Save Changes'}
        </button>
        {!isNew && customerMeta && (
          <button
            onClick={handleDeactivate}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
              customerMeta.is_active
                ? 'border-red-400 text-red-400 hover:bg-red-50'
                : 'border-emerald-400 text-emerald-400 hover:bg-emerald-50'
            }`}
          >
            {customerMeta.is_active ? 'Deactivate' : 'Reactivate'}
          </button>
        )}
      </div>

      {/* Meta sections */}
      {!isNew && customerMeta && (
        <div className="space-y-5 mt-6">
          {customerMeta.current_balance != null && (
            <div className="card">
              <div className="card-header">Account Standing</div>
              <div className="card-body grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-[var(--text-tertiary)]">Current Balance</span>
                  <p className={`text-lg font-bold ${customerMeta.current_balance > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                    ${customerMeta.current_balance.toFixed(2)}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-[var(--text-tertiary)]">Status</span>
                  <p className={`text-lg font-bold ${customerMeta.is_active ? 'text-emerald-500' : 'text-red-500'}`}>
                    {customerMeta.is_active ? 'Active' : 'Inactive'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {customerMeta.contacts && customerMeta.contacts.length > 0 && (
            <div className="card">
              <div className="card-header">Contacts ({customerMeta.contacts.length})</div>
              <div className="card-body p-0">
                <div className="divide-y divide-[var(--border)]">
                  {customerMeta.contacts.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--text)]">{c.name}</p>
                        {c.phone && <p className="text-xs text-[var(--text-secondary)]">{c.phone}</p>}
                      </div>
                      {c.is_authorized_buyer ? (
                        <span className="badge badge-sellable text-[10px]">Authorized Buyer</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {customerMeta.documents && customerMeta.documents.length > 0 && (
            <div className="card">
              <div className="card-header">Documents ({customerMeta.documents.length})</div>
              <div className="card-body p-0">
                <div className="divide-y divide-[var(--border)]">
                  {customerMeta.documents.map((d: any) => (
                    <div key={d.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--text)] capitalize">{d.document_type}</p>
                        {d.expiry_date && <p className="text-xs text-[var(--text-secondary)]">Expires: {new Date(d.expiry_date).toLocaleDateString()}</p>}
                      </div>
                      {d.file_url && (
                        <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">View</a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
