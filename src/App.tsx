import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ClerkLoading, useUser, useOrganization, OrganizationList, RedirectToSignIn } from '@clerk/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AxiosInterceptor } from './api/AxiosInterceptor';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import CRMDirectory from './pages/CRMDirectory';
import POS from './pages/POS';
import ReceiveShipment from './pages/ReceiveShipment';
import TrackDevice from './pages/TrackDevice';
import Returns from './pages/Returns';
import RepairDashboard from './pages/RepairDashboard';
import InventoryHub from './pages/InventoryHub';
import FinanceHub from './pages/FinanceHub';
import QCTriage from './pages/QCTriage';
import TechKanban from './pages/TechKanban';
import Layout from './components/Layout';
import SystemAdmin from './pages/SystemAdmin';
import ManualIntake from './pages/ManualIntake';
import RapidAudit from './pages/RapidAudit';
import { TransferDispatch } from './pages/TransferDispatch';
import TeamSettings from './pages/Settings/TeamSettings';
import PartDetail from './pages/PartDetail';
import CentralInventory from './pages/CentralInventory';
import InvoiceForm from './pages/InvoiceForm';
import InvoiceManagement from './pages/InvoiceManagement';
import RecurringInvoices from './pages/RecurringInvoices';
import EstimateWorkflow from './pages/EstimateWorkflow';

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
          <AxiosInterceptor>
            <AuthRoutes />
          </AxiosInterceptor>
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

      {/* Protected Routes */}
      <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/inventory" element={<ProtectedRoute allowedRoles={['admin']}><InventoryHub /></ProtectedRoute>} />
      <Route path="/admin/finance" element={<ProtectedRoute allowedRoles={['admin']}><FinanceHub /></ProtectedRoute>} />
      <Route path="/admin/crm" element={<ProtectedRoute allowedRoles={['admin', 'store_a', 'store_b', 'store_c']}><CRMDirectory /></ProtectedRoute>} />
      <Route path="/admin/wholesale-checkout" element={<ProtectedRoute allowedRoles={['admin', 'store_a', 'store_b', 'store_c']}><POS /></ProtectedRoute>} />
      <Route path="/admin/manual-intake" element={<ProtectedRoute allowedRoles={['admin', 'store_a', 'store_b', 'store_c']}><ManualIntake /></ProtectedRoute>} />
      <Route path="/admin/rapid-audit" element={<ProtectedRoute allowedRoles={['admin', 'store_a', 'store_b', 'store_c']}><RapidAudit /></ProtectedRoute>} />
      <Route path="/admin/system" element={<ProtectedRoute allowedRoles={['admin']}><SystemAdmin /></ProtectedRoute>} />
      <Route path="/admin/team" element={<ProtectedRoute allowedRoles={['admin']}><TeamSettings /></ProtectedRoute>} />
      <Route path="/transfers/dispatch" element={<ProtectedRoute allowedRoles={['admin', 'store_a', 'store_b', 'store_c']}><TransferDispatch /></ProtectedRoute>} />

      <Route path="/admin/parts" element={<Navigate to="/admin/inventory" replace />} />
      <Route path="/admin/parts/:sku" element={<ProtectedRoute allowedRoles={['admin']}><PartDetail /></ProtectedRoute>} />

      <Route path="/track" element={<ProtectedRoute allowedRoles={['admin', 'store_a', 'store_b', 'store_c', 'technician']}><TrackDevice /></ProtectedRoute>} />

      <Route path="/store/inventory" element={<ProtectedRoute allowedRoles={['admin', 'store_a', 'store_b', 'store_c']}><CentralInventory /></ProtectedRoute>} />
      <Route path="/store/pos" element={<ProtectedRoute allowedRoles={['admin', 'store_a', 'store_b', 'store_c']}><POS /></ProtectedRoute>} />
      <Route path="/store/receiving" element={<ProtectedRoute allowedRoles={['admin', 'store_a', 'store_b', 'store_c']}><ReceiveShipment /></ProtectedRoute>} />

      <Route path="/returns" element={<ProtectedRoute allowedRoles={['admin', 'store_a', 'store_b', 'store_c']}><Returns /></ProtectedRoute>} />
      <Route path="/qc/triage" element={<ProtectedRoute allowedRoles={['admin', 'store_a', 'store_b', 'store_c']}><QCTriage /></ProtectedRoute>} />
      <Route path="/repair/dashboard" element={<ProtectedRoute allowedRoles={['technician']}><RepairDashboard /></ProtectedRoute>} />
      <Route path="/repair/kanban" element={<ProtectedRoute allowedRoles={['technician', 'admin']}><TechKanban /></ProtectedRoute>} />

      {/* Invoicing */}
      <Route path="/invoices" element={<ProtectedRoute allowedRoles={['admin', 'store_a', 'store_b', 'store_c']}><InvoiceManagement /></ProtectedRoute>} />
      <Route path="/invoices/new" element={<ProtectedRoute allowedRoles={['admin', 'store_a', 'store_b', 'store_c']}><InvoiceForm /></ProtectedRoute>} />
      <Route path="/invoices/recurring" element={<ProtectedRoute allowedRoles={['admin']}><RecurringInvoices /></ProtectedRoute>} />
      <Route path="/estimates/:id" element={<ProtectedRoute allowedRoles={['admin', 'store_a', 'store_b', 'store_c']}><EstimateWorkflow /></ProtectedRoute>} />

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

  if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (user.role === 'technician') return <Navigate to="/repair/dashboard" replace />;
  return <Navigate to="/store/inventory" replace />;
}

export default App;
