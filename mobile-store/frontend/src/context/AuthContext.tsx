import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth as useClerkAuth, useUser } from '@clerk/clerk-react';

interface User {
  id: number;
  clerk_id: string;
  email: string;
  role: string;
  store_id: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { getToken, isLoaded: isAuthLoaded, signOut } = useClerkAuth();
  const { user: clerkUser, isLoaded: isUserLoaded } = useUser();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      if (isAuthLoaded && isUserLoaded) {
        if (clerkUser) {
          const clerkToken = await getToken();
          setToken(clerkToken);

          // Fetch additional user data from our backend if needed
          // For now, we'll map Clerk user data directly
          setUser({
            id: 0, // Placeholder
            clerk_id: clerkUser.id,
            email: clerkUser.primaryEmailAddress?.emailAddress || "",
            role: (clerkUser.publicMetadata.role as string) || "user",
            store_id: (clerkUser.publicMetadata.store_id as string) || null,
          });
        } else {
          setToken(null);
          setUser(null);
        }
        setIsLoading(false);
      }
    };
    initAuth();
  }, [isAuthLoaded, isUserLoaded, clerkUser, getToken]);

  const login = (newToken: string) => {
    // Clerk handles login via its own components
    setToken(newToken);
  };

  const logout = () => {
    signOut();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
