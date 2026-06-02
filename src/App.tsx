import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ClerkLoading, useUser, useOrganization, OrganizationList, RedirectToSignIn } from '@clerk/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LocationProvider } from './context/LocationContext';
import { AxiosInterceptor } from './api/AxiosInterceptor';
import Login from './pages/Login';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import ManualIntake from './pages/ManualIntake';
import PhoneRouting from './pages/PhoneRouting';
import RapidAudit from './pages/RapidAudit';
import Inventory from './pages/Inventory';
import IncomingTransfers from './pages/IncomingTransfers';
import QC from './pages/QC';
import Repairs from './pages/Repairs';
import Track from './pages/Track';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Consignments from './pages/Consignments';
import ConsignmentDetail from './pages/ConsignmentDetail';
import PublicInvoice from './pages/PublicInvoice';
import InvoiceForm from './pages/InvoiceForm';
import InvoicesList from './pages/InvoicesList';
import InvoiceDetail from './pages/InvoiceDetail';
import Settings from './pages/Settings';
import ExcelImport from './pages/ExcelImport';
import Analytics from './pages/Analytics';
import SkuGenerator from './pages/SkuGenerator';

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
  
  return <Layout><ErrorBoundary>{children}</ErrorBoundary></Layout>;
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
      <Route path="/admin/import-inventory" element={<ProtectedRoute allowedRoles={['admin', 'warehouse', 'store']}><ExcelImport /></ProtectedRoute>} />
      <Route path="/admin/incoming-transfers" element={<ProtectedRoute allowedRoles={['admin', 'warehouse', 'store']}><IncomingTransfers /></ProtectedRoute>} />
      <Route path="/admin/sku-generator" element={<ProtectedRoute allowedRoles={['admin', 'warehouse', 'store']}><SkuGenerator /></ProtectedRoute>} />

      {/* CRM Routes */}
      <Route path="/admin/customers" element={<ProtectedRoute allowedRoles={['admin', 'warehouse', 'store']}><Customers /></ProtectedRoute>} />
      <Route path="/admin/customers/:crmId" element={<ProtectedRoute allowedRoles={['admin', 'warehouse', 'store']}><CustomerDetail /></ProtectedRoute>} />
      <Route path="/admin/consignments" element={<ProtectedRoute allowedRoles={['admin', 'warehouse', 'store']}><Consignments /></ProtectedRoute>} />
      <Route path="/admin/consignments/:batchId" element={<ProtectedRoute allowedRoles={['admin', 'warehouse', 'store']}><ConsignmentDetail /></ProtectedRoute>} />

      {/* Invoice Routes */}
      <Route path="/admin/invoices" element={<ProtectedRoute allowedRoles={['admin', 'store']}><InvoicesList /></ProtectedRoute>} />
      <Route path="/admin/invoices/new" element={<ProtectedRoute allowedRoles={['admin', 'store']}><InvoiceForm /></ProtectedRoute>} />
      <Route path="/admin/invoices/:invoiceNumber/edit" element={<ProtectedRoute allowedRoles={['admin', 'store']}><InvoiceForm /></ProtectedRoute>} />
      <Route path="/admin/invoices/:invoiceNumber" element={<ProtectedRoute allowedRoles={['admin', 'store']}><InvoiceDetail /></ProtectedRoute>} />

      {/* Settings Route */}
      <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={['admin']}><Settings /></ProtectedRoute>} />

      {/* Reports Routes */}
      <Route path="/admin/analytics" element={<ProtectedRoute allowedRoles={['admin']}><Analytics /></ProtectedRoute>} />

      {/* Public Invoice Route — no auth */}
      <Route path="/invoice/:shareToken" element={<ErrorBoundary><PublicInvoice /></ErrorBoundary>} />

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
