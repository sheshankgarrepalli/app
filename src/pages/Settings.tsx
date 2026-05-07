import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle, Save, PaintBucket, Mail, FileText } from 'lucide-react';
import api from '../api/api';

interface OrgSettings {
  org_id: string;
  default_tax_rate: number;
  currency: string;
  timezone: string;
  invoice_terms: string;
  logo_url?: string | null;
  invoice_template: string;
  primary_color: string;
  email_template_body?: string | null;
  reminder_template_body?: string | null;
}

const TEMPLATES = [
  { value: 'modern', label: 'Modern — clean lines, accent headers' },
  { value: 'classic', label: 'Classic — traditional layout, formal' },
  { value: 'minimal', label: 'Minimal — bare bones, no frills' },
];

const COLORS = [
  { value: '#e94560', label: 'Crimson' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#10b981', label: 'Emerald' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#1e293b', label: 'Slate' },
];

export default function Settings() {
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/admin/org-settings');
      setSettings(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = (key: string, value: any) => {
    if (!settings) return;
    setSettings(prev => prev ? { ...prev, [key]: value } : null);
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { data } = await api.put('/api/admin/org-settings', settings);
      setSettings(data);
      setSuccess('Settings saved');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={28} className="animate-spin text-[var(--text-tertiary)]" />
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Organization Settings</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">Customize your invoice templates, branding, and defaults</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save All
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle size={16} />{error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">{success}</div>
      )}

      {/* Branding */}
      <div className="card space-y-4 p-5">
        <div className="flex items-center gap-2 mb-1">
          <PaintBucket size={15} className="text-accent" />
          <h2 className="text-sm font-bold text-[var(--text-primary)]">Branding & Template</h2>
        </div>

        <div className="form-group">
          <label className="form-label">Logo URL</label>
          <input
            type="text"
            className="form-input"
            value={settings.logo_url || ''}
            onChange={e => update('logo_url', e.target.value || null)}
            placeholder="https://your-cdn.com/logo.png"
          />
          {settings.logo_url && (
            <div className="mt-2 p-3 bg-[var(--bg-tertiary)] rounded border border-[var(--border-primary)] inline-block">
              <img src={settings.logo_url} alt="Logo preview" className="h-10 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Invoice Template</label>
          <select
            className="form-input"
            value={settings.invoice_template}
            onChange={e => update('invoice_template', e.target.value)}
          >
            {TEMPLATES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Primary Color</label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => update('primary_color', c.value)}
                className={`w-9 h-9 rounded-lg border-2 transition-all ${
                  settings.primary_color === c.value ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c.value }}
                title={c.label}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-[var(--text-tertiary)]">Custom:</span>
            <input
              type="text"
              className="form-input w-24 text-sm"
              value={settings.primary_color}
              onChange={e => update('primary_color', e.target.value)}
            />
            <div className="w-6 h-6 rounded" style={{ backgroundColor: settings.primary_color }} />
          </div>
        </div>
      </div>

      {/* Email Templates */}
      <div className="card space-y-4 p-5">
        <div className="flex items-center gap-2 mb-1">
          <Mail size={15} className="text-accent" />
          <h2 className="text-sm font-bold text-[var(--text-primary)]">Email Templates</h2>
        </div>

        <div className="form-group">
          <label className="form-label">Invoice Email Body</label>
          <textarea
            className="form-input"
            rows={4}
            value={settings.email_template_body || ''}
            onChange={e => update('email_template_body', e.target.value || null)}
            placeholder="Dear {customer_name},&#10;&#10;Your invoice {invoice_number} is attached. Total due: ${total}.&#10;&#10;Thank you for your business!"
          />
          <p className="text-[10px] text-[var(--text-tertiary)] mt-1">Use {"{customer_name}"}, {"{invoice_number}"}, {"{total}"}, {"{due_date}"} as placeholders.</p>
        </div>

        <div className="form-group">
          <label className="form-label">Reminder Email Body</label>
          <textarea
            className="form-input"
            rows={4}
            value={settings.reminder_template_body || ''}
            onChange={e => update('reminder_template_body', e.target.value || null)}
            placeholder="Dear {customer_name},&#10;&#10;This is a reminder that invoice {invoice_number} for ${total} is due on {due_date}.&#10;&#10;Please remit payment at your earliest convenience."
          />
          <p className="text-[10px] text-[var(--text-tertiary)] mt-1">Use {"{customer_name}"}, {"{invoice_number}"}, {"{total}"}, {"{due_date}"} as placeholders.</p>
        </div>
      </div>

      {/* Invoice Defaults */}
      <div className="card space-y-4 p-5">
        <div className="flex items-center gap-2 mb-1">
          <FileText size={15} className="text-accent" />
          <h2 className="text-sm font-bold text-[var(--text-primary)]">Invoice Defaults</h2>
        </div>

        <div className="form-group">
          <label className="form-label">Default Invoice Terms</label>
          <textarea
            className="form-input"
            rows={3}
            value={settings.invoice_terms}
            onChange={e => update('invoice_terms', e.target.value)}
            placeholder="All sales are final. 14-day warranty on defects."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">Default Tax Rate (%)</label>
            <input
              type="number"
              step="0.01"
              className="form-input"
              value={settings.default_tax_rate}
              onChange={e => update('default_tax_rate', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Currency</label>
            <select className="form-input" value={settings.currency} onChange={e => update('currency', e.target.value)}>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="CAD">CAD (C$)</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Timezone</label>
          <select className="form-input" value={settings.timezone} onChange={e => update('timezone', e.target.value)}>
            <option value="America/Chicago">Central (America/Chicago)</option>
            <option value="America/New_York">Eastern (America/New_York)</option>
            <option value="America/Denver">Mountain (America/Denver)</option>
            <option value="America/Los_Angeles">Pacific (America/Los_Angeles)</option>
            <option value="America/Anchorage">Alaska (America/Anchorage)</option>
            <option value="Pacific/Honolulu">Hawaii (Pacific/Honolulu)</option>
          </select>
        </div>
      </div>

      {/* Save Footer */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-primary flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 w-full justify-center"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        Save All Settings
      </button>
    </div>
  );
}
