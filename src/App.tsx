import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LocationProvider } from './context/LocationContext';
import { AxiosInterceptor } from './api/AxiosInterceptor';
import { ToastProvider } from './components/Toast';
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
import ModelCatalog from './pages/ModelCatalog';
import ServiceCatalog from './pages/ServiceCatalog';
import PurchaseOrders from './pages/PurchaseOrders';
import Suppliers from './pages/Suppliers';
import ArAging from './pages/ArAging';
import TaxSummary from './pages/TaxSummary';
import ProfitLoss from './pages/ProfitLoss';
import CustomerStatement from './pages/CustomerStatement';
import DailyClose from './pages/DailyClose';
import EmployeeSales from './pages/EmployeeSales';
import LowStockAlerts from './pages/LowStockAlerts';

const isDevEnv = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: string[] }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-gray-500 animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Layout><ErrorBoundary>{children}</ErrorBoundary></Layout>;
};

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <LocationProvider>
            <AxiosInterceptor>
              <ToastProvider>
                <AuthRoutes />
              </ToastProvider>
            </AxiosInterceptor>
          </LocationProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

function AuthRoutes() {
  const { user, isLoading } = useAuth();

  if (isDevEnv) {
    return (
      <Routes>
        <Route path="/" element={<Navigate to="/admin/inventory" replace />} />
        <Route path="/admin/*" element={<PreviewRoutes />} />
        <Route path="/invoice/:shareToken" element={<ErrorBoundary><PublicInvoice /></ErrorBoundary>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  if (isLoading && !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-gray-500 animate-pulse">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={
        user ? <Navigate to="/" replace /> : <Login />
      } />

      <Route path="/" element={<AuthWrapper />} />

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
      <Route path="/admin/models" element={<ProtectedRoute allowedRoles={['admin']}><ModelCatalog /></ProtectedRoute>} />
      <Route path="/admin/services" element={<ProtectedRoute allowedRoles={['admin']}><ServiceCatalog /></ProtectedRoute>} />
      <Route path="/admin/purchase-orders" element={<ProtectedRoute allowedRoles={['admin']}><PurchaseOrders /></ProtectedRoute>} />
      <Route path="/admin/suppliers" element={<ProtectedRoute allowedRoles={['admin']}><Suppliers /></ProtectedRoute>} />

      {/* CRM Routes */}
      <Route path="/admin/customers" element={<ProtectedRoute allowedRoles={['admin', 'warehouse', 'store']}><Customers /></ProtectedRoute>} />
      <Route path="/admin/customers/:crmId" element={<ProtectedRoute allowedRoles={['admin', 'warehouse', 'store']}><CustomerDetail /></ProtectedRoute>} />
      <Route path="/admin/customers/:crmId/statement" element={<ProtectedRoute allowedRoles={['admin', 'store']}><CustomerStatement /></ProtectedRoute>} />
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
      <Route path="/admin/ar-aging" element={<ProtectedRoute allowedRoles={['admin']}><ArAging /></ProtectedRoute>} />
      <Route path="/admin/tax-summary" element={<ProtectedRoute allowedRoles={['admin']}><TaxSummary /></ProtectedRoute>} />
      <Route path="/admin/profit-loss" element={<ProtectedRoute allowedRoles={['admin']}><ProfitLoss /></ProtectedRoute>} />
      <Route path="/admin/daily-close" element={<ProtectedRoute allowedRoles={['admin']}><DailyClose /></ProtectedRoute>} />
      <Route path="/admin/employee-sales" element={<ProtectedRoute allowedRoles={['admin']}><EmployeeSales /></ProtectedRoute>} />
      <Route path="/admin/low-stock" element={<ProtectedRoute allowedRoles={['admin']}><LowStockAlerts /></ProtectedRoute>} />

      {/* Public Invoice Route — no auth */}
      <Route path="/invoice/:shareToken" element={<ErrorBoundary><PublicInvoice /></ErrorBoundary>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function PreviewRoutes() {
  const { isLoading } = useAuth();
  if (isLoading) return <div className="flex h-screen items-center justify-center"><div className="animate-pulse text-zinc-400 text-xs font-black uppercase tracking-widest">Loading Preview...</div></div>;

  return (
    <Layout><ErrorBoundary>
      <Routes>
        <Route path="inventory" element={<Inventory />} />
        <Route path="manual-intake" element={<ManualIntake />} />
        <Route path="phone-routing" element={<PhoneRouting />} />
        <Route path="rapid-audit" element={<RapidAudit />} />
        <Route path="qc" element={<QC />} />
        <Route path="repairs" element={<Repairs />} />
        <Route path="track" element={<Track />} />
        <Route path="import-inventory" element={<ExcelImport />} />
        <Route path="incoming-transfers" element={<IncomingTransfers />} />
        <Route path="sku-generator" element={<SkuGenerator />} />
        <Route path="purchase-orders" element={<PurchaseOrders />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/:crmId" element={<CustomerDetail />} />
        <Route path="customers/:crmId/statement" element={<CustomerStatement />} />
        <Route path="consignments" element={<Consignments />} />
        <Route path="consignments/:batchId" element={<ConsignmentDetail />} />
        <Route path="invoices" element={<InvoicesList />} />
        <Route path="invoices/new" element={<InvoiceForm />} />
        <Route path="invoices/:invoiceNumber/edit" element={<InvoiceForm />} />
        <Route path="invoices/:invoiceNumber" element={<InvoiceDetail />} />
        <Route path="settings" element={<Settings />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="ar-aging" element={<ArAging />} />
        <Route path="tax-summary" element={<TaxSummary />} />
        <Route path="profit-loss" element={<ProfitLoss />} />
        <Route path="daily-close" element={<DailyClose />} />
        <Route path="employee-sales" element={<EmployeeSales />} />
        <Route path="low-stock" element={<LowStockAlerts />} />
        <Route path="*" element={<Navigate to="/admin/inventory" replace />} />
      </Routes>
    </ErrorBoundary></Layout>
  );
}

function AuthWrapper() {
  const { user, isLoading } = useAuth();

  if (isDevEnv) {
    return <Navigate to="/admin/inventory" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-zinc-400 text-xs font-black uppercase tracking-widest">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (user.role === 'admin') return <Navigate to="/admin/inventory" replace />;
  if (user.role === 'warehouse') return <Navigate to="/admin/inventory" replace />;
  if (user.role === 'technician') return <Navigate to="/admin/rapid-audit" replace />;
  return <Navigate to="/admin/inventory" replace />;
}

export default App;
