import { useState } from 'react';
import InvoicesDashboard from './InvoicesDashboard';
import CRMDirectory from './CRMDirectory';
import InvoiceManagement from './InvoiceManagement';

export default function FinanceHub() {
    const [activeTab, setActiveTab] = useState('invoices');

    const tabs = [
        { id: 'invoices', label: 'Invoices & Payments' },
        { id: 'deep_search', label: 'Deep Search Manager' },
        { id: 'credit', label: 'B2B Credit Ledgers' },
        { id: 'profit', label: 'Profitability & COGS' },
        { id: 'zreport', label: 'Daily Z-Reports' }
    ];

    return (
        <div className="min-h-screen bg-zinc-50">
            <div className="bg-white border-b border-zinc-200 px-8 pt-8">
                <div className="flex gap-12">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`pb-4 text-xs font-semibold uppercase tracking-[0.1em] transition-all relative ${activeTab === tab.id ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'
                                }`}
                        >
                            {tab.label}
                            {activeTab === tab.id && (
                                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-zinc-900 animate-in fade-in slide-in-from-bottom-1" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-0">
                {activeTab === 'invoices' && <InvoicesDashboard />}
                {activeTab === 'deep_search' && <InvoiceManagement />}
                {activeTab === 'credit' && <CRMDirectory />}
                {activeTab === 'profit' && (
                    <div className="p-32 text-center text-zinc-300 uppercase tracking-[0.4em] font-bold">
                        Profitability & COGS Engine Under Construction
                    </div>
                )}
                {activeTab === 'zreport' && (
                    <div className="p-32 text-center text-zinc-300 uppercase tracking-[0.4em] font-bold">
                        Daily Z-Report Module Under Construction
                    </div>
                )}
            </div>
        </div>
    );
}
