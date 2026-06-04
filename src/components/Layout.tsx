import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLocationFilter } from '../context/LocationContext';
import { UserButton, OrganizationSwitcher, CreateOrganization, useOrganization } from '@clerk/react';
import {
  PackagePlus, ArrowRightLeft, ClipboardCheck,
  Bell, ChevronRight, Home, Sun, Moon, PackageSearch, Truck, BadgeCheck, Wrench, MapPin, Users, PackageOpen, FileText, Settings, Upload, BarChart3, QrCode, Clock, Receipt, TrendingUp, Package, Building2, DollarSign, ShoppingCart, AlertTriangle, Search
} from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setSearchQuery('');
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => { setSearchQuery(''); }, [location.pathname]);
  const { organization, isLoaded } = useOrganization();
  const { selectedLocationId, setSelectedLocationId, availableLocations } = useLocationFilter();

  const menuSections = [
    {
      label: 'Operations',
      items: [
        { id: 'intake', label: 'Quick Intake', path: '/admin/manual-intake', icon: PackagePlus, roles: ['admin', 'warehouse', 'store'] },
        { id: 'routing', label: 'Phone Routing', path: '/admin/phone-routing', icon: ArrowRightLeft, roles: ['admin', 'warehouse', 'store'] },
        { id: 'audit', label: 'Rapid Audit', path: '/admin/rapid-audit', icon: ClipboardCheck, roles: ['admin', 'warehouse', 'store'] },
        { id: 'qc', label: 'QC', path: '/admin/qc', icon: BadgeCheck, roles: ['admin'] },
        { id: 'repairs', label: 'Repairs', path: '/admin/repairs', icon: Wrench, roles: ['admin'] },
        { id: 'track', label: 'Track Device', path: '/admin/track', icon: MapPin, roles: ['admin', 'warehouse', 'store', 'technician'] },
      ]
    },
    {
      label: 'Inventory',
      items: [
        { id: 'inventory', label: 'All Inventory', path: '/admin/inventory', icon: PackageSearch, roles: ['admin', 'warehouse', 'store'] },
        { id: 'import', label: 'Import Inventory', path: '/admin/import-inventory', icon: Upload, roles: ['admin', 'warehouse', 'store'] },
        { id: 'incoming', label: 'Incoming Transfers', path: '/admin/incoming-transfers', icon: Truck, roles: ['admin', 'warehouse', 'store'] },
        { id: 'sku', label: 'SKU Generator', path: '/admin/sku-generator', icon: QrCode, roles: ['admin', 'warehouse', 'store'] },
        { id: 'po', label: 'Purchase Orders', path: '/admin/purchase-orders', icon: Package, roles: ['admin'] },
        { id: 'suppliers', label: 'Suppliers', path: '/admin/suppliers', icon: Building2, roles: ['admin'] },
      ]
    },
    {
      label: 'CRM',
      items: [
        { id: 'customers', label: 'Customers', path: '/admin/customers', icon: Users, roles: ['admin', 'warehouse', 'store'] },
        { id: 'consignment', label: 'Consignments', path: '/admin/consignments', icon: PackageOpen, roles: ['admin', 'warehouse', 'store'] },
      ]
    },
    {
      label: 'Sales',
      items: [
        { id: 'invoices', label: 'Invoices', path: '/admin/invoices', icon: FileText, roles: ['admin', 'store'] },
        { id: 'daily-close', label: 'Daily Close', path: '/admin/daily-close', icon: DollarSign, roles: ['admin'] },
        { id: 'settings', label: 'Settings', path: '/admin/settings', icon: Settings, roles: ['admin'] },
      ]
    },
    {
      label: 'Reports',
      items: [
        { id: 'analytics', label: 'Analytics', path: '/admin/analytics', icon: BarChart3, roles: ['admin'] },
        { id: 'ar-aging', label: 'AR Aging', path: '/admin/ar-aging', icon: Clock, roles: ['admin'] },
        { id: 'tax-summary', label: 'Tax Summary', path: '/admin/tax-summary', icon: Receipt, roles: ['admin'] },
        { id: 'profit-loss', label: 'Profit & Loss', path: '/admin/profit-loss', icon: TrendingUp, roles: ['admin'] },
        { id: 'employee-sales', label: 'Employee Sales', path: '/admin/employee-sales', icon: ShoppingCart, roles: ['admin'] },
        { id: 'low-stock', label: 'Low Stock', path: '/admin/low-stock', icon: AlertTriangle, roles: ['admin', 'warehouse'] },
      ]
    },
  ];

  function roleLabel(role: string): string {
    const map: Record<string, string> = {
      admin: 'Administrator',
      warehouse: 'Warehouse',
      store: 'Store',
      technician: 'Technician',
    };
    return map[role] || role;
  }

  const isActive = (path: string) => location.pathname.startsWith(path);

  const pathParts = location.pathname.split('/').filter(Boolean);
  const breadcrumbs = pathParts.map((part, i) => ({
    label: part.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    path: '/' + pathParts.slice(0, i + 1).join('/'),
    last: i === pathParts.length - 1,
  }));

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg-primary)]">
        <div className="animate-pulse text-[var(--text-tertiary)] text-xs font-semibold uppercase tracking-widest">Loading Workspace...</div>
      </div>
    );
  }

  if (!organization && !window.location.hostname.includes('vercel.app')) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg-primary)]">
        <CreateOrganization />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[var(--bg)] overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-60 bg-[var(--bg-card)] border-r border-[var(--border)] flex flex-col flex-shrink-0">
        {/* Logo */}
        <Link to="/admin/inventory" className="px-5 py-5 border-b border-[var(--border)] cursor-pointer block">
          <div className="text-lg font-bold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
            AMAFAH<span style={{ color: 'var(--accent)' }}>ERP</span>
          </div>
        </Link>

        {/* Search */}
        <div className="px-3 py-2 border-b border-[var(--border)]">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search pages..."
              className="w-full pl-8 pr-12 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-md outline-none focus:border-[var(--accent)] transition-colors text-[var(--text)] placeholder:text-[var(--text-tertiary)]"
            />
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono px-1.5 py-0.5 bg-[var(--bg-muted)] text-[var(--text-tertiary)] rounded border border-[var(--border)] pointer-events-none">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto sidebar-scroll flex flex-col gap-[18px]">
          {(() => {
            const filtered = menuSections.map(section => ({
              ...section,
              items: section.items.filter(item => {
                if (!item.roles.includes(user?.role || '')) return false;
                if (!searchQuery.trim()) return true;
                return item.label.toLowerCase().includes(searchQuery.toLowerCase());
              }),
            })).filter(section => section.items.length > 0);

            if (filtered.length === 0 && searchQuery.trim()) {
              return (
                <div className="px-3 py-8 text-center text-xs text-[var(--text-tertiary)]">
                  No pages match "{searchQuery}"
                </div>
              );
            }

            return filtered.map(section => (
              <div key={section.label}>
                <div className="px-[10px] pb-1 text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.12em]">
                  {section.label}
                </div>
                {section.items.map(item => (
                  <Link
                    key={item.id}
                    to={item.path}
                    className={`sidebar-link ${isActive(item.path) ? 'active' : ''}`}
                  >
                    <item.icon size={18} />
                    <span className="flex-1">{item.label}</span>
                  </Link>
                ))}
              </div>
            ));
          })()}
        </nav>

        {/* Footer */}
        <div className="border-t border-[var(--border)] p-[14px] flex flex-col gap-[10px]">
          <OrganizationSwitcher
            hidePersonal={true}
            appearance={{
              elements: {
                organizationSwitcherTrigger:
                  "w-full flex justify-between items-center py-2 px-3 border border-[var(--border)] rounded-md bg-[var(--bg)] hover:bg-[var(--bg-muted)] transition-colors text-[var(--text)] text-xs",
                organizationPreviewTextContainer: "truncate text-[var(--text)]",
                organizationSwitcherTriggerIcon: "text-[var(--text-secondary)]",
              },
            }}
          />
          <div className="flex items-center gap-[10px] p-2 rounded-md bg-[var(--bg-muted)]">
            <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
              {(user?.email || 'U')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-[var(--text)] truncate">
                {user?.email?.split('@')[0]}
              </div>
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold tracking-wider">{roleLabel(user?.role || '')}</div>
            </div>
            <UserButton />
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOP BAR */}
        <header className="h-[52px] bg-[var(--bg-card)] border-b border-[var(--border)] flex items-center px-5 gap-4 flex-shrink-0">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)]">
            <Link to="/admin/inventory" className="hover:text-[var(--text)]"><Home size={14} /></Link>
            {breadcrumbs.length > 0 && <ChevronRight size={12} className="text-[var(--text-muted)]" />}
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={crumb.path}>
                {i > 0 && <ChevronRight size={12} className="text-[var(--text-muted)]" />}
                {crumb.last ? (
                  <span className="text-[var(--text)] font-semibold">{crumb.label}</span>
                ) : (
                  <Link to={crumb.path} className="hover:text-[var(--text)] capitalize">
                    {crumb.label}
                  </Link>
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="flex-1" />

          {/* Store Selector */}
          <select
            className="bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-xs px-[10px] py-1.5 rounded-md outline-none focus:border-[var(--accent)] transition-colors cursor-pointer"
            style={{ fontFamily: 'var(--font-body)' }}
            value={selectedLocationId ?? 'all'}
            onChange={e => setSelectedLocationId(e.target.value === 'all' ? null : e.target.value)}
          >
            <option value="all">All Locations</option>
            {availableLocations.map(loc => (
              <option key={loc.id} value={loc.id}>
                {loc.name} ({loc.location_type})
              </option>
            ))}
          </select>

          {/* Notification Bell */}
          <button className="topbar-btn" title="Notifications">
            <Bell size={18} />
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={toggle}
            className="topbar-btn"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-[var(--bg)]">
          <div className="max-w-[1400px] p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
