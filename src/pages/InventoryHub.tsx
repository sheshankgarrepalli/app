import { useSearchParams } from 'react-router-dom';
import CentralInventory from './CentralInventory';
import InventoryManager from './InventoryManager';
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
        <div className="space-y-0">
            <div className="bg-white dark:bg-[#0c0c0e] border-b border-[#e5e7eb] dark:border-[#1a1a1c] px-6 pt-6">
                <div className="flex gap-8">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`pb-3 text-xs font-semibold uppercase tracking-wider transition-all relative ${
                                activeTab === tab.id ? 'text-[#1f2937] dark:text-[#e4e4e7]' : 'text-[#6b7280] dark:text-[#71717a] hover:text-[#1f2937] dark:hover:text-[#e4e4e7]'
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
                {activeTab === 'devices' && <CentralInventory />}
                {activeTab === 'parts' && <InventoryManager />}
                {activeTab === 'tracker' && <TrackDevice />}
                {activeTab === 'import' && <AuctionImporter />}
                {activeTab === 'routing' && (
                    <div>
                        <BulkTransfer />
                        <ReceiveInventory />
                    </div>
                )}
            </div>
        </div>
    );
}
