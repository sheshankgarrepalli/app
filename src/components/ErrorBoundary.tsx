import { Component, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props { children: ReactNode; }

interface State { hasError: boolean; error: Error | null; }

class ErrorBoundary extends Component<Props, State> {
    public state: State = { hasError: false, error: null };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error) {
        console.error('Uncaught error:', error);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-6">
                    <div className="w-full max-w-lg bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-lg overflow-hidden">
                        <div className="p-8 space-y-6">
                            <div className="flex items-center gap-3 text-[var(--destructive)]">
                                <div className="p-2.5 bg-red-50 rounded-lg">
                                    <AlertCircle size={24} />
                                </div>
                                <div>
                                    <h1 className="text-base font-bold text-[var(--text)]">Something went wrong</h1>
                                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5">An unexpected error occurred</p>
                                </div>
                            </div>

                            <div className="p-4 bg-[var(--bg-muted)] rounded-lg border border-[var(--border)]">
                                <code className="text-[var(--destructive)] font-mono text-sm break-all">
                                    {this.state.error?.message || 'Unknown error'}
                                </code>
                            </div>

                            <div className="flex justify-end pt-4 border-t border-[var(--border)]">
                                <button
                                    onClick={() => {
                                        this.setState({ hasError: false, error: null });
                                        window.location.reload();
                                    }}
                                    className="btn-primary px-6 py-2.5 text-sm font-bold flex items-center gap-2"
                                >
                                    <RefreshCw size={14} /> Reload Page
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
