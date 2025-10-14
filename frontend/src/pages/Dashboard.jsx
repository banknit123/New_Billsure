import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { axiosInstance } from '../App';
import { API } from '../App';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { 
  LayoutDashboard, 
  Receipt, 
  Wallet, 
  Settings, 
  LogOut, 
  Plus,
  Menu,
  X,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp
} from 'lucide-react';
import DashboardHome from '../components/DashboardHome';
import BillsManager from '../components/BillsManager';
import WalletManager from '../components/WalletManager';
import SettingsPage from '../components/SettingsPage';

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
    // Fetch latest user data
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await axiosInstance.get(`${API}/auth/me`);
      setUser(response.data);
      localStorage.setItem('user', JSON.stringify(response.data));
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', testId: 'nav-dashboard' },
    { icon: Receipt, label: 'Bills', path: '/dashboard/bills', testId: 'nav-bills' },
    { icon: Wallet, label: 'Wallet', path: '/dashboard/wallet', testId: 'nav-wallet' },
    { icon: Settings, label: 'Settings', path: '/dashboard/settings', testId: 'nav-settings' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex" data-testid="dashboard-container">
      {/* Sidebar */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
          lg:relative lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        data-testid="sidebar"
      >
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xl">B</span>
                </div>
                <span className="ml-3 text-xl font-bold text-gray-900">BillEasyPay</span>
              </div>
              <button 
                onClick={() => setSidebarOpen(false)} 
                className="lg:hidden text-gray-500 hover:text-gray-700"
                data-testid="close-sidebar-btn"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* User Info */}
          <div className="p-6 border-b bg-gradient-to-br from-emerald-50 to-teal-50">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">
                  {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-semibold text-gray-900" data-testid="user-name">{user?.full_name || 'User'}</p>
                <p className="text-xs text-gray-600">{user?.email}</p>
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
                      : 'text-gray-700 hover:bg-gray-100'
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
          <div className="p-4 border-t">
            <Button
              variant="ghost"
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleLogout}
              data-testid="logout-btn"
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
          data-testid="sidebar-overlay"
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
                data-testid="open-sidebar-btn"
              >
                <Menu size={24} />
              </button>
              <div className="flex-1 lg:flex-none">
                <h1 className="text-2xl font-bold text-gray-900 ml-4 lg:ml-0">
                  {location.pathname === '/dashboard' && 'Dashboard'}
                  {location.pathname === '/dashboard/bills' && 'Bills Management'}
                  {location.pathname === '/dashboard/wallet' && 'Wallet'}
                  {location.pathname === '/dashboard/settings' && 'Settings'}
                </h1>
              </div>
              <div className="hidden lg:flex items-center gap-4">
                <div className="bg-emerald-50 px-4 py-2 rounded-lg" data-testid="wallet-balance-display">
                  <p className="text-xs text-gray-600">Wallet Balance</p>
                  <p className="text-lg font-bold text-emerald-600">
                    ${user?.wallet_balance?.toFixed(2) || '0.00'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
          <Routes>
            <Route path="/" element={<DashboardHome user={user} refreshUser={fetchUserData} />} />
            <Route path="/bills" element={<BillsManager user={user} refreshUser={fetchUserData} />} />
            <Route path="/wallet" element={<WalletManager user={user} refreshUser={fetchUserData} />} />
            <Route path="/settings" element={<SettingsPage user={user} refreshUser={fetchUserData} />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
