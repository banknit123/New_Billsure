import React, { useState } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import DashboardHome from '../components/DashboardHome';
import BillsManager from '../components/BillsManager';
import PaymentPlanPage from '../components/PaymentPlanPage';
import PaymentMethodsManager from '../components/PaymentMethodsManager';
import SettingsPage from '../components/SettingsPage';
import BillIntelligence from '../components/BillIntelligence';
import ForecastDashboard from '../components/ForecastDashboard';
import SubscriptionTiers from '../components/SubscriptionTiers';
import NotificationBell from '../components/NotificationBell';
import { LayoutDashboard, FileText, Calculator, CreditCard, Settings, LogOut, Shield, Menu, X, Sparkles, TrendingUp, Crown } from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Overview', end: true },
  { to: '/dashboard/bills', icon: FileText, label: 'Bills' },
  { to: '/dashboard/insights', icon: Sparkles, label: 'Bill Intelligence' },
  { to: '/dashboard/forecast', icon: TrendingUp, label: 'Annual Plan' },
  { to: '/dashboard/payment-plan', icon: Calculator, label: 'Payment Plan' },
  { to: '/dashboard/payment-methods', icon: CreditCard, label: 'Payment Methods' },
  { to: '/dashboard/subscription', icon: Crown, label: 'Subscription' },
  { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
];

export default function Dashboard() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={closeSidebar} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed h-full z-40 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200
        w-60
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="px-5 h-16 flex items-center justify-between border-b border-slate-200">
          <img src="/logo.jpg" alt="EasyBillsPay" className="h-8 rounded" />
          <button className="lg:hidden text-slate-500 hover:text-slate-900" onClick={closeSidebar}>
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto" data-testid="dashboard-nav">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end} onClick={closeSidebar}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-navy text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
              data-testid={`nav-${label.toLowerCase().replace(/\s/g, '-')}`}
            >
              <Icon size={18} strokeWidth={1.5} />
              {label}
            </NavLink>
          ))}

          {user?.is_admin && (
            <NavLink to="/admin" onClick={closeSidebar}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-teal hover:bg-teal-50 transition-all"
              data-testid="nav-admin"
            >
              <Shield size={18} strokeWidth={1.5} />
              Admin Panel
            </NavLink>
          )}
        </nav>

        <div className="px-3 py-4 border-t border-slate-200">
          <div className="px-3 mb-3">
            <p className="text-sm font-medium text-slate-900 truncate">{user?.full_name}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
          <button onClick={handleLogout} data-testid="logout-btn"
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all">
            <LogOut size={18} strokeWidth={1.5} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-screen lg:ml-60">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600" onClick={() => setSidebarOpen(true)}
              data-testid="mobile-menu-btn">
              <Menu size={20} />
            </button>
            <p className="text-sm font-medium text-slate-900 hidden sm:block">
              Welcome, {user?.full_name?.split(' ')[0]}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-500">Wallet</p>
              <p className="text-sm font-bold text-slate-900">${(user?.wallet_balance || 0).toFixed(2)}</p>
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-6 lg:p-8">
          <Routes>
            <Route index element={<DashboardHome user={user} refreshUser={refreshUser} />} />
            <Route path="bills" element={<BillsManager user={user} refreshUser={refreshUser} />} />
            <Route path="insights" element={<BillIntelligence />} />
            <Route path="forecast" element={<ForecastDashboard user={user} />} />
            <Route path="payment-plan" element={<PaymentPlanPage user={user} refreshUser={refreshUser} />} />
            <Route path="payment-methods" element={<PaymentMethodsManager user={user} refreshUser={refreshUser} />} />
            <Route path="subscription" element={<SubscriptionTiers user={user} refreshUser={refreshUser} />} />
            <Route path="settings" element={<SettingsPage user={user} refreshUser={refreshUser} />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
