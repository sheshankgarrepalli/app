import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { UserButton, OrganizationSwitcher, CreateOrganization, useOrganization } from '@clerk/react';
import {
  Users, CreditCard, Wrench, LayoutDashboard, ShoppingCart,
  Truck, Settings, PackagePlus, RefreshCw, PackageOpen,
  Bell, ChevronRight, Home, Sun, Moon, FileText, RotateCw
} from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const { organization, isLoaded } = useOrganization();
  const [storeFilter, setStoreFilter] = useState('all');
  const [hasNotifications] = useState(true);

  const menuSections = [
    {
      label: 'Operations',
      items: [
        { id: 'dashboard', label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard, roles: ['admin'] },
        { id: 'pos', label: 'Checkout', path: '/admin/wholesale-checkout', icon: ShoppingCart, roles: ['admin', 'store_a', 'store_b', 'store_c'] },
        { id: 'crm', label: 'CRM', path: '/admin/crm', icon: Users, roles: ['admin', 'store_a', 'store_b', 'store_c'] },
        { id: 'finance', label: 'Finance', path: '/admin/finance', icon: CreditCard, roles: ['admin'] },
        { id: 'invoices', label: 'Invoices', path: '/invoices', icon: FileText, roles: ['admin', 'store_a', 'store_b', 'store_c'] },
        { id: 'recurring', label: 'Recurring', path: '/invoices/recurring', icon: RotateCw, roles: ['admin'] },
      ]
    },
    {
      label: 'Logistics',
      items: [
        { id: 'inventory', label: 'Inventory', path: '/admin/inventory', icon: Truck, roles: ['admin'] },

        { id: 'receiving', label: 'Receiving', path: '/store/receiving', icon: PackageOpen, roles: ['admin', 'store_a', 'store_b', 'store_c'] },
        { id: 'transfers', label: 'Transfers', path: '/transfers/dispatch', icon: RefreshCw, roles: ['admin', 'store_a', 'store_b', 'store_c'] },
        { id: 'intake', label: 'Intake', path: '/admin/manual-intake', icon: PackagePlus, roles: ['admin', 'store_a', 'store_b', 'store_c'] },
      ]
    },
    {
      label: 'Workshop',
      items: [
        { id: 'repair', label: 'Repairs', path: '/repair/kanban', icon: Wrench, roles: ['admin', 'technician'], badge: 7 },
        { id: 'audit', label: 'Rapid Audit', path: '/admin/rapid-audit', icon: PackagePlus, roles: ['admin', 'store_a', 'store_b', 'store_c'] },
      ]
    },
    {
      label: 'System',
      items: [
        { id: 'team', label: 'Team', path: '/admin/team', icon: Users, roles: ['admin'] },
        { id: 'admin', label: 'Settings', path: '/admin/system', icon: Settings, roles: ['admin'] },
      ]
    },
  ];

  const isActive = (path: string) => location.pathname.startsWith(path);

  const pathParts = location.pathname.split('/').filter(Boolean);
  const breadcrumbs = pathParts.map((part, i) => ({
    label: part.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    path: '/' + pathParts.slice(0, i + 1).join('/'),
    last: i === pathParts.length - 1,
  }));

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f5f5f5] dark:bg-[#0a0a0b]">
        <div className="animate-pulse text-[#6b7280] dark:text-[#71717a] text-xs font-semibold uppercase tracking-widest">Loading Workspace...</div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f5f5f5] dark:bg-[#0a0a0b]">
        <CreateOrganization />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f5f5f5] dark:bg-[#0a0a0b] overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-60 bg-navy dark:bg-[#0c0c0e] border-r border-navy-light/20 dark:border-[#1a1a1c] text-white flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-white/10 dark:border-[#1a1a1c]">
          <div className="text-lg font-bold tracking-wide">
            AMAFAH<span className="text-accent">ERP</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto sidebar-scroll space-y-4">
          {menuSections.map(section => (
            <div key={section.label}>
              <div className="px-5 py-1 text-[10px] font-bold text-white/30 dark:text-[#52525b] uppercase tracking-[0.15em]">
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
                    {item.badge && (
                      <span className="bg-accent text-white text-[11px] px-1.5 py-0.5 rounded-full min-w-[20px] text-center leading-none">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 dark:border-[#1a1a1c] p-4 space-y-3">
          {/* Theme Toggle */}
          <button
            onClick={toggle}
            className="w-full flex items-center gap-3 py-2 px-3 rounded-md text-white/65 hover:text-white hover:bg-white/[0.06] transition-colors text-xs"
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
                  "w-full flex justify-between items-center py-2 px-3 border border-white/15 dark:border-[#1f1f21] rounded-md bg-white/5 dark:bg-[#141416] hover:bg-white/10 dark:hover:bg-[#1a1a1c] transition-colors text-white text-xs",
                organizationPreviewTextContainer: "truncate text-white",
                organizationSwitcherTriggerIcon: "text-white/50 dark:text-[#52525b]",
              },
            }}
          />
          <div className="flex items-center gap-3">
            <UserButton />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate">
                {user?.email?.split('@')[0]}
              </div>
              <div className="text-[10px] text-white/40 dark:text-[#52525b] uppercase tracking-wider">{user?.role}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOP BAR */}
        <header className="h-14 bg-white dark:bg-[#0c0c0e] border-b border-[#e5e7eb] dark:border-[#1a1a1c] flex items-center px-6 gap-4 flex-shrink-0">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-[13px] text-[#6b7280] dark:text-[#71717a]">
            <Home size={14} />
            {breadcrumbs.length > 0 && <ChevronRight size={12} />}
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={crumb.path}>
                {i > 0 && <ChevronRight size={12} />}
                {crumb.last ? (
                  <span className="text-[#1f2937] dark:text-[#e4e4e7] font-medium">{crumb.label}</span>
                ) : (
                  <Link to={crumb.path} className="hover:text-[#1f2937] dark:hover:text-[#e4e4e7] capitalize">
                    {crumb.label}
                  </Link>
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="flex-1" />

          {/* Store Selector */}
          <select
            className="form-select text-[13px] py-1.5"
            value={storeFilter}
            onChange={e => setStoreFilter(e.target.value)}
          >
            <option value="all">All Locations</option>
            <option value="store_a">Store A — Downtown</option>
            <option value="store_b">Store B — Eastside</option>
            <option value="store_c">Store C — Westend</option>
            <option value="warehouse">Warehouse Alpha</option>
          </select>

          {/* Notification Bell */}
          <button className="topbar-btn relative">
            <Bell size={18} />
            {hasNotifications && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full border-2 border-white dark:border-[#0c0c0e]" />
            )}
          </button>

          {/* User Avatar */}
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-[13px] font-semibold cursor-pointer">
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
