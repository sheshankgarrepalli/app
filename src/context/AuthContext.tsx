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

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { user: clerkUser, isLoaded: isUserLoaded } = useUser();
  const { getToken, isLoaded: isAuthLoaded } = useClerkAuth();
  
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const syncAuth = async () => {
      if (!isUserLoaded || !isAuthLoaded) return;

      if (clerkUser) {
        try {
          const jwt = await getToken();
          setToken(jwt);

          // Extract role and store_id from Clerk public metadata
          const role = (clerkUser.publicMetadata.role as string) || 'store_a';
          const store_id = (clerkUser.publicMetadata.store_id as string) || null;
          const email = clerkUser.primaryEmailAddress?.emailAddress || '';

          setUser({
            id: clerkUser.id,
            email,
            role,
            store_id
          });
          
          // JWT is now handled by AxiosInterceptor
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
