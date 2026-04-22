import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Terminal } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6 selection:bg-zinc-200">
                    <div className="w-full max-w-2xl bg-white border border-zinc-200 shadow-2xl rounded-lg overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="p-12 space-y-10">
                            <div className="flex items-center gap-4 text-rose-600">
                                <div className="p-3 bg-rose-50 rounded-full border border-rose-100">
                                    <AlertCircle size={32} />
                                </div>
                                <div>
                                    <h1 className="text-xl font-black uppercase tracking-[0.2em] text-zinc-900">System Interruption</h1>
                                    <p className="text-[10px] font-bold text-zinc-400 tracking-widest uppercase mt-1">Runtime Exception Detected</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                    <Terminal size={12} /> Error Message
                                </div>
                                <div className="p-6 bg-zinc-900 rounded-md border border-zinc-800 shadow-inner">
                                    <code className="text-rose-400 font-mono text-sm break-all leading-relaxed">
                                        {this.state.error?.message || 'An unknown error occurred during execution.'}
                                    </code>
                                </div>
                            </div>

                            {this.state.errorInfo && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                        <Terminal size={12} /> Component Stack Trace
                                    </div>
                                    <div className="p-6 bg-zinc-50 rounded-md border border-zinc-200 max-h-48 overflow-auto">
                                        <pre className="text-[10px] font-mono text-zinc-500 leading-relaxed">
                                            {this.state.errorInfo.componentStack}
                                        </pre>
                                    </div>
                                </div>
                            )}

                            <div className="pt-6 border-t border-zinc-100 flex justify-between items-center">
                                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                                    Internal Telemetry Logged • Authorized Personnel Only
                                </p>
                                <button
                                    onClick={() => window.location.reload()}
                                    className="btn-primary px-8 py-3 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2"
                                >
                                    <RefreshCw size={14} /> Restart Terminal
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
