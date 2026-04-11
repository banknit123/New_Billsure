import React, { useState, useEffect } from 'react';
import { axiosInstance, API } from '../App';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, DollarSign, Clock, CheckCircle, AlertTriangle, ArrowRight, TrendingUp } from 'lucide-react';

const DashboardHome = ({ user, refreshUser }) => {
  const [bills, setBills] = useState([]);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [billsRes, planRes] = await Promise.all([
        axiosInstance.get(`${API}/bills`),
        axiosInstance.get(`${API}/payment-plan/current`),
      ]);
      setBills(billsRes.data);
      setPlan(planRes.data.status === 'none' ? null : planRes.data);
    } catch {} finally {
      setLoading(false);
    }
  };

  const pending = bills.filter(b => b.status === 'pending');
  const paid = bills.filter(b => b.status === 'paid');
  const totalPending = pending.reduce((s, b) => s + (b.amount || 0), 0);
  const totalPaid = paid.reduce((s, b) => s + (b.amount || 0), 0);

  // Overdue detection
  const today = new Date().toISOString().slice(0, 10);
  const overdue = pending.filter(b => (b.due_date || '').slice(0, 10) < today);
  const upcoming = pending.filter(b => {
    const d = (b.due_date || '').slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    return d >= today && d <= in30;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-white rounded-lg border border-slate-200 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="customer-dashboard">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={FileText} label="Total Bills" value={bills.length}
          sub={`${pending.length} pending`} color="blue" />
        <StatCard icon={DollarSign} label="Outstanding" value={`$${totalPending.toFixed(2)}`}
          sub={`${pending.length} bills`} color="amber" />
        <StatCard icon={CheckCircle} label="Paid" value={`$${totalPaid.toFixed(2)}`}
          sub={`${paid.length} bills`} color="green" />
        <StatCard icon={TrendingUp} label="Wallet Balance" value={`$${(user?.wallet_balance || 0).toFixed(2)}`}
          sub="Available funds" color="slate" />
      </div>

      {/* Payment Plan Status */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs tracking-widest uppercase font-medium text-slate-400 mb-2">Payment Plan</p>
              {plan ? (
                <div>
                  <p className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
                    ${plan.deduction_amount?.toFixed(2)} / {plan.frequency}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    Covering ${plan.annual_total?.toFixed(2)}/yr + {plan.safety_buffer_pct}% buffer
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-lg font-semibold text-slate-900">No plan selected</p>
                  <p className="text-sm text-slate-500">Set up a payment plan to auto-pay your bills</p>
                </div>
              )}
            </div>
            <Button onClick={() => navigate('/dashboard/payment-plan')} data-testid="go-to-plan-btn"
              className="bg-slate-900 hover:bg-slate-800 text-sm">
              {plan ? 'Manage Plan' : 'Set Up Plan'} <ArrowRight className="ml-2" size={16} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {overdue.length > 0 && (
        <Card className="border-red-200 bg-red-50 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-semibold text-red-900 text-sm">
                  {overdue.length} Overdue Bill{overdue.length > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-red-700 mt-1">
                  Total: ${overdue.reduce((s, b) => s + b.amount, 0).toFixed(2)} overdue
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two columns: Upcoming + Recent Paid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upcoming Bills */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs tracking-widest uppercase font-medium text-slate-400">Upcoming (30 days)</p>
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/bills')}
                className="text-blue-600 text-xs" data-testid="view-all-bills-btn">
                View All
              </Button>
            </div>
            {upcoming.length === 0 ? (
              <p className="text-sm text-slate-400 py-4">No bills due in the next 30 days</p>
            ) : (
              <div className="space-y-3">
                {upcoming.slice(0, 5).map(bill => (
                  <div key={bill.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{bill.provider}</p>
                      <p className="text-xs text-slate-500">{bill.category} &middot; Due {bill.due_date?.slice(0, 10)}</p>
                    </div>
                    <span className="text-sm font-semibold text-slate-900">${bill.amount?.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recently Paid */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <p className="text-xs tracking-widest uppercase font-medium text-slate-400 mb-4">Recently Paid</p>
            {paid.length === 0 ? (
              <p className="text-sm text-slate-400 py-4">No paid bills yet</p>
            ) : (
              <div className="space-y-3">
                {paid.slice(0, 5).map(bill => (
                  <div key={bill.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{bill.provider}</p>
                      <p className="text-xs text-slate-500">{bill.category}</p>
                    </div>
                    <span className="text-sm font-semibold text-green-600">${bill.amount?.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, sub, color }) => {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-green-50 text-green-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow" data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs tracking-wider uppercase font-medium text-slate-400">{label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1" style={{ fontFamily: 'Outfit, sans-serif' }}>{value}</p>
            <p className="text-xs text-slate-500 mt-1">{sub}</p>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
            <Icon size={20} strokeWidth={1.5} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DashboardHome;
