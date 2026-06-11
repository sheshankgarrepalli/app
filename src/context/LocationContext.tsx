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
    const getInitial = (): string | null => {
        if (user && user.role !== 'admin' && user.store_id) {
            return user.store_id;
        }
        return localStorage.getItem('selectedLocationId') || null;
    };
    const [selectedLocationId, setSelectedLocationIdRaw] = useState<string | null>(getInitial);
    const [availableLocations, setAvailableLocations] = useState<StoreLocation[]>([]);
    const [loading, setLoading] = useState(false);

    const setSelectedLocationId = useCallback((id: string | null) => {
        setSelectedLocationIdRaw(id);
        if (id) {
            localStorage.setItem('selectedLocationId', id);
        } else {
            localStorage.removeItem('selectedLocationId');
        }
    }, []);

    // Lock non-admin users to their store whenever user changes
    useEffect(() => {
        if (user && user.role !== 'admin' && user.store_id) {
            setSelectedLocationId(user.store_id);
        }
    }, [user?.store_id, user?.role]);

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
