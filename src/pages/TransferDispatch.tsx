import React, { useState } from 'react';
import api from '../api/api';
import { PrintableView } from '../components/PrintableView';
import TransferAnimation from '../components/TransferAnimation';

export const TransferDispatch = () => {
  const [imeiInput, setImeiInput] = useState('');
  const [scannedImeis, setScannedImeis] = useState<{ imei: string; status: string }[]>([]);
  const [destination, setDestination] = useState('');
  const [courierName, setCourierName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);
  const [manifestData, setManifestData] = useState<any | null>(null);

  const handleScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const imei = imeiInput.trim();
      if (!imei) return;

      // Prevent duplicate scans
      if (scannedImeis.find(i => i.imei === imei)) {
        setError(`IMEI ${imei} is already scanned.`);
        setImeiInput('');
        return;
      }

      try {
        setError(null);
        // Fetch device status
        const response = await api.get(`/inventory/${imei}`);
        const status = response.data.device_status;

        if (status === 'In_Transit' || status === 'Sold') {
          setError(`Cannot dispatch IMEI ${imei}. Current status: ${status}`);
        } else {
          setScannedImeis(prev => [...prev, { imei, status }]);
        }
      } catch (err: any) {
        if (err.response?.status === 404) {
          setError(`IMEI ${imei} not found in inventory.`);
        } else {
          setError(`Error checking IMEI ${imei}.`);
        }
      }
      setImeiInput('');
    }
  };

  const removeImei = (imeiToRemove: string) => {
    setScannedImeis(prev => prev.filter(i => i.imei !== imeiToRemove));
  };

  const executeDispatch = async () => {
    setShowAnimation(false);
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await api.post('/transfers/dispatch', {
        imeis: scannedImeis.map(i => i.imei),
        destination,
        courier_name: courierName
      });

      setManifestData(response.data);
      setTimeout(() => {
        window.print();
        setScannedImeis([]);
        setImeiInput('');
        setDestination('');
        setCourierName('');
      }, 500);

    } catch (err: any) {
      setError(err.response?.data?.detail || 'An error occurred during dispatch.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDispatch = () => {
    if (scannedImeis.length === 0) {
      setError('Please scan at least one IMEI.');
      return;
    }
    if (!destination) {
      setError('Please select a destination.');
      return;
    }

    setError(null);
    setShowAnimation(true);
  };

  // If manifestData exists, we still render the main UI hidden so print CSS works
  return (
    <div className="p-6">
      <TransferAnimation isActive={showAnimation} onComplete={executeDispatch} />

      {manifestData && (
        <PrintableView
          manifestId={manifestData.manifest_id}
          origin={manifestData.origin_id}
          destination={manifestData.destination_id}
          courierName={manifestData.courier_name || ''}
          imeis={manifestData.items.map((i: any) => i.imei)}
        />
      )}

      <div className="max-w-4xl mx-auto print:hidden">
        <div className="page-header mb-6">
          <h1 className="page-title">Transfer Dispatch</h1>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded-md mb-6 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <div className="card-header">Dispatch Box</div>
            <div className="card-body space-y-4">
              <div className="form-group">
                <label className="form-label">Scan IMEI</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Scan or type IMEI and press Enter"
                  value={imeiInput}
                  onChange={e => setImeiInput(e.target.value)}
                  onKeyDown={handleScan}
                  disabled={isSubmitting}
                  autoFocus
                />
              </div>

              <div>
                <h3 className="text-sm font-medium text-[#1f2937] dark:text-[#e4e4e7] mb-2">Scanned Items ({scannedImeis.length})</h3>
                <div className="max-h-64 overflow-y-auto border border-[#e5e7eb] dark:border-[#1f1f21] rounded-md">
                  {scannedImeis.length === 0 ? (
                    <p className="text-[#6b7280] dark:text-[#71717a] text-sm text-center py-4">No items scanned.</p>
                  ) : (
                    <ul className="divide-y divide-[#e5e7eb]">
                      {scannedImeis.map((item) => (
                        <li key={item.imei} className="px-4 py-3 flex justify-between items-center bg-[#f5f5f5] dark:bg-[#0a0a0b]">
                          <div>
                            <span className="font-mono text-sm block">{item.imei}</span>
                            <span className="text-xs text-[#6b7280] dark:text-[#71717a]">Status: {item.status}</span>
                          </div>
                          <button
                            onClick={() => removeImei(item.imei)}
                            className="text-red-500 hover:text-red-700 text-sm font-medium"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">Transfer Details</div>
            <div className="card-body space-y-4">
              <div className="form-group">
                <label className="form-label">Destination Location ID</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., Store_B, Warehouse_Alpha"
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Courier Name (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., FedEx, John Doe"
                  value={courierName}
                  onChange={e => setCourierName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <button
                onClick={handleDispatch}
                disabled={isSubmitting || showAnimation || scannedImeis.length === 0 || !destination}
                className="btn-primary w-full justify-center py-3"
              >
                {isSubmitting ? 'Dispatching...' : 'Dispatch & Print Manifest'}
              </button>
              <p className="text-xs text-[#6b7280] dark:text-[#71717a] text-center">
                Items will instantly transition to 'In_Transit' status.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
