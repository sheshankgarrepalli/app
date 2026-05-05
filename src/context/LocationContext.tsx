import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
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
    const { token } = useAuth();
    const [selectedLocationId, setSelectedLocationIdRaw] = useState<string | null>(() => {
        return localStorage.getItem('selectedLocationId') || null;
    });
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

    useEffect(() => {
        if (!token) return;
        const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
        setLoading(true);
        axios.get(`${apiUrl}/api/inventory/stores`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(res => setAvailableLocations(res.data || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [token]);

    return (
        <LocationContext.Provider value={{ selectedLocationId, setSelectedLocationId, availableLocations, loading }}>
            {children}
        </LocationContext.Provider>
    );
}

export function useLocationFilter() {
    return useContext(LocationContext);
}
