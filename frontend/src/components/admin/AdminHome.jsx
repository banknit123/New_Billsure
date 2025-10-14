import React, { useState, useEffect } from 'react';
import { axiosInstance, API } from '../../App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Receipt, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';

const AdminHome = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axiosInstance.get(`${API}/admin/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching admin stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Users',
      value: stats?.total_users || 0,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      testId: 'admin-stat-users'
    },
    {
      title: 'Total Bills',
      value: stats?.total_bills || 0,
      icon: Receipt,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      testId: 'admin-stat-bills'
    },
    {
      title: 'Pending Bills',
      value: stats?.pending_bills || 0,
      icon: AlertCircle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      testId: 'admin-stat-pending'
    },
    {
      title: 'Monthly Revenue',
      value: `$${stats?.monthly_revenue?.toFixed(2) || '0.00'}`,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      testId: 'admin-stat-revenue'
    },
    {
      title: 'Total Transactions',
      value: stats?.total_transactions || 0,
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      testId: 'admin-stat-transactions'
    }
  ];

  return (
    <div className="space-y-6" data-testid="admin-home">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-8 text-white shadow-lg">
        <h2 className="text-3xl font-bold mb-2">Admin Dashboard</h2>
        <p className="text-gray-300 text-lg">Monitor and manage BillEasyPay platform</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="shadow-md hover:shadow-lg transition-shadow" data-testid={stat.testId}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{stat.title}</p>
                    <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                  <div className={`${stat.bgColor} ${stat.color} p-3 rounded-xl`}>
                    <Icon size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Info */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Platform Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Key Metrics</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Average bills per user: {stats?.total_users > 0 ? (stats.total_bills / stats.total_users).toFixed(1) : 0}</li>
                <li>• Pending bill rate: {stats?.total_bills > 0 ? ((stats.pending_bills / stats.total_bills) * 100).toFixed(1) : 0}%</li>
                <li>• Monthly revenue per user: ${stats?.total_users > 0 ? (stats.monthly_revenue / stats.total_users).toFixed(2) : '0.00'}</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">System Status</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-gray-600">All systems operational</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-gray-600">Database connected</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-gray-600">Payment gateway ready</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminHome;