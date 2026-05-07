import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLocationFilter } from '../context/LocationContext';
import { UserButton, OrganizationSwitcher, CreateOrganization, useOrganization } from '@clerk/react';
import {
  PackagePlus, ArrowRightLeft, ClipboardCheck,
  Bell, ChevronRight, Home, Sun, Moon, PackageSearch, Truck, BadgeCheck, Wrench, MapPin, Users, PackageOpen, FileText
} from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
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
        { id: 'incoming', label: 'Incoming Transfers', path: '/admin/incoming-transfers', icon: Truck, roles: ['admin', 'warehouse', 'store'] },
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

  if (!organization) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg-primary)]">
        <CreateOrganization />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[var(--bg-primary)] overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-60 bg-[var(--bg-secondary)] border-r border-[var(--border-primary)] text-[var(--text-primary)] flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-[var(--border-primary)]">
          <div className="text-lg font-bold tracking-wide">
            AMAFAH<span className="text-accent">ERP</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto sidebar-scroll space-y-4">
          {menuSections.map(section => (
            <div key={section.label}>
              <div className="px-5 py-1 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.15em]">
                {section.label}
              </div>
              {section.items
                .filter(item => item.roles.includes(user?.role || ''))
                .map(item => (
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
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-[var(--border-primary)] p-4 space-y-3">
          <button
            onClick={toggle}
            className="w-full flex items-center gap-3 py-2 px-3 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors text-xs"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          <OrganizationSwitcher
            hidePersonal={true}
            appearance={{
              elements: {
                organizationSwitcherTrigger:
                  "w-full flex justify-between items-center py-2 px-3 border border-[var(--border-secondary)] rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-primary)] text-xs",
                organizationPreviewTextContainer: "truncate text-[var(--text-primary)]",
                organizationSwitcherTriggerIcon: "text-[var(--text-secondary)]",
              },
            }}
          />
          <div className="flex items-center gap-3">
            <UserButton />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                {user?.email?.split('@')[0]}
              </div>
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">{roleLabel(user?.role || '')}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOP BAR */}
        <header className="h-14 bg-[var(--bg-secondary)] border-b border-[var(--border-primary)] flex items-center px-6 gap-4 flex-shrink-0">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)]">
            <Home size={14} />
            {breadcrumbs.length > 0 && <ChevronRight size={12} />}
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={crumb.path}>
                {i > 0 && <ChevronRight size={12} />}
                {crumb.last ? (
                  <span className="text-[var(--text-primary)] font-medium">{crumb.label}</span>
                ) : (
                  <Link to={crumb.path} className="hover:text-[var(--text-primary)] capitalize">
                    {crumb.label}
                  </Link>
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="flex-1" />

          {/* Store Selector */}
          <select
            className="bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] text-[var(--text-primary)] text-[13px] px-3 py-1.5 rounded-md outline-none focus:border-accent transition-colors cursor-pointer"
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
          <button className="topbar-btn relative">
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full border-2 border-[var(--bg-secondary)]" />
          </button>

          {/* User Avatar */}
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-[var(--text-inverse)] text-[13px] font-semibold cursor-pointer">
            {(user?.email || 'U')[0].toUpperCase()}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto mesh-bg">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
