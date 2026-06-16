import React, { useState } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import AdminHome from '../components/admin/AdminHome';
import AdminOutstanding from '../components/admin/AdminOutstanding';
import AdminCustomers from '../components/admin/AdminCustomers';
import AdminPayments from '../components/admin/AdminPayments';
import { LayoutDashboard, FileText, Users, ArrowLeft, LogOut, Menu, X, Banknote } from 'lucide-react';

const adminNavItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Financial Overview', end: true },
  { to: '/admin/payments', icon: Banknote, label: 'Payment Processing' },
  { to: '/admin/outstanding', icon: FileText, label: 'Outstanding Bills' },
  { to: '/admin/customers', icon: Users, label: 'Customer Analytics' },
];

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex">
      {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={closeSidebar} />}

      <aside className={`
        fixed h-full z-40 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200
        w-60
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="px-5 h-16 flex items-center justify-between border-b border-slate-200">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="BillSure" className="h-7 rounded" />
            <span className="text-xs font-semibold text-teal bg-teal-50 px-2 py-0.5 rounded">Admin</span>
          </div>
          <button className="lg:hidden text-slate-500 hover:text-slate-900" onClick={closeSidebar}>
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {adminNavItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end} onClick={closeSidebar}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive ? 'bg-navy text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
              data-testid={`admin-nav-${label.toLowerCase().replace(/\s/g, '-')}`}
            >
              <Icon size={18} strokeWidth={1.5} />
              {label}
            </NavLink>
          ))}

          <NavLink to="/dashboard" onClick={closeSidebar}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-teal hover:bg-blue-50 transition-all mt-4"
            data-testid="admin-back-to-dashboard"
          >
            <ArrowLeft size={18} strokeWidth={1.5} />
            Back to Dashboard
          </NavLink>
        </nav>

        <div className="px-3 py-4 border-t border-slate-200">
          <div className="px-3 mb-3">
            <p className="text-sm font-medium text-slate-900">{user?.full_name}</p>
            <p className="text-xs text-slate-500">Admin</p>
          </div>
          <button onClick={() => { logout(); navigate('/'); }} data-testid="admin-logout-btn"
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all">
            <LogOut size={18} strokeWidth={1.5} />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-h-screen lg:ml-60">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 sm:px-6 lg:px-8 sticky top-0 z-20">
          <button className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600 mr-3" onClick={() => setSidebarOpen(true)}
            data-testid="admin-mobile-menu-btn">
            <Menu size={20} />
          </button>
          <p className="text-sm font-medium text-slate-900">Company Administration</p>
        </header>
        <div className="p-4 sm:p-6 lg:p-8">
          <Routes>
            <Route index element={<AdminHome />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="outstanding" element={<AdminOutstanding />} />
            <Route path="customers" element={<AdminCustomers />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
