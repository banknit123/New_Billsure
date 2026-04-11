import React, { useState, useEffect } from 'react';
import { axiosInstance, API } from '../../App';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Clock, Calendar } from 'lucide-react';

const AdminOutstanding = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await axiosInstance.get(`${API}/admin/outstanding-by-period`);
      setData(res.data);
    } catch {} finally { setLoading(false); }
  };

  if (loading) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-white rounded-lg border animate-pulse" />)}</div>;
  }

  const periods = [
    { key: 'overdue', label: 'Overdue', icon: AlertTriangle, color: 'red', data: data?.overdue },
    { key: 'next_30_days', label: 'Due in 0-30 Days', icon: Clock, color: 'amber', data: data?.next_30_days },
    { key: '30_to_60_days', label: 'Due in 30-60 Days', icon: Calendar, color: 'blue', data: data?.['30_to_60_days'] },
    { key: '60_to_90_days', label: 'Due in 60-90 Days', icon: Calendar, color: 'slate', data: data?.['60_to_90_days'] },
    { key: 'beyond_90_days', label: 'Beyond 90 Days', icon: Calendar, color: 'slate', data: data?.beyond_90_days },
  ];

  const colorMap = {
    red: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
    slate: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
  };

  return (
    <div className="space-y-6" data-testid="admin-outstanding-bills">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
          Outstanding Bills
        </h2>
        <p className="text-sm text-slate-500 mt-1">All customer bills grouped by time period for finance management</p>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {periods.map(({ key, label, data: pd, color }) => (
          <Card key={key} className={`border shadow-sm ${colorMap[color].border}`} data-testid={`period-summary-${key}`}>
            <CardContent className="p-4 text-center">
              <p className="text-xs font-medium text-slate-500 truncate">{label}</p>
              <p className={`text-xl font-bold mt-1 ${colorMap[color].text}`} style={{ fontFamily: 'Outfit, sans-serif' }}>
                {pd?.count || 0}
              </p>
              <p className="text-xs text-slate-500">${(pd?.total || 0).toFixed(2)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detail Tables */}
      {periods.map(({ key, label, icon: Icon, data: pd, color }) => {
        if (!pd || pd.count === 0) return null;
        return (
          <Card key={key} className="border-slate-200 shadow-sm" data-testid={`period-table-${key}`}>
            <CardContent className="p-0">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon size={18} className={colorMap[color].text} />
                  <span className="text-sm font-semibold text-slate-900">{label}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${colorMap[color].bg} ${colorMap[color].text}`}>
                    {pd.count} bills &middot; ${pd.total.toFixed(2)}
                  </span>
                </div>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-2">Provider</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-2">Category</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-2">Amount</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-2">Due Date</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-2">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {pd.bills.map((b, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 text-sm text-slate-900">{b.provider}</td>
                      <td className="px-6 py-3 text-sm text-slate-600">{b.category}</td>
                      <td className="px-6 py-3 text-sm font-medium text-slate-900">${b.amount?.toFixed(2)}</td>
                      <td className="px-6 py-3 text-sm text-slate-600">{b.due_date}</td>
                      <td className="px-6 py-3">
                        <span className={`text-xs font-medium ${b.days_until_due < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                          {b.days_until_due < 0 ? `${Math.abs(b.days_until_due)}d overdue` : `${b.days_until_due}d`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default AdminOutstanding;
