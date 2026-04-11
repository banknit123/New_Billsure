import React from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import DashboardHome from '../components/DashboardHome';
import BillsManager from '../components/BillsManager';
import PaymentPlanPage from '../components/PaymentPlanPage';
import PaymentMethodsManager from '../components/PaymentMethodsManager';
import SettingsPage from '../components/SettingsPage';
import { LayoutDashboard, FileText, Calculator, CreditCard, Settings, LogOut, Shield } from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Overview', end: true },
  { to: '/dashboard/bills', icon: FileText, label: 'Bills' },
  { to: '/dashboard/payment-plan', icon: Calculator, label: 'Payment Plan' },
  { to: '/dashboard/payment-methods', icon: CreditCard, label: 'Payment Methods' },
  { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
];

export default function Dashboard() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-slate-200 flex flex-col fixed h-full z-20">
        <div className="px-5 h-16 flex items-center border-b border-slate-200">
          <h1 className="text-lg font-bold text-slate-900 tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
            BillsEasyPay
          </h1>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5" data-testid="dashboard-nav">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-slate-900 text-white'
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
            <NavLink to="/admin"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 transition-all"
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
      <main className="ml-60 flex-1 min-h-screen">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <div>
            <p className="text-sm font-medium text-slate-900">
              Welcome, {user?.full_name?.split(' ')[0]}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-slate-500">Wallet Balance</p>
              <p className="text-sm font-bold text-slate-900">${(user?.wallet_balance || 0).toFixed(2)}</p>
            </div>
          </div>
        </header>

        <div className="p-8">
          <Routes>
            <Route index element={<DashboardHome user={user} refreshUser={refreshUser} />} />
            <Route path="bills" element={<BillsManager user={user} refreshUser={refreshUser} />} />
            <Route path="payment-plan" element={<PaymentPlanPage user={user} refreshUser={refreshUser} />} />
            <Route path="payment-methods" element={<PaymentMethodsManager user={user} refreshUser={refreshUser} />} />
            <Route path="settings" element={<SettingsPage user={user} refreshUser={refreshUser} />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
