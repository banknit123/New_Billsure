import React, { useState, useEffect } from 'react';
import { axiosInstance, API } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, Receipt, CheckCircle, AlertCircle, TrendingUp, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DashboardHome = ({ user, refreshUser }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await axiosInstance.get(`${API}/dashboard/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
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
      title: 'Wallet Balance',
      value: `$${stats?.wallet_balance?.toFixed(2) || '0.00'}`,
      icon: DollarSign,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      testId: 'stat-wallet-balance'
    },
    {
      title: 'Total Bills',
      value: stats?.total_bills || 0,
      icon: Receipt,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      testId: 'stat-total-bills'
    },
    {
      title: 'Pending Bills',
      value: stats?.pending_bills || 0,
      icon: AlertCircle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      testId: 'stat-pending-bills'
    },
    {
      title: 'Yearly Prediction',
      value: `$${stats?.total_yearly_prediction?.toFixed(2) || '0.00'}`,
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      testId: 'stat-yearly-prediction'
    }
  ];

  return (
    <div className="space-y-6" data-testid="dashboard-home">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
        <h2 className="text-3xl font-bold mb-2">Welcome back, {user?.full_name}!</h2>
        <p className="text-emerald-50 text-lg">Here's an overview of your bills and payments</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

      {/* Quick Actions */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              onClick={() => navigate('/dashboard/bills')} 
              className="bg-emerald-600 hover:bg-emerald-700 h-20 text-lg"
              data-testid="quick-action-add-bill"
            >
              <Plus className="mr-2" size={20} />
              Add New Bill
            </Button>
            <Button 
              onClick={() => navigate('/dashboard/wallet')} 
              variant="outline"
              className="h-20 text-lg border-2 hover:bg-emerald-50"
              data-testid="quick-action-add-funds"
            >
              <DollarSign className="mr-2" size={20} />
              Add Funds
            </Button>
            <Button 
              onClick={() => navigate('/dashboard/bills')} 
              variant="outline"
              className="h-20 text-lg border-2 hover:bg-emerald-50"
              data-testid="quick-action-view-bills"
            >
              <Receipt className="mr-2" size={20} />
              View All Bills
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.recent_transactions?.length > 0 ? (
            <div className="space-y-3">
              {stats.recent_transactions.map((transaction, index) => (
                <div 
                  key={transaction.id} 
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  data-testid={`transaction-${index}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      transaction.type === 'deposit' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {transaction.type === 'deposit' ? <TrendingUp size={20} /> : <Receipt size={20} />}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{transaction.description}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(transaction.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <p className={`font-bold ${
                    transaction.type === 'deposit' ? 'text-green-600' : 'text-blue-600'
                  }`}>
                    {transaction.type === 'deposit' ? '+' : '-'}${transaction.amount.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Receipt className="mx-auto mb-4 text-gray-400" size={48} />
              <p>No transactions yet</p>
              <p className="text-sm mt-2">Your recent transactions will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Bills Alert */}
      {stats?.bills_due_soon > 0 && (
        <Card className="shadow-md border-l-4 border-l-orange-500 bg-orange-50" data-testid="bills-due-soon-alert">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="text-orange-600 flex-shrink-0" size={24} />
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-1">Bills Due Soon!</h3>
                <p className="text-gray-700 mb-3">
                  You have {stats.bills_due_soon} bill{stats.bills_due_soon > 1 ? 's' : ''} due within the next 7 days
                </p>
                {stats.bills_due_soon_list && stats.bills_due_soon_list.length > 0 && (
                  <div className="space-y-2">
                    {stats.bills_due_soon_list.slice(0, 3).map((bill, index) => (
                      <div key={index} className="flex items-center justify-between bg-white p-3 rounded-lg">
                        <div>
                          <p className="font-semibold text-gray-900">{bill.category} - {bill.provider}</p>
                          <p className="text-sm text-gray-600">Due: {new Date(bill.due_date).toLocaleDateString()}</p>
                        </div>
                        <p className="font-bold text-orange-600">${bill.amount.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                )}
                <Button 
                  onClick={() => navigate('/dashboard/bills')} 
                  className="mt-4 bg-orange-600 hover:bg-orange-700"
                >
                  View All Bills
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insufficient Balance Warning */}
      {stats?.pending_bills > 0 && stats?.total_bill_amount > 0 && (
        <Card className="shadow-md border-l-4 border-l-red-500 bg-red-50" data-testid="upcoming-bills-alert">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="text-red-600 flex-shrink-0" size={24} />
              <div>
                <h3 className="font-bold text-gray-900 mb-1">Upcoming Bills</h3>
                <p className="text-gray-700">
                  You have {stats.pending_bills} pending bill{stats.pending_bills > 1 ? 's' : ''} totaling <span className="font-bold">${stats.total_bill_amount.toFixed(2)}</span>
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  {stats.wallet_balance < stats.total_bill_amount ? (
                    <span className="text-red-600 font-semibold">⚠️ Insufficient balance. Please add funds to your wallet.</span>
                  ) : (
                    <span className="text-green-600 font-semibold">✓ Your wallet has sufficient balance to cover these bills.</span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DashboardHome;