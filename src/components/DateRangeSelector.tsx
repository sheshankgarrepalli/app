import { Download } from 'lucide-react';

export const DATE_PRESETS = ['Today', 'This Week', 'This Month', '3 Months', '6 Months', 'All Time'] as const;
export type DatePreset = typeof DATE_PRESETS[number];

interface Props {
  value: string;
  onChange: (range: string) => void;
  onExport?: () => void;
  exportLabel?: string;
  presets?: readonly string[];
}

export default function DateRangeSelector({
  value,
  onChange,
  onExport,
  exportLabel = 'Export CSV',
  presets = DATE_PRESETS,
}: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex gap-1 p-1 rounded-lg bg-[var(--bg-muted)] border border-[var(--border)]">
        {presets.map(p => (
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
      {onExport && (
        <button
          onClick={onExport}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--bg-muted)] transition-colors"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          <Download size={14} /> {exportLabel}
        </button>
      )}
    </div>
  );
}
