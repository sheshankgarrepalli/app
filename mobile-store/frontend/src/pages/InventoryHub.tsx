import { useSearchParams } from 'react-router-dom';
import CentralInventory from './CentralInventory';
import PartsInventory from './PartsInventory';
import AuctionImporter from './AuctionImporter';
import BulkTransfer from './BulkTransfer';
import ReceiveInventory from './ReceiveInventory';
import TrackDevice from './TrackDevice';

export default function InventoryHub() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'devices';

    const tabs = [
        { id: 'devices', label: 'Device Search' },
        { id: 'parts', label: 'Parts Stock' },
        { id: 'tracker', label: 'Device Tracker' },
        { id: 'import', label: 'Bulk Importer' },
        { id: 'routing', label: 'Chain of Custody' }
    ];

    const setActiveTab = (id: string) => {
        setSearchParams({ tab: id });
    };

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
                {activeTab === 'devices' && <CentralInventory />}
                {activeTab === 'parts' && <PartsInventory />}
                {activeTab === 'tracker' && <TrackDevice />}
                {activeTab === 'import' && <AuctionImporter />}
                {activeTab === 'routing' && (
                    <div className="grid grid-cols-1 divide-y divide-zinc-200">
                        <BulkTransfer />
                        <div className="border-t-8 border-zinc-50" />
                        <ReceiveInventory />
                    </div>
                )}
            </div>
        </div>
    );
}
