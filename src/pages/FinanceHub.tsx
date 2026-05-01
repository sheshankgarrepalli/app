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
        <div className="space-y-0">
            <div className="bg-white dark:bg-[#141416] border-b border-[#e5e7eb] dark:border-[#1f1f21] px-6 pt-6">
                <div className="flex gap-8">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`pb-3 text-xs font-semibold uppercase tracking-wider transition-all relative ${activeTab === tab.id ? 'text-[#1f2937] dark:text-[#e4e4e7]' : 'text-[#6b7280] dark:text-[#71717a] hover:text-[#1f2937] dark:text-[#e4e4e7]'
                            }`}
                        >
                            {tab.label}
                            {activeTab === tab.id && (
                                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-accent" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                {activeTab === 'invoices' && <InvoicesDashboard />}
                {activeTab === 'deep_search' && <InvoiceManagement />}
                {activeTab === 'credit' && <CRMDirectory />}
                {activeTab === 'profit' && (
                    <div className="p-32 text-center text-[#9ca3af] dark:text-[#52525b] uppercase tracking-widest font-bold">
                        Profitability & COGS Engine Under Construction
                    </div>
                )}
                {activeTab === 'zreport' && (
                    <div className="p-32 text-center text-[#9ca3af] dark:text-[#52525b] uppercase tracking-widest font-bold">
                        Daily Z-Report Module Under Construction
                    </div>
                )}
            </div>
        </div>
    );
}
