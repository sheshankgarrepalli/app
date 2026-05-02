import { CheckCircle2, X } from 'lucide-react';

interface SuccessBannerProps {
  message: string;
  onDismiss?: () => void;
}

export default function SuccessBanner({ message, onDismiss }: SuccessBannerProps) {
  return (
    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-sm text-green-700 dark:text-green-400 flex justify-between items-center">
      <span className="flex items-center gap-2">
        <CheckCircle2 size={14} /> {message}
      </span>
      {onDismiss && (
        <button onClick={onDismiss} className="text-green-400 hover:text-green-600 dark:hover:text-green-300 transition-colors">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
