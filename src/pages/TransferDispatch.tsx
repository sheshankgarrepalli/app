import React, { useState } from 'react';
import api from '../api/api';
import { PrintableView } from '../components/PrintableView';

export const TransferDispatch = () => {
  const [imeiInput, setImeiInput] = useState('');
  const [scannedImeis, setScannedImeis] = useState<{ imei: string; status: string }[]>([]);
  const [destination, setDestination] = useState('');
  const [courierName, setCourierName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handleDispatch = async () => {
    if (scannedImeis.length === 0) {
      setError('Please scan at least one IMEI.');
      return;
    }
    if (!destination) {
      setError('Please select a destination.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await api.post('/transfers/dispatch', {
        imeis: scannedImeis.map(i => i.imei),
        destination,
        courier_name: courierName
      });

      setManifestData(response.data);
      // Trigger print after a short delay to allow React to render the printable component
      setTimeout(() => {
        window.print();
        // Reset form after print dialogue opens
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

  // If manifestData exists, we still render the main UI hidden so print CSS works
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Print View Component */}
      {manifestData && (
        <PrintableView
          manifestId={manifestData.manifest_id}
          origin={manifestData.origin_id}
          destination={manifestData.destination_id}
          courierName={manifestData.courier_name || ''}
          imeis={manifestData.items.map((i: any) => i.imei)}
        />
      )}

      {/* Main UI */}
      <div className="max-w-4xl mx-auto print:hidden">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Transfer Dispatch</h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Dispatch Box Panel */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold mb-4">Dispatch Box</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Scan IMEI</label>
              <input
                type="text"
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2 border"
                placeholder="Scan or type IMEI and press Enter"
                value={imeiInput}
                onChange={e => setImeiInput(e.target.value)}
                onKeyDown={handleScan}
                disabled={isSubmitting}
                autoFocus
              />
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Scanned Items ({scannedImeis.length})</h3>
              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md">
                {scannedImeis.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No items scanned.</p>
                ) : (
                  <ul className="divide-y divide-gray-200">
                    {scannedImeis.map((item) => (
                      <li key={item.imei} className="px-4 py-3 flex justify-between items-center bg-gray-50">
                        <div>
                          <span className="font-mono text-sm block">{item.imei}</span>
                          <span className="text-xs text-gray-500">Status: {item.status}</span>
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

          {/* Details Panel */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold mb-4">Transfer Details</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination Location ID</label>
              <input
                type="text"
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2 border"
                placeholder="e.g., Store_B, Warehouse_Alpha"
                value={destination}
                onChange={e => setDestination(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Courier Name (Optional)</label>
              <input
                type="text"
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2 border"
                placeholder="e.g., FedEx, John Doe"
                value={courierName}
                onChange={e => setCourierName(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <button
              onClick={handleDispatch}
              disabled={isSubmitting || scannedImeis.length === 0 || !destination}
              className={`w-full py-3 px-4 border border-transparent rounded-md shadow-sm text-white font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                isSubmitting || scannedImeis.length === 0 || !destination
                  ? 'bg-blue-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSubmitting ? 'Dispatching...' : 'Dispatch & Print Manifest'}
            </button>
            <p className="text-xs text-gray-500 mt-3 text-center">
              Items will instantly transition to 'In_Transit' status.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
