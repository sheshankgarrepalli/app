import { Download } from 'lucide-react';

const PRESETS = ['Today', 'This Week', 'This Month', '3 Months', '6 Months', 'All Time'];

interface Props {
  value: string;
  onChange: (range: string) => void;
  onExport: () => void;
}

export default function DateRangeSelector({ value, onChange, onExport }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex gap-1 p-1 rounded-lg bg-[var(--bg-muted)] border border-[var(--border)]">
        {PRESETS.map(p => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors ${
              value === p
                ? 'bg-[var(--bg-card)] text-[var(--text)] shadow-sm'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {p}
          </button>
        ))}
      </div>
      <button
        onClick={onExport}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--bg-muted)] transition-colors"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        <Download size={14} /> Export CSV
      </button>
    </div>
  );
}
