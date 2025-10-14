import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { axiosInstance, API } from '../App';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { LayoutDashboard, FileText, Users, LogOut, Menu, X } from 'lucide-react';
import AdminHome from '../components/admin/AdminHome';
import BulkPaymentReports from '../components/admin/BulkPaymentReports';
import UsersManagement from '../components/admin/UsersManagement';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      if (!parsedUser.is_admin) {
        toast.error('Admin access required');
        navigate('/dashboard');
        return;
      }
      setUser(parsedUser);
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin', testId: 'admin-nav-dashboard' },
    { icon: FileText, label: 'Bulk Reports', path: '/admin/reports', testId: 'admin-nav-reports' },
    { icon: Users, label: 'Users', path: '/admin/users', testId: 'admin-nav-users' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex" data-testid="admin-dashboard-container">
      {/* Sidebar */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-gray-900 to-gray-800 shadow-lg transform transition-transform duration-300 ease-in-out
          lg:relative lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        data-testid="admin-sidebar"
      >
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="p-6 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xl">B</span>
                </div>
                <div className="ml-3">
                  <span className="text-xl font-bold text-white">Admin Panel</span>
                  <p className="text-xs text-gray-400">BillEasyPay</p>
                </div>
              </div>
              <button 
                onClick={() => setSidebarOpen(false)} 
                className="lg:hidden text-gray-400 hover:text-white"
                data-testid="close-admin-sidebar-btn"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* User Info */}
          <div className="p-6 border-b border-gray-700">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">
                  {user?.full_name?.charAt(0).toUpperCase() || 'A'}
                </span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-semibold text-white" data-testid="admin-user-name">{user?.full_name || 'Admin'}</p>
                <p className="text-xs text-emerald-400">Administrator</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                    ${isActive 
                      ? 'bg-emerald-600 text-white shadow-md' 
                      : 'text-gray-300 hover:bg-gray-700'
                    }
                  `}
                  data-testid={item.testId}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-gray-700">
            <Button
              variant="ghost"
              className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-gray-700"
              onClick={handleLogout}
              data-testid="admin-logout-btn"
            >
              <LogOut size={20} className="mr-3" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          data-testid="admin-sidebar-overlay"
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-white shadow-sm sticky top-0 z-30">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-gray-500 hover:text-gray-700"
                data-testid="open-admin-sidebar-btn"
              >
                <Menu size={24} />
              </button>
              <div className="flex-1 lg:flex-none">
                <h1 className="text-2xl font-bold text-gray-900 ml-4 lg:ml-0">
                  {location.pathname === '/admin' && 'Admin Dashboard'}
                  {location.pathname === '/admin/reports' && 'Bulk Payment Reports'}
                  {location.pathname === '/admin/users' && 'User Management'}
                </h1>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
          <Routes>
            <Route path="/" element={<AdminHome />} />
            <Route path="/reports" element={<BulkPaymentReports />} />
            <Route path="/users" element={<UsersManagement />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;