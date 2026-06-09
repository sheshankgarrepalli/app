import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { fetchModels, PhoneModel } from '../api/models';

interface Props {
  value: string;
  onChange: (modelNumber: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function ModelSelector({ value, onChange, placeholder = 'Search models...', className = '', disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<PhoneModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const models = await fetchModels(q);
      setOptions(models);
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      search(query);
    }
  }, [open, query, search]);

  useEffect(() => {
    if (!value) {
      setSelectedLabel('');
      return;
    }
    fetchModels(value).then(models => {
      const m = models.find(o => o.model_number === value);
      if (m) setSelectedLabel(`${m.brand} ${m.name} — ${m.storage_gb}GB`);
    }).catch(() => {});
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-sm cursor-pointer min-h-[38px] ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => !disabled && setOpen(o => !o)}
      >
        <Search size={14} className="text-[var(--text-tertiary)] flex-shrink-0" />
        <span className={`flex-1 truncate ${selectedLabel ? 'text-[var(--text)]' : 'text-[var(--text-tertiary)]'}`}>
          {selectedLabel || placeholder}
        </span>
        {value && !disabled && (
          <button
            onClick={e => { e.stopPropagation(); onChange(''); setSelectedLabel(''); }}
            className="text-[var(--text-tertiary)] hover:text-[var(--text)]"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-lg z-50 max-h-60 overflow-hidden">
          <div className="p-2 border-b border-[var(--border)]">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Type to search..."
              className="w-full bg-transparent border-none outline-none text-sm text-[var(--text)] placeholder:text-[var(--text-tertiary)]"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-48">
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 size={16} className="animate-spin text-[var(--text-tertiary)]" />
              </div>
            ) : options.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-[var(--text-tertiary)]">
                {query ? 'No models found' : 'Start typing to search'}
              </div>
            ) : (
              options.map(m => (
                <button
                  key={m.model_number}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-muted)] transition-colors flex items-center gap-2"
                  onClick={() => {
                    onChange(m.model_number);
                    setSelectedLabel(`${m.brand} ${m.name} — ${m.storage_gb}GB`);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <span className="text-[var(--text)] flex-1 truncate">
                    <span className="font-medium">{m.brand} {m.name}</span>
                    <span className="text-[var(--text-tertiary)] ml-1">{m.storage_gb}GB</span>
                  </span>
                  {m.color && (
                    <span className="text-[10px] text-[var(--text-tertiary)]">{m.color}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
