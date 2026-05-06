import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ClerkLoading, useUser, useOrganization, OrganizationList, RedirectToSignIn } from '@clerk/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LocationProvider } from './context/LocationContext';
import { AxiosInterceptor } from './api/AxiosInterceptor';
import Login from './pages/Login';
import Layout from './components/Layout';
import ManualIntake from './pages/ManualIntake';
import PhoneRouting from './pages/PhoneRouting';
import RapidAudit from './pages/RapidAudit';
import Inventory from './pages/Inventory';
import IncomingTransfers from './pages/IncomingTransfers';
import QC from './pages/QC';
import Repairs from './pages/Repairs';
import Track from './pages/Track';

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: string[] }) => {
  const { isSignedIn, isLoaded: isUserLoaded } = useUser();
  const { organization, isLoaded: isOrgLoaded } = useOrganization();
  const { user, isLoading } = useAuth();
  
  if (!isUserLoaded || !isOrgLoaded || isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-gray-500 animate-pulse">Loading Security...</p>
        </div>
      </div>
    );
  }

  // Tier 1: Not Authenticated
  if (!isSignedIn) {
    return <RedirectToSignIn />;
  }

  // Tier 2: Authenticated, but No Org
  if (!organization) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <OrganizationList hidePersonal={true} />
      </div>
    );
  }

  // Tier 3: Fully Authenticated & Org Active
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  
  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <Router>
      <ClerkLoading>
        <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-gray-500 animate-pulse">Initializing System...</p>
          </div>
        </div>
      </ClerkLoading>
      
      <ThemeProvider>
        <AuthProvider>
          <LocationProvider>
            <AxiosInterceptor>
              <AuthRoutes />
            </AxiosInterceptor>
          </LocationProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

function AuthRoutes() {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded) return null; // ClerkLoading handled above

  return (
    <Routes>
      {/* Public Login Route */}
      <Route path="/login/*" element={
        !isSignedIn ? <Login /> : <Navigate to="/" replace />
      } />

      {/* Root Redirector */}
      <Route path="/" element={
        isSignedIn ? <AuthWrapper /> : <Navigate to="/login" replace />
      } />

      {/* Core Operations Routes */}
      <Route path="/admin/manual-intake" element={<ProtectedRoute allowedRoles={['admin', 'warehouse', 'store']}><ManualIntake /></ProtectedRoute>} />
      <Route path="/admin/phone-routing" element={<ProtectedRoute allowedRoles={['admin', 'warehouse', 'store']}><PhoneRouting /></ProtectedRoute>} />
      <Route path="/admin/rapid-audit" element={<ProtectedRoute allowedRoles={['admin', 'warehouse', 'store']}><RapidAudit /></ProtectedRoute>} />
      <Route path="/admin/qc" element={<ProtectedRoute allowedRoles={['admin']}><QC /></ProtectedRoute>} />
      <Route path="/admin/repairs" element={<ProtectedRoute allowedRoles={['admin']}><Repairs /></ProtectedRoute>} />
      <Route path="/admin/track" element={<ProtectedRoute allowedRoles={['admin', 'warehouse', 'store', 'technician']}><Track /></ProtectedRoute>} />

      {/* Inventory Routes */}
      <Route path="/admin/inventory" element={<ProtectedRoute allowedRoles={['admin', 'warehouse', 'store']}><Inventory /></ProtectedRoute>} />
      <Route path="/admin/incoming-transfers" element={<ProtectedRoute allowedRoles={['admin', 'warehouse', 'store']}><IncomingTransfers /></ProtectedRoute>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AuthWrapper() {
  const { isSignedIn, isLoaded: isUserLoaded } = useUser();
  const { organization, isLoaded: isOrgLoaded } = useOrganization();
  const { user, isLoading } = useAuth();
  
  if (!isUserLoaded || !isOrgLoaded || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-zinc-400 text-xs font-black uppercase tracking-widest">Synchronizing Identity...</div>
      </div>
    );
  }

  // Tier 1: Not Authenticated
  if (!isSignedIn) {
    return <RedirectToSignIn />;
  }

  // Tier 2: Authenticated, but No Org
  if (!organization) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <OrganizationList hidePersonal={true} />
      </div>
    );
  }

  // Tier 3: Fully Authenticated & Org Active
  if (!user) return <Navigate to="/login" replace />;

  if (user.role === 'admin') return <Navigate to="/admin/inventory" replace />;
  if (user.role === 'warehouse') return <Navigate to="/admin/inventory" replace />;
  if (user.role === 'technician') return <Navigate to="/admin/rapid-audit" replace />;
  return <Navigate to="/admin/inventory" replace />;
}

export default App;
