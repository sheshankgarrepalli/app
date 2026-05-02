import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  reasonInput?: boolean;
  reasonPlaceholder?: string;
  reasonValue?: string;
  onReasonChange?: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  reasonInput = false,
  reasonPlaceholder = 'Enter reason...',
  reasonValue = '',
  onReasonChange,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const confirmColors = {
    danger: 'bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25',
    warning: 'bg-amber-500/15 border border-amber-500/25 text-amber-400 hover:bg-amber-500/25',
    default: 'bg-accent hover:bg-accent/90 text-white',
  };

  const titleColor = variant === 'danger' ? 'text-red-400' : variant === 'warning' ? 'text-amber-400' : 'text-zinc-900 dark:text-[#e4e4e7]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#141416] w-full max-w-md rounded-lg shadow-2xl border border-zinc-200 dark:border-[#1f1f21] overflow-hidden">
        <div className="p-5 border-b border-zinc-100 dark:border-[#1a1a1c] flex justify-between items-center">
          <div>
            <h2 className={`text-sm font-bold uppercase tracking-wide ${titleColor}`}>{title}</h2>
            {(variant === 'danger' || variant === 'warning') && (
              <p className="text-[10px] font-semibold text-zinc-400 dark:text-[#71717a] uppercase tracking-widest mt-0.5">
                This action is irreversible
              </p>
            )}
          </div>
          <button onClick={onCancel} className="text-zinc-400 dark:text-[#71717a] hover:text-zinc-900 dark:hover:text-[#e4e4e7] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-zinc-500 dark:text-[#71717a] font-medium">{description}</p>

          {reasonInput && onReasonChange && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#71717a] ml-1">Reason</label>
              <input
                value={reasonValue}
                onChange={e => onReasonChange(e.target.value)}
                placeholder={reasonPlaceholder}
                className="input-stark w-full py-3 text-xs font-semibold placeholder:text-[11px] placeholder:font-medium placeholder:text-zinc-400 dark:placeholder:text-[#52525b]"
                autoFocus
              />
            </div>
          )}
        </div>

        <div className="p-5 border-t border-zinc-100 dark:border-[#1a1a1c] flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-zinc-200 dark:border-[#1f1f21] text-zinc-500 dark:text-[#71717a] hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-2 ${confirmColors[variant]}`}
          >
            {(variant === 'danger' || variant === 'warning') && <AlertTriangle size={14} />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
