import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserButton, OrganizationSwitcher, CreateOrganization, useOrganization } from '@clerk/react';
import {
  Users, CreditCard,
  Wrench, LayoutDashboard, ShoppingCart,
  Truck, Settings, PackagePlus, RefreshCw,
  Cpu, Factory, DollarSign
} from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const { organization, isLoaded } = useOrganization();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard, roles: ['admin'] },
    { id: 'pos', label: 'Point of Sale', path: '/admin/wholesale-checkout', icon: ShoppingCart, roles: ['admin', 'store_a', 'store_b', 'store_c'] },
    { id: 'inventory', label: 'Logistics', path: '/admin/inventory', icon: Truck, roles: ['admin'] },
    { id: 'audit', label: 'Rapid Audit', path: '/admin/rapid-audit', icon: RefreshCw, roles: ['admin', 'store_a', 'store_b', 'store_c'] },
    { id: 'intake', label: 'Manual Intake', path: '/admin/manual-intake', icon: PackagePlus, roles: ['admin', 'store_a', 'store_b', 'store_c'] },
    { id: 'parts', label: 'Parts', path: '/admin/parts', icon: Cpu, roles: ['admin'] },
    { id: 'suppliers', label: 'Suppliers', path: '/admin/suppliers', icon: Factory, roles: ['admin'] },
    { id: 'labor', label: 'Labor Rates', path: '/admin/labor-rates', icon: DollarSign, roles: ['admin'] },
    { id: 'repair', label: 'Repairs', path: '/repair/kanban', icon: Wrench, roles: ['admin', 'technician'] },
    { id: 'crm', label: 'CRM', path: '/admin/crm', icon: Users, roles: ['admin', 'store_a', 'store_b', 'store_c'] },
    { id: 'finance', label: 'Finance', path: '/admin/finance', icon: CreditCard, roles: ['admin'] },
    { id: 'team', label: 'Team Settings', path: '/admin/team', icon: Users, roles: ['admin'] },
    { id: 'admin', label: 'Settings', path: '/admin/system', icon: Settings, roles: ['admin'] },
  ];

  const isActive = (path: string) => location.pathname.startsWith(path);

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50">
        <div className="animate-pulse text-zinc-400 text-xs font-black uppercase tracking-widest">Loading Workspace...</div>
      </div>
    );
  }

  // Force workspace creation if no organization exists
  if (!organization) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50">
        <CreateOrganization />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 font-sans selection:bg-zinc-200">
      <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col shadow-[1px_0_10px_rgba(0,0,0,0.02)]">
        <div className="p-8 mb-4">
          <div className="text-xl font-bold tracking-tighter text-zinc-900 flex items-center gap-2">
            <div className="w-2 h-8 bg-zinc-900 rounded-full" />
            AMAFAH
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400 mt-2 ml-4">
            Enterprise WMS
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {menuItems.filter(item => item.roles.includes(user?.role || '')).map(item => (
            <Link
              key={item.id}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all rounded-lg ${isActive(item.path)
                ? 'bg-zinc-900 text-white shadow-lg shadow-zinc-200'
                : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
                }`}
            >
              <item.icon size={18} className={`${isActive(item.path) ? 'text-white' : 'text-zinc-400'}`} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-6 border-t border-zinc-100 bg-zinc-50/50 space-y-4">
          <div className="flex flex-col gap-3 px-2">
            <div className="flex items-center justify-between w-full">
              <OrganizationSwitcher 
                hidePersonal={true}
                appearance={{
                  elements: {
                    organizationSwitcherTrigger: "w-full flex justify-between items-center py-2 px-3 border border-zinc-200 rounded-md bg-white hover:bg-zinc-50 transition-colors",
                    organizationPreviewTextContainer: "truncate",
                    organizationSwitcherTriggerIcon: "text-zinc-400"
                  }
                }}
              />
            </div>
            <div className="flex items-center gap-3 mt-2">
              <UserButton />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-zinc-900 truncate uppercase tracking-widest">{user?.email?.split('@')[0]}</div>
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{user?.role}</div>
              </div>
            </div>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto bg-zinc-50">
        {children}
      </main>
    </div>
  );
}
