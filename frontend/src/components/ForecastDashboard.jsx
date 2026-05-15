import React, { useState, useEffect } from 'react';
import { axiosInstance, API } from '../App';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import {
  TrendingUp, Calendar, DollarSign, Shield, Loader2, RefreshCw,
  ArrowRight, PiggyBank, AlertTriangle, CheckCircle2, Zap, Target,
  BarChart3, ArrowUpRight, ArrowDownRight, Minus, Activity, Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ForecastDashboard = ({ user }) => {
  const [forecast, setForecast] = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [health, setHealth] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [frequency, setFrequency] = useState('monthly');
  const navigate = useNavigate();

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [predRes, simRes, healthRes, compRes] = await Promise.all([
        axiosInstance.get(`${API}/v2/predict-bills`),
        axiosInstance.get(`${API}/v2/simulate-plan?frequency=${frequency}`),
        axiosInstance.get(`${API}/v2/plan-health`),
        axiosInstance.get(`${API}/v2/savings-comparison`),
      ]);
      setForecast(predRes.data.prediction);
      setSimulation(simRes.data.simulation);
      setHealth(healthRes.data.health);
      setComparison(compRes.data.comparison);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, [frequency]);

  if (loading) {
    return (
      <div className="space-y-6" data-testid="forecast-loading">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-48 bg-white rounded-xl border border-slate-200 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!forecast) {
    return (
      <Card className="border-slate-200" data-testid="forecast-empty">
        <CardContent className="p-12 text-center">
          <Calendar className="mx-auto mb-4 text-slate-300" size={48} />
          <h3 className="text-lg font-semibold text-slate-900 mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>No Bills to Forecast</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-4">Upload your bills to unlock 12-month forecasting, payment smoothing, and savings analysis.</p>
          <Button onClick={() => navigate('/dashboard/bills')} className="bg-slate-900 hover:bg-slate-800 text-sm">
            Upload Bills <ArrowRight size={14} className="ml-1.5" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  const chartData = comparison?.has_data ? comparison.monthly_comparison : [];

  return (
    <div className="space-y-6" data-testid="forecast-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }} data-testid="forecast-title">
            Your Annual Plan
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">12-month forecast with smart payment smoothing</p>
        </div>
        <div className="flex items-center gap-2">
          {['weekly', 'fortnightly', 'monthly'].map(f => (
            <button
              key={f}
              onClick={() => setFrequency(f)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                frequency === f
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
              }`}
              data-testid={`freq-${f}`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Key Stats Row */}
      {simulation && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Your Fixed Payment"
            value={`$${simulation.smoothed_amount.toFixed(2)}`}
            sub={`per ${frequency === 'weekly' ? 'week' : frequency === 'fortnightly' ? 'fortnight' : 'month'}`}
            icon={DollarSign}
            color="bg-blue-50 text-blue-600"
            testId="stat-smoothed-amount"
          />
          <StatCard
            label="Annual Predicted"
            value={`$${simulation.annual_predicted.toFixed(2)}`}
            sub="inc. seasonal adjustments"
            icon={Calendar}
            color="bg-slate-100 text-slate-600"
            testId="stat-annual-predicted"
          />
          <StatCard
            label="Peak Month"
            value={simulation.peak_month.month}
            sub={`$${simulation.peak_month.amount.toFixed(2)}`}
            icon={ArrowUpRight}
            color="bg-red-50 text-red-500"
            testId="stat-peak-month"
          />
          <StatCard
            label="Seasonal Variance"
            value={`$${simulation.seasonal_variance.toFixed(2)}`}
            sub="smoothed away"
            icon={Activity}
            color="bg-emerald-50 text-emerald-600"
            testId="stat-variance"
          />
        </div>
      )}

      {/* Plan Health Banner */}
      {health && (
        <Card className={`shadow-sm ${
          health.status === 'healthy' ? 'border-emerald-200 bg-emerald-50' :
          health.status === 'tight' ? 'border-amber-200 bg-amber-50' :
          'border-red-200 bg-red-50'
        }`} data-testid="plan-health-card">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {health.status === 'healthy' ? (
                <CheckCircle2 className="text-emerald-600 flex-shrink-0 mt-0.5" size={20} />
              ) : health.status === 'tight' ? (
                <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
              ) : (
                <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              )}
              <div className="flex-1">
                <p className={`text-sm font-semibold ${
                  health.status === 'healthy' ? 'text-emerald-900' :
                  health.status === 'tight' ? 'text-amber-900' : 'text-red-900'
                }`}>{health.message}</p>
                <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-600">
                  <span>Wallet: <strong>${health.wallet_balance.toFixed(2)}</strong></span>
                  <span>Upcoming 90d: <strong>${health.upcoming_bills_90d.toFixed(2)}</strong></span>
                  <span>Projected balance: <strong>${health.projected_balance_90d.toFixed(2)}</strong></span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Forecast Chart: Traditional vs Smoothed */}
      {chartData.length > 0 && (
        <Card className="border-slate-200 shadow-sm" data-testid="forecast-chart">
          <CardContent className="p-5">
            <p className="text-xs tracking-widest uppercase font-medium text-slate-400 mb-4">12-Month Forecast: Traditional vs Smoothed</p>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradTraditional" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f87171" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradSmoothed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} width={60} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={(v, name) => [`$${v.toFixed(2)}`, name]}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="traditional" name="Traditional" stroke="#f87171" strokeWidth={2} fill="url(#gradTraditional)" />
                <Area type="monotone" dataKey="smoothed" name="Smoothed" stroke="#3b82f6" strokeWidth={2} fill="url(#gradSmoothed)" strokeDasharray="6 3" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Savings Comparison */}
      {comparison?.has_data && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Savings Summary */}
          <Card className="border-slate-200 shadow-sm" data-testid="savings-summary">
            <CardContent className="p-5">
              <p className="text-xs tracking-widest uppercase font-medium text-slate-400 mb-4">Savings vs Traditional Billing</p>
              <div className="space-y-4">
                <CompareRow
                  label="Predictability"
                  left={`${comparison.traditional.predictability_score}%`}
                  right="100%"
                  leftLabel="Traditional"
                  rightLabel="Smoothed"
                  highlight="right"
                />
                <CompareRow
                  label="Peak Monthly Bill"
                  left={`$${comparison.traditional.peak_month.toFixed(2)}`}
                  right={`$${comparison.smoothed.fixed_monthly.toFixed(2)}`}
                  leftLabel="Traditional"
                  rightLabel="Smoothed"
                  highlight="right"
                />
                <CompareRow
                  label="Monthly Variance"
                  left={`$${comparison.traditional.variance.toFixed(2)}`}
                  right="$0.00"
                  leftLabel="Traditional"
                  rightLabel="Smoothed"
                  highlight="right"
                />
                {comparison.savings_analysis.bill_shock_avoided > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mt-2">
                    <div className="flex items-center gap-2">
                      <PiggyBank size={16} className="text-emerald-600" />
                      <span className="text-sm font-semibold text-emerald-800">
                        Bill shock avoided: ${comparison.savings_analysis.bill_shock_avoided.toFixed(2)}/month
                      </span>
                    </div>
                    <p className="text-xs text-emerald-600 mt-1">
                      Your peak month would cost ${comparison.traditional.peak_month.toFixed(2)} — smoothing fixes it at ${comparison.smoothed.fixed_monthly.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Category Forecast Bars */}
          {forecast?.category_breakdown && (
            <Card className="border-slate-200 shadow-sm" data-testid="category-forecast">
              <CardContent className="p-5">
                <p className="text-xs tracking-widest uppercase font-medium text-slate-400 mb-4">Annual Forecast by Category</p>
                <div className="space-y-3">
                  {Object.entries(forecast.category_breakdown)
                    .sort(([, a], [, b]) => b.annual - a.annual)
                    .map(([cat, data]) => {
                      const maxAnnual = Math.max(...Object.values(forecast.category_breakdown).map(d => d.annual));
                      const pct = maxAnnual > 0 ? (data.annual / maxAnnual) * 100 : 0;
                      return (
                        <div key={cat} data-testid={`forecast-cat-${cat.toLowerCase()}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-slate-700">{cat}</span>
                            <span className="text-sm font-bold text-slate-900">${data.annual.toFixed(0)}/yr</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">{data.bill_count} bill{data.bill_count !== 1 ? 's' : ''} &middot; ~${data.monthly_avg.toFixed(2)}/mo avg</p>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Upcoming Bills Timeline */}
      {health?.upcoming_bills?.length > 0 && (
        <Card className="border-slate-200 shadow-sm" data-testid="upcoming-timeline">
          <CardContent className="p-5">
            <p className="text-xs tracking-widest uppercase font-medium text-slate-400 mb-4">Upcoming Bills (90 days)</p>
            <div className="space-y-2">
              {health.upcoming_bills.slice(0, 8).map((b, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 border border-slate-100" data-testid={`upcoming-bill-${i}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Clock size={14} className="text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{b.provider}</p>
                      <p className="text-[10px] text-slate-400">Due in {b.days_until} day{b.days_until !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-slate-900">${b.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const StatCard = ({ label, value, sub, icon: Icon, color, testId }) => (
  <Card className="border-slate-200 shadow-sm" data-testid={testId}>
    <CardContent className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] tracking-wider uppercase font-medium text-slate-400">{label}</p>
          <p className="text-lg font-bold text-slate-900 mt-1" style={{ fontFamily: 'Outfit, sans-serif' }}>{value}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
        </div>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
          <Icon size={16} />
        </div>
      </div>
    </CardContent>
  </Card>
);

const CompareRow = ({ label, left, right, leftLabel, rightLabel, highlight }) => (
  <div>
    <p className="text-xs font-medium text-slate-500 mb-1.5">{label}</p>
    <div className="flex items-center gap-3">
      <div className={`flex-1 text-center py-2 rounded-lg border text-sm font-semibold ${
        highlight === 'left' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-600'
      }`}>
        <span className="block text-[10px] font-normal text-slate-400 mb-0.5">{leftLabel}</span>
        {left}
      </div>
      <ArrowRight size={14} className="text-slate-300 flex-shrink-0" />
      <div className={`flex-1 text-center py-2 rounded-lg border text-sm font-semibold ${
        highlight === 'right' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-600'
      }`}>
        <span className="block text-[10px] font-normal text-slate-400 mb-0.5">{rightLabel}</span>
        {right}
      </div>
    </div>
  </div>
);

export default ForecastDashboard;
