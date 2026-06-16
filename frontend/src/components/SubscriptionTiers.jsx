import React, { useState, useEffect } from 'react';
import { axiosInstance, API } from '../App';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Check, Crown, Zap, Shield, Loader2, Star
} from 'lucide-react';

const TIER_STYLES = {
  basic: {
    accent: 'border-slate-200',
    badge: 'bg-slate-100 text-slate-600',
    btn: 'bg-slate-200 text-slate-700 hover:bg-slate-300',
    icon: Zap,
  },
  standard: {
    accent: 'border-teal-300 ring-2 ring-blue-100',
    badge: 'bg-teal-100 text-teal-700',
    btn: 'bg-teal text-white hover:bg-teal-600',
    icon: Star,
    popular: true,
  },
  premium: {
    accent: 'border-navy-300',
    badge: 'bg-navy-100 text-navy-700',
    btn: 'bg-navy text-white hover:bg-navy-700',
    icon: Crown,
  },
};

const SubscriptionTiers = ({ user, refreshUser }) => {
  const [tiers, setTiers] = useState([]);
  const [currentTier, setCurrentTier] = useState('basic');
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tiersRes, currentRes] = await Promise.all([
          axiosInstance.get(`${API}/v2/subscription/tiers`),
          axiosInstance.get(`${API}/v2/subscription/current`),
        ]);
        setTiers(tiersRes.data.tiers);
        setCurrentTier(currentRes.data.tier);
      } catch {} finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const selectTier = async (tierId) => {
    setSelecting(tierId);
    try {
      const res = await axiosInstance.post(`${API}/v2/subscription/select?tier=${tierId}`);
      setCurrentTier(tierId);
      toast.success(res.data.message);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update plan');
    } finally { setSelecting(null); }
  };

  if (loading) {
    return (
      <div className="grid md:grid-cols-3 gap-6" data-testid="tiers-loading">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-80 bg-white rounded-xl border border-slate-200 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div data-testid="subscription-tiers">
      <div className="text-center mb-8">
        <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }} data-testid="tiers-title">
          Choose Your Plan
        </h2>
        <p className="text-sm text-slate-500 mt-1">Predictable cashflow, smarter bill management</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {tiers.map((tier) => {
          const style = TIER_STYLES[tier.id] || TIER_STYLES.basic;
          const Icon = style.icon;
          const isCurrent = currentTier === tier.id;

          return (
            <Card
              key={tier.id}
              className={`relative shadow-sm hover:shadow-lg transition-shadow ${style.accent}`}
              data-testid={`tier-${tier.id}`}
            >
              {style.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-teal text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}
              <CardContent className="p-6 pt-8">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-8 h-8 rounded-lg ${style.badge} flex items-center justify-center`}>
                    <Icon size={16} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
                    {tier.name}
                  </h3>
                </div>

                <div className="mb-4">
                  {tier.monthly_fee === 0 ? (
                    <p className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
                      Free
                    </p>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
                        ${tier.monthly_fee.toFixed(2)}
                      </span>
                      <span className="text-sm text-slate-500">/month</span>
                    </div>
                  )}
                  <p className="text-xs text-slate-500 mt-1">{tier.description}</p>
                </div>

                <ul className="space-y-2.5 mb-6">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                      <Check size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full text-sm h-10 ${isCurrent ? 'bg-slate-100 text-slate-500 cursor-default' : style.btn}`}
                  disabled={isCurrent || selecting === tier.id}
                  onClick={() => !isCurrent && selectTier(tier.id)}
                  data-testid={`select-tier-${tier.id}`}
                >
                  {selecting === tier.id ? (
                    <Loader2 className="animate-spin mr-1.5" size={14} />
                  ) : isCurrent ? (
                    'Current Plan'
                  ) : (
                    `Select ${tier.name}`
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default SubscriptionTiers;
