import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/api';
import { useAuth } from './AuthContext';

interface StoreLocation {
    id: string;
    name: string;
    location_type: string;
    address?: string;
}

interface LocationContextType {
    selectedLocationId: string | null;
    setSelectedLocationId: (id: string | null) => void;
    availableLocations: StoreLocation[];
    loading: boolean;
}

const LocationContext = createContext<LocationContextType>({
    selectedLocationId: null,
    setSelectedLocationId: () => {},
    availableLocations: [],
    loading: false,
});

export function LocationProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [selectedLocationId, setSelectedLocationIdRaw] = useState<string | null>(() => {
        return localStorage.getItem('selectedLocationId') || null;
    });
    const [availableLocations, setAvailableLocations] = useState<StoreLocation[]>([]);
    const [loading, setLoading] = useState(false);
    const [initialized, setInitialized] = useState(false);

    const setSelectedLocationId = useCallback((id: string | null) => {
        setSelectedLocationIdRaw(id);
        if (id) {
            localStorage.setItem('selectedLocationId', id);
        } else {
            localStorage.removeItem('selectedLocationId');
        }
    }, []);

    // Auto-select user's store on first load for non-admin users
    useEffect(() => {
        if (initialized || !user) return;
        if (user.role !== 'admin' && user.store_id) {
            const stored = localStorage.getItem('selectedLocationId');
            if (!stored || stored === 'all') {
                setSelectedLocationId(user.store_id);
            }
        }
        setInitialized(true);
    }, [user, initialized, setSelectedLocationId]);

    useEffect(() => {
        setLoading(true);
        api.get(`/api/inventory/stores`, {})
            .then(res => setAvailableLocations(res.data || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    return (
        <LocationContext.Provider value={{ selectedLocationId, setSelectedLocationId, availableLocations, loading }}>
            {children}
        </LocationContext.Provider>
    );
}

export function useLocationFilter() {
    return useContext(LocationContext);
}
