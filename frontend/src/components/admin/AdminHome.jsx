import React, { useState, useEffect } from 'react';
import { axiosInstance, API } from '../../App';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, DollarSign, FileText, TrendingUp, AlertTriangle, CheckCircle, BarChart3, Wallet, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const AdminHome = () => {
  const [data, setData] = useState(null);
  const [outstanding, setOutstanding] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [finRes, outRes] = await Promise.all([
        axiosInstance.get(`${API}/admin/financial-overview`),
        axiosInstance.get(`${API}/admin/outstanding-by-period`),
      ]);
      setData(finRes.data);
      setOutstanding(outRes.data);
    } catch {} finally { setLoading(false); }
  };

  const downloadExport = async (type) => {
    try {
      const res = await axiosInstance.get(`${API}/admin/export/${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = type.includes('csv') ? `report_${Date.now()}.csv` : `report_${Date.now()}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {}
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-white rounded-lg border border-slate-200 animate-pulse" />)}
        </div>
      </div>
    );
  }

  const barData = outstanding ? [
    { name: 'Overdue', amount: outstanding.overdue?.total || 0, count: outstanding.overdue?.count || 0 },
    { name: '0-30 days', amount: outstanding.next_30_days?.total || 0, count: outstanding.next_30_days?.count || 0 },
    { name: '30-60 days', amount: outstanding['30_to_60_days']?.total || 0, count: outstanding['30_to_60_days']?.count || 0 },
    { name: '60-90 days', amount: outstanding['60_to_90_days']?.total || 0, count: outstanding['60_to_90_days']?.count || 0 },
    { name: '90+ days', amount: outstanding.beyond_90_days?.total || 0, count: outstanding.beyond_90_days?.count || 0 },
  ] : [];

  const pieData = data ? [
    { name: 'Collected', value: data.total_collected || 0 },
    { name: 'Pending', value: data.total_pending_amount || 0 },
    { name: 'Paid Out', value: data.total_paid_amount || 0 },
  ].filter(d => d.value > 0) : [];

  const PIE_COLORS = ['#2563EB', '#F59E0B', '#10B981'];

  return (
    <div className="space-y-8" data-testid="admin-financial-overview">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Financial Overview
          </h2>
          <p className="text-sm text-slate-500 mt-1">Company-wide billing and collection metrics</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadExport('financial-pdf')}
            className="border-slate-300 text-xs" data-testid="export-financial-pdf">
            <Download size={14} className="mr-1" /> PDF Report
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <KPI icon={Users} label="Total Users" value={data?.total_users || 0} sub={`${data?.active_plans || 0} active plans`} color="blue" />
        <KPI icon={DollarSign} label="Total Collected" value={`$${(data?.total_collected || 0).toFixed(2)}`} sub="From deductions" color="green" />
        <KPI icon={AlertTriangle} label="Pending Bills" value={data?.total_pending_bills || 0}
          sub={`$${(data?.total_pending_amount || 0).toFixed(2)}`} color="amber" />
        <KPI icon={TrendingUp} label="Monthly Forecast" value={`$${(data?.monthly_collection_forecast || 0).toFixed(2)}`}
          sub="Expected collections" color="slate" />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <KPI icon={Wallet} label="Company Float" value={`$${(data?.company_float || 0).toFixed(2)}`}
          sub="Collected - Paid Out" color="blue" />
        <KPI icon={CheckCircle} label="Bills Paid" value={data?.total_paid_bills || 0}
          sub={`$${(data?.total_paid_amount || 0).toFixed(2)}`} color="green" />
        <KPI icon={BarChart3} label="Total Paid Out" value={`$${(data?.total_paid_out || 0).toFixed(2)}`}
          sub="To providers" color="slate" />
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Bar Chart - Outstanding by Period */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <p className="text-xs tracking-widest uppercase font-medium text-slate-400 mb-4">Outstanding by Period</p>
            {barData.some(d => d.amount > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={v => `$${v}`} />
                  <Tooltip
                    formatter={(v) => [`$${v.toFixed(2)}`, 'Amount']}
                    contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
                  />
                  <Bar dataKey="amount" fill="#0F172A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">No outstanding bills</div>
            )}
          </CardContent>
        </Card>

        {/* Pie Chart - Money Flow */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <p className="text-xs tracking-widest uppercase font-medium text-slate-400 mb-4">Money Flow</p>
            {pieData.length > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="60%" height={280}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                      paddingAngle={3} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => `$${v.toFixed(2)}`}
                      contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: PIE_COLORS[i] }} />
                      <div>
                        <p className="text-xs text-slate-500">{d.name}</p>
                        <p className="text-sm font-semibold text-slate-900">${d.value.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">No data yet</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const KPI = ({ icon: Icon, label, value, sub, color }) => {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <Card className="border-slate-200 shadow-sm" data-testid={`admin-kpi-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs tracking-wider uppercase font-medium text-slate-400">{label}</p>
            <p className="text-lg sm:text-2xl font-bold text-slate-900 mt-1 truncate" style={{ fontFamily: 'Outfit, sans-serif' }}>{value}</p>
            <p className="text-[10px] sm:text-xs text-slate-500 mt-1 truncate">{sub}</p>
          </div>
          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colorMap[color]}`}>
            <Icon size={18} strokeWidth={1.5} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminHome;
