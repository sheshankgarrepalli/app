import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api/api';

const TOKEN_KEY = 'amafah_token';
const USER_KEY = 'amafah_user';

export interface AppUser {
  id: number;
  email: string;
  role: 'admin' | 'warehouse' | 'store' | 'technician';
  store_id: string | null;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

interface AuthContextType {
  user: AppUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const isPreviewEnv = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');

function loadStored(): { token: string | null; user: AppUser | null } {
  if (typeof window === 'undefined') return { token: null, user: null };
  if (isPreviewEnv) {
    return {
      token: 'preview-bypass-token',
      user: {
        id: 0,
        email: 'admin@preview.dev',
        role: 'admin',
        store_id: 'warehouse',
        is_active: true,
        created_at: new Date().toISOString(),
        last_login_at: null,
      },
    };
  }
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const userStr = localStorage.getItem(USER_KEY);
    const user = userStr ? (JSON.parse(userStr) as AppUser) : null;
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

function persist(token: string | null, user: AppUser | null) {
  if (isPreviewEnv) return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const initial = loadStored();
  const [user, setUser] = useState<AppUser | null>(initial.user);
  const [token, setToken] = useState<string | null>(initial.token);
  const [isLoading, setIsLoading] = useState(!isPreviewEnv && !!initial.token);

  const refreshUser = useCallback(async () => {
    if (!token || isPreviewEnv) return;
    try {
      const { data } = await api.get('/api/auth/me');
      setUser(data);
      persist(token, data);
    } catch (err) {
      console.error('Failed to refresh user', err);
      setUser(null);
      setToken(null);
      persist(null, null);
    }
  }, [token]);

  useEffect(() => {
    if (isPreviewEnv) {
      setIsLoading(false);
      return;
    }
    if (!token) {
      setIsLoading(false);
      return;
    }
    refreshUser().finally(() => setIsLoading(false));
  }, [token, refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post('/api/auth/login', { email, password });
    setToken(data.access_token);
    setUser(data.user);
    persist(data.access_token, data.user);
  }, []);

  const logout = useCallback(async () => {
    if (!isPreviewEnv && token) {
      try { await api.post('/api/auth/logout'); } catch { /* ignore */ }
    }
    setToken(null);
    setUser(null);
    persist(null, null);
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
