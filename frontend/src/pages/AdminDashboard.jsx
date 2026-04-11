import React from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import AdminHome from '../components/admin/AdminHome';
import AdminOutstanding from '../components/admin/AdminOutstanding';
import AdminCustomers from '../components/admin/AdminCustomers';
import { LayoutDashboard, FileText, Users, ArrowLeft, LogOut } from 'lucide-react';

const adminNavItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Financial Overview', end: true },
  { to: '/admin/outstanding', icon: FileText, label: 'Outstanding Bills' },
  { to: '/admin/customers', icon: Users, label: 'Customer Analytics' },
];

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex">
      <aside className="w-60 bg-white border-r border-slate-200 flex flex-col fixed h-full z-20">
        <div className="px-5 h-16 flex items-center border-b border-slate-200">
          <h1 className="text-lg font-bold text-slate-900 tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Admin Panel
          </h1>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {adminNavItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
              data-testid={`admin-nav-${label.toLowerCase().replace(/\s/g, '-')}`}
            >
              <Icon size={18} strokeWidth={1.5} />
              {label}
            </NavLink>
          ))}

          <NavLink to="/dashboard"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 transition-all mt-4"
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

      <main className="ml-60 flex-1 min-h-screen">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-8 sticky top-0 z-10">
          <p className="text-sm font-medium text-slate-900">Company Administration</p>
        </header>
        <div className="p-8">
          <Routes>
            <Route index element={<AdminHome />} />
            <Route path="outstanding" element={<AdminOutstanding />} />
            <Route path="customers" element={<AdminCustomers />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
