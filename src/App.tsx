import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import CRMDirectory from './pages/CRMDirectory';
import InvoicingSystem from './pages/InvoicingSystem';
import TrackDevice from './pages/TrackDevice';
import StoreInventory from './pages/StoreInventory';
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

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: string[] }) => {
  const { user, token, isLoading } = useAuth();
  if (isLoading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!token) return <Navigate to="/login" />;
  if (!user) return <div className="flex h-screen items-center justify-center">Initializing Session...</div>;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/" />;
  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={
            <AuthWrapper />
          } />

          <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />

          <Route path="/admin/inventory" element={<ProtectedRoute allowedRoles={['admin']}><InventoryHub /></ProtectedRoute>} />
          <Route path="/admin/finance" element={<ProtectedRoute allowedRoles={['admin']}><FinanceHub /></ProtectedRoute>} />

          <Route path="/admin/crm" element={<ProtectedRoute allowedRoles={['admin', 'store_a', 'store_b', 'store_c']}><CRMDirectory /></ProtectedRoute>} />
          <Route path="/admin/wholesale-checkout" element={<ProtectedRoute allowedRoles={['admin', 'store_a', 'store_b', 'store_c']}><InvoicingSystem /></ProtectedRoute>} />
          <Route path="/admin/manual-intake" element={<ProtectedRoute allowedRoles={['admin', 'store_a', 'store_b', 'store_c']}><ManualIntake /></ProtectedRoute>} />
          <Route path="/admin/rapid-audit" element={<ProtectedRoute allowedRoles={['admin', 'store_a', 'store_b', 'store_c']}><RapidAudit /></ProtectedRoute>} />
          <Route path="/admin/system" element={<ProtectedRoute allowedRoles={['admin']}><SystemAdmin /></ProtectedRoute>} />

          <Route path="/track" element={<ProtectedRoute allowedRoles={['admin', 'store_a', 'store_b', 'store_c', 'technician']}><TrackDevice /></ProtectedRoute>} />

          <Route path="/store/inventory" element={<ProtectedRoute allowedRoles={['admin', 'store_a', 'store_b', 'store_c']}><StoreInventory /></ProtectedRoute>} />
          <Route path="/store/pos" element={<ProtectedRoute allowedRoles={['admin', 'store_a', 'store_b', 'store_c']}><InvoicingSystem /></ProtectedRoute>} />

          <Route path="/returns" element={<ProtectedRoute allowedRoles={['admin', 'store_a', 'store_b', 'store_c']}><Returns /></ProtectedRoute>} />
          <Route path="/qc/triage" element={<ProtectedRoute allowedRoles={['admin', 'store_a', 'store_b', 'store_c']}><QCTriage /></ProtectedRoute>} />
          <Route path="/repair/dashboard" element={<ProtectedRoute allowedRoles={['technician']}><RepairDashboard /></ProtectedRoute>} />
          <Route path="/repair/kanban" element={<ProtectedRoute allowedRoles={['technician', 'admin']}><TechKanban /></ProtectedRoute>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

function AuthWrapper() {
  const { user, token, isLoading } = useAuth();
  if (isLoading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!token) return <Navigate to="/login" />;
  if (!user) return <div className="flex h-screen items-center justify-center">Synchronizing Identity...</div>;

  if (user.role === 'admin') return <Navigate to="/admin/dashboard" />;
  if (user.role === 'technician') return <Navigate to="/repair/dashboard" />;
  return <Navigate to="/store/inventory" />;
}

export default App;
