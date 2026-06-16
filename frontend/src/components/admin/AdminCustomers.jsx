import React, { useState, useEffect } from 'react';
import { axiosInstance, API } from '../../App';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, AlertTriangle, CheckCircle, Shield, Download } from 'lucide-react';

const AdminCustomers = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await axiosInstance.get(`${API}/admin/customer-analytics`);
      setData(res.data);
    } catch {} finally { setLoading(false); }
  };

  const downloadExport = async () => {
    try {
      const res = await axiosInstance.get(`${API}/admin/export/customers-csv`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customer_analytics_${Date.now()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {}
  };

  if (loading) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-white rounded-lg border animate-pulse" />)}</div>;
  }

  const customers = data?.customers || [];
  const highRisk = customers.filter(c => c.risk_level === 'high');
  const medRisk = customers.filter(c => c.risk_level === 'medium');
  const withPlan = customers.filter(c => c.has_plan);

  return (
    <div className="space-y-6" data-testid="admin-customer-analytics">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Customer Analytics
          </h2>
          <p className="text-sm text-slate-500 mt-1">Payment compliance, risk indicators, and collection metrics</p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadExport}
          className="border-slate-300 text-xs self-start" data-testid="export-customers-csv">
          <Download size={14} className="mr-1" /> Export CSV
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <SummaryCard icon={Users} label="Total Customers" value={customers.length} color="blue" />
        <SummaryCard icon={CheckCircle} label="Active Plans" value={withPlan.length} color="green" />
        <SummaryCard icon={AlertTriangle} label="High Risk" value={highRisk.length} color="red" />
        <SummaryCard icon={Shield} label="Medium Risk" value={medRisk.length} color="amber" />
      </div>

      {/* Customer Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b border-slate-200">
            <p className="text-sm font-semibold text-slate-900">All Customers</p>
          </div>
          {customers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No customers yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="customers-table">
                <thead>
                  <tr className="border-b border-slate-200">
                    {['Name', 'Email', 'Bills', 'Outstanding', 'Paid', 'Wallet', 'Plan', 'Risk'].map(h => (
                      <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customers.map(c => (
                    <tr key={c.user_id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors" data-testid={`customer-row-${c.user_id}`}>
                      <td className="px-5 py-3 text-sm font-medium text-slate-900">{c.name || '—'}</td>
                      <td className="px-5 py-3 text-sm text-slate-600">{c.email}</td>
                      <td className="px-5 py-3 text-sm text-slate-900">
                        {c.total_bills}
                        <span className="text-slate-400 text-xs ml-1">({c.pending_bills} pending)</span>
                      </td>
                      <td className="px-5 py-3 text-sm font-medium text-amber-600">${c.total_pending_amount.toFixed(2)}</td>
                      <td className="px-5 py-3 text-sm text-green-600">${c.total_paid_amount.toFixed(2)}</td>
                      <td className="px-5 py-3 text-sm text-slate-900">${c.wallet_balance.toFixed(2)}</td>
                      <td className="px-5 py-3">
                        {c.has_plan ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-50 text-teal capitalize">
                            {c.plan_frequency}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">None</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          c.risk_level === 'high' ? 'bg-red-50 text-red-600' :
                          c.risk_level === 'medium' ? 'bg-amber-50 text-amber-600' :
                          'bg-green-50 text-green-600'
                        }`}>
                          {c.risk_level}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const SummaryCard = ({ icon: Icon, label, value, color }) => {
  const colors = {
    blue: 'bg-blue-50 text-teal',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs tracking-wider uppercase font-medium text-slate-400">{label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1" style={{ fontFamily: 'Outfit, sans-serif' }}>{value}</p>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
            <Icon size={20} strokeWidth={1.5} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminCustomers;
