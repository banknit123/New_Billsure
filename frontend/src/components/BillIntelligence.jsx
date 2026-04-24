import React, { useState, useEffect } from 'react';
import { axiosInstance, API } from '../App';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  TrendingUp, TrendingDown, Minus, Lightbulb, BarChart3,
  Zap, Droplets, Flame, Wifi, Smartphone, Building, Shield,
  RefreshCw, Loader2, ArrowUpRight, ArrowDownRight, ChevronRight,
  PiggyBank, AlertTriangle, CheckCircle2, Info, Sparkles
} from 'lucide-react';

const CATEGORY_ICONS = {
  Electricity: Zap,
  Gas: Flame,
  Water: Droplets,
  Internet: Wifi,
  Mobile: Smartphone,
  Council: Building,
  Insurance: Shield,
  Other: BarChart3,
};

const CATEGORY_COLORS = {
  Electricity: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', bar: 'bg-amber-500' },
  Gas: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200', bar: 'bg-orange-500' },
  Water: { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200', bar: 'bg-cyan-500' },
  Internet: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200', bar: 'bg-violet-500' },
  Mobile: { bg: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-200', bar: 'bg-pink-500' },
  Council: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', bar: 'bg-slate-500' },
  Insurance: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', bar: 'bg-emerald-500' },
  Other: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', bar: 'bg-gray-500' },
};

const HIGHLIGHT_ICONS = {
  increasing: { icon: TrendingUp, color: 'text-red-500', bg: 'bg-red-50' },
  decreasing: { icon: TrendingDown, color: 'text-green-500', bg: 'bg-green-50' },
  stable: { icon: Minus, color: 'text-blue-500', bg: 'bg-blue-50' },
  warning: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50' },
  saving: { icon: PiggyBank, color: 'text-emerald-500', bg: 'bg-emerald-50' },
};

const PRIORITY_COLORS = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-blue-100 text-blue-700',
};

const BillIntelligence = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchInsights = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get(`${API}/insights/analyze`);
      setData(res.data);
    } catch (err) {
      setError('Failed to load insights. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchInsights(); }, []);

  if (loading) {
    return (
      <div className="space-y-6" data-testid="bill-intelligence-loading">
        <div className="h-10 w-64 bg-slate-200 rounded-lg animate-pulse" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-40 bg-white rounded-xl border border-slate-200 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-slate-200" data-testid="bill-intelligence-error">
        <CardContent className="p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 text-amber-500" size={32} />
          <p className="text-sm text-slate-600">{error}</p>
          <Button onClick={() => fetchInsights()} className="mt-4 bg-slate-900 hover:bg-slate-800 text-sm">Retry</Button>
        </CardContent>
      </Card>
    );
  }

  if (!data?.analytics) {
    return (
      <Card className="border-slate-200" data-testid="bill-intelligence-empty">
        <CardContent className="p-12 text-center">
          <BarChart3 className="mx-auto mb-4 text-slate-300" size={48} />
          <h3 className="text-lg font-semibold text-slate-900 mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>No Bill Data Yet</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">Upload your bills to unlock AI-powered spending insights, provider comparisons, and money-saving recommendations.</p>
        </CardContent>
      </Card>
    );
  }

  const { analytics, ai_insights } = data;

  return (
    <div className="space-y-6" data-testid="bill-intelligence-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }} data-testid="intelligence-title">
            Bill Intelligence
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">AI-powered insights to optimise your spending</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchInsights(true)}
          disabled={refreshing}
          className="border-slate-300 text-sm"
          data-testid="refresh-insights-btn"
        >
          {refreshing ? <Loader2 className="animate-spin mr-1.5" size={14} /> : <RefreshCw size={14} className="mr-1.5" />}
          Refresh
        </Button>
      </div>

      {/* AI Summary Card */}
      {ai_insights?.summary && (
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-sm" data-testid="ai-summary-card">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Sparkles size={18} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1.5">AI Summary</p>
                <p className="text-sm text-slate-700 leading-relaxed" data-testid="ai-summary-text">{ai_insights.summary}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniStat label="Total Spent" value={`$${analytics.total_spend.toFixed(2)}`} testId="stat-total-spend" />
        <MiniStat label="Total Bills" value={analytics.bill_count} testId="stat-bill-count" />
        <MiniStat label="Categories" value={analytics.category_insights.length} testId="stat-categories" />
        <MiniStat
          label="Trend"
          value={analytics.trend_direction === 'increasing' ? 'Increasing' : analytics.trend_direction === 'decreasing' ? 'Decreasing' : 'Stable'}
          icon={analytics.trend_direction === 'increasing' ? ArrowUpRight : analytics.trend_direction === 'decreasing' ? ArrowDownRight : Minus}
          iconColor={analytics.trend_direction === 'increasing' ? 'text-red-500' : analytics.trend_direction === 'decreasing' ? 'text-green-500' : 'text-blue-500'}
          testId="stat-trend"
        />
      </div>

      {/* AI Highlights */}
      {ai_insights?.highlights?.length > 0 && (
        <div>
          <p className="text-xs tracking-widest uppercase font-medium text-slate-400 mb-3">Key Highlights</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="ai-highlights">
            {ai_insights.highlights.map((h, i) => {
              const config = HIGHLIGHT_ICONS[h.type] || HIGHLIGHT_ICONS.stable;
              const Icon = config.icon;
              return (
                <Card key={i} className="border-slate-200 hover:shadow-md transition-shadow" data-testid={`highlight-${i}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon size={16} className={config.color} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{h.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{h.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Category Breakdown + Provider Comparison */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <Card className="border-slate-200 shadow-sm" data-testid="category-breakdown">
          <CardContent className="p-5">
            <p className="text-xs tracking-widest uppercase font-medium text-slate-400 mb-4">Spending by Category</p>
            <div className="space-y-4">
              {analytics.category_insights.map((ci, i) => {
                const colors = CATEGORY_COLORS[ci.category] || CATEGORY_COLORS.Other;
                const CatIcon = CATEGORY_ICONS[ci.category] || BarChart3;
                const maxSpend = Math.max(...analytics.category_insights.map(c => c.total_spent));
                const barWidth = maxSpend > 0 ? (ci.total_spent / maxSpend) * 100 : 0;

                return (
                  <div key={i} data-testid={`category-${ci.category.toLowerCase()}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-md ${colors.bg} flex items-center justify-center`}>
                          <CatIcon size={14} className={colors.text} />
                        </div>
                        <span className="text-sm font-medium text-slate-900">{ci.category}</span>
                        {ci.status === 'high' && (
                          <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">Above avg</span>
                        )}
                        {ci.status === 'low' && (
                          <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full font-medium">Below avg</span>
                        )}
                      </div>
                      <span className="text-sm font-bold text-slate-900">${ci.total_spent.toFixed(2)}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${colors.bar} rounded-full transition-all duration-700`} style={{ width: `${barWidth}%` }} />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-slate-400">{ci.bill_count} bill{ci.bill_count !== 1 ? 's' : ''} &middot; avg ${ci.avg_per_bill.toFixed(2)}</span>
                      <span className="text-[10px] text-slate-400">Benchmark: ${ci.benchmark_avg}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Provider Comparison */}
        <Card className="border-slate-200 shadow-sm" data-testid="provider-comparison">
          <CardContent className="p-5">
            <p className="text-xs tracking-widest uppercase font-medium text-slate-400 mb-4">Provider Comparison</p>
            {analytics.provider_comparison.length === 0 ? (
              <div className="text-center py-6">
                <Info className="mx-auto mb-2 text-slate-300" size={24} />
                <p className="text-sm text-slate-400">Add more bills to compare providers</p>
              </div>
            ) : (
              <div className="space-y-5">
                {analytics.provider_comparison.map((pc, i) => {
                  const colors = CATEGORY_COLORS[pc.category] || CATEGORY_COLORS.Other;
                  return (
                    <div key={i} data-testid={`provider-group-${pc.category.toLowerCase()}`}>
                      <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">{pc.category}</p>
                      <div className="space-y-2">
                        {pc.providers.map((p, j) => (
                          <div key={j} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 border border-slate-100">
                            <div className="flex items-center gap-2">
                              {j === 0 && pc.providers.length > 1 && (
                                <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                              )}
                              <span className="text-sm text-slate-700">{p.name}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-bold text-slate-900">${p.avg_cost.toFixed(2)}</span>
                              <span className="text-[10px] text-slate-400 ml-1">avg</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* AI Provider Insights */}
            {ai_insights?.provider_insights?.length > 0 && (
              <div className="mt-5 pt-4 border-t border-slate-200">
                <p className="text-xs font-semibold text-slate-500 mb-2">AI Provider Insights</p>
                <div className="space-y-2">
                  {ai_insights.provider_insights.map((pi, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-600" data-testid={`provider-insight-${i}`}>
                      <Lightbulb size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
                      <span><strong>{pi.category}:</strong> {pi.insight}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Spend Trend */}
      {analytics.monthly_trend.length > 1 && (
        <Card className="border-slate-200 shadow-sm" data-testid="monthly-trend">
          <CardContent className="p-5">
            <p className="text-xs tracking-widest uppercase font-medium text-slate-400 mb-4">Monthly Spending Trend</p>
            <div className="flex items-end gap-2 h-32">
              {analytics.monthly_trend.slice(-12).map((mt, i, arr) => {
                const maxAmt = Math.max(...arr.map(m => m.amount));
                const height = maxAmt > 0 ? (mt.amount / maxAmt) * 100 : 0;
                const prev = i > 0 ? arr[i - 1].amount : mt.amount;
                const isUp = mt.amount > prev;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1" data-testid={`trend-bar-${i}`}>
                    <span className="text-[9px] text-slate-400 font-medium">${mt.amount.toFixed(0)}</span>
                    <div
                      className={`w-full rounded-t-md transition-all duration-500 ${isUp ? 'bg-red-400' : 'bg-emerald-400'}`}
                      style={{ height: `${Math.max(height, 4)}%` }}
                    />
                    <span className="text-[9px] text-slate-400">{mt.month.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Savings Tips */}
      {ai_insights?.savings_tips?.length > 0 && (
        <div data-testid="savings-tips">
          <p className="text-xs tracking-widest uppercase font-medium text-slate-400 mb-3">Money-Saving Tips</p>
          <div className="space-y-3">
            {ai_insights.savings_tips.map((tip, i) => (
              <Card key={i} className="border-slate-200 hover:shadow-md transition-shadow" data-testid={`saving-tip-${i}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                      <PiggyBank size={16} className="text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[tip.priority] || PRIORITY_COLORS.medium}`}>
                          {tip.priority}
                        </span>
                        <span className="text-[10px] text-slate-400">{tip.category}</span>
                      </div>
                      <p className="text-sm text-slate-800 leading-relaxed">{tip.tip}</p>
                      {tip.potential_saving && (
                        <p className="text-xs font-semibold text-emerald-600 mt-1.5 flex items-center gap-1">
                          <PiggyBank size={12} /> Potential saving: {tip.potential_saving}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Seasonal Note */}
      {ai_insights?.seasonal_note && (
        <Card className="border-slate-200 bg-slate-50" data-testid="seasonal-note">
          <CardContent className="p-4 flex items-start gap-3">
            <Info size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-slate-600">{ai_insights.seasonal_note}</p>
          </CardContent>
        </Card>
      )}

      {/* No AI fallback */}
      {!ai_insights && (
        <Card className="border-amber-200 bg-amber-50" data-testid="no-ai-notice">
          <CardContent className="p-4 flex items-start gap-3">
            <Info size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">AI insights unavailable</p>
              <p className="text-xs text-amber-600 mt-0.5">Showing data-based analytics only. AI-powered recommendations require an active LLM key.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const MiniStat = ({ label, value, icon: Icon, iconColor, testId }) => (
  <Card className="border-slate-200 shadow-sm" data-testid={testId}>
    <CardContent className="p-4">
      <p className="text-[10px] tracking-wider uppercase font-medium text-slate-400">{label}</p>
      <div className="flex items-center gap-1.5 mt-1">
        {Icon && <Icon size={16} className={iconColor} />}
        <p className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>{value}</p>
      </div>
    </CardContent>
  </Card>
);

export default BillIntelligence;
