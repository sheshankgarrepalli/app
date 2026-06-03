import React, { createContext, useContext, useEffect, useState } from 'react';
import { useUser, useAuth as useClerkAuth } from '@clerk/react';

interface User {
  id: string;
  email: string;
  role: string;
  store_id: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const IS_PREVIEW = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { user: clerkUser, isLoaded: isUserLoaded } = useUser();
  const { getToken, isLoaded: isAuthLoaded } = useClerkAuth();

  const [user, setUser] = useState<User | null>(() => {
    if (IS_PREVIEW) return { id: 'preview', email: 'admin@preview.dev', role: 'admin', store_id: 'warehouse' };
    return null;
  });
  const [token, setToken] = useState<string | null>(() => {
    if (IS_PREVIEW) return 'preview-bypass-token';
    return null;
  });
  const [isLoading, setIsLoading] = useState(!IS_PREVIEW);

  useEffect(() => {
    if (IS_PREVIEW) return;
    const syncAuth = async () => {
      if (!isUserLoaded || !isAuthLoaded) return;

      if (clerkUser) {
        try {
          const jwt = await getToken();
          setToken(jwt);

          const rawRole = (clerkUser.publicMetadata.role as string) || 'store';
          const legacyMap: Record<string, string> = {
            store_a: 'store', store_b: 'store', store_c: 'store',
            owner: 'admin'
          };
          const role = legacyMap[rawRole] || rawRole;
          const store_id = (clerkUser.publicMetadata.store_id as string) || null;
          const email = clerkUser.primaryEmailAddress?.emailAddress || '';

          setUser({
            id: clerkUser.id,
            email,
            role,
            store_id
          });
        } catch (error) {
          console.error("Failed to sync Clerk auth:", error);
          setToken(null);
          setUser(null);
        }
      } else {
        setToken(null);
        setUser(null);
      }
      setIsLoading(false);
    };

    syncAuth();
  }, [clerkUser, isUserLoaded, isAuthLoaded, getToken]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
