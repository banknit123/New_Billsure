import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { axiosInstance, API } from '../App';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Calculator, Check, Calendar, DollarSign, Shield, ArrowRight, Loader2,
  CreditCard, Zap, History, ExternalLink, Play, Building2
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Link } from 'react-router-dom';

const PaymentPlanPage = ({ user, refreshUser }) => {
  const [searchParams] = useSearchParams();
  const [calcData, setCalcData] = useState(null);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(null);
  const [checkingOut, setCheckingOut] = useState(null);
  const [triggering, setTriggering] = useState(false);
  const [paymentType, setPaymentType] = useState('card'); // 'card' or 'au_becs_debit'
  const [becsAgreed, setBecsAgreed] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [calcRes, planRes, txRes] = await Promise.all([
        axiosInstance.get(`${API}/payment-plan/calculate`),
        axiosInstance.get(`${API}/payment-plan/current`),
        axiosInstance.get(`${API}/transactions/history`),
      ]);
      setCalcData(calcRes.data);
      setCurrentPlan(planRes.data.status === 'none' ? null : planRes.data);
      setTransactions(txRes.data);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Handle Stripe redirect back
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      pollPaymentStatus(sessionId);
    }
  }, [searchParams]);

  const pollPaymentStatus = async (sessionId) => {
    try {
      const res = await axiosInstance.get(`${API}/payments/status/${sessionId}`);
      if (res.data.payment_status === 'paid') {
        toast.success(`Payment of $${res.data.amount.toFixed(2)} successful! Wallet updated.`);
        refreshUser();
        fetchData();
      } else if (res.data.status === 'expired') {
        toast.error('Payment session expired');
      } else {
        toast.info('Payment is being processed...');
        // Poll again in 3 seconds
        setTimeout(() => pollPaymentStatus(sessionId), 3000);
      }
    } catch {}
  };

  const selectPlan = async (freq) => {
    setSelecting(freq);
    try {
      const res = await axiosInstance.post(`${API}/payment-plan/select?frequency=${freq}`);
      setCurrentPlan(res.data);
      toast.success(`${freq.charAt(0).toUpperCase() + freq.slice(1)} plan activated!`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to set plan');
    } finally { setSelecting(null); }
  };

  const handleStripeCheckout = async (packageId) => {
    setCheckingOut(packageId);
    try {
      const res = await axiosInstance.post(`${API}/payments/create-checkout`, {
        package_id: packageId,
        origin_url: window.location.origin,
        payment_method_type: paymentType,
      });
      // Redirect to Stripe
      window.location.href = res.data.url;
    } catch (err) {
      const detail = err.response?.data?.detail || '';
      if (detail.includes('BECS') && paymentType === 'au_becs_debit') {
        toast.error('BECS Direct Debit is not yet enabled. Switching to card payment.');
        setPaymentType('card');
      } else {
        toast.error(detail || 'Failed to create checkout');
      }
      setCheckingOut(null);
    }
  };

  const triggerScheduler = async () => {
    setTriggering(true);
    try {
      const res = await axiosInstance.post(`${API}/scheduler/trigger-now`);
      const msg = [];
      if (res.data.deductions_made > 0) msg.push(`${res.data.deductions_made} deduction processed`);
      if (res.data.bills_paid > 0) msg.push(`${res.data.bills_paid} bill(s) auto-paid`);
      toast.success(msg.length > 0 ? msg.join(', ') : 'No deductions or bills due right now');
      refreshUser();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Scheduler trigger failed');
    } finally { setTriggering(false); }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-white rounded-lg border border-slate-200 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="payment-plan-page">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
          Payment Plan
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Choose a fixed deduction amount — bills are auto-paid when due
        </p>
      </div>

      {/* Bill Summary */}
      {calcData && (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <p className="text-xs tracking-widest uppercase font-medium text-slate-400 mb-4">Your Bill Summary</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-xs text-slate-500">Pending Bills</p>
                <p className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  {calcData.total_pending_bills}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Annual Total</p>
                <p className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  ${calcData.annual_bill_total?.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Safety Buffer</p>
                <p className="text-xl font-bold text-teal" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  {calcData.safety_buffer_pct}%
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Buffered Annual</p>
                <p className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  ${calcData.buffered_annual?.toFixed(2)}
                </p>
              </div>
            </div>
            {/* Buffer bar */}
            <div className="mt-6">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Actual Bills</span>
                <span>+ {calcData.safety_buffer_pct}% Buffer</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full flex">
                  <div className="bg-navy rounded-l-full" style={{
                    width: `${(calcData.annual_bill_total / calcData.buffered_annual * 100).toFixed(1)}%`
                  }} />
                  <div className="bg-teal-500 rounded-r-full" style={{
                    width: `${(100 - calcData.annual_bill_total / calcData.buffered_annual * 100).toFixed(1)}%`
                  }} />
                </div>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-slate-600">${calcData.annual_bill_total?.toFixed(2)}</span>
                <span className="text-teal">+${(calcData.buffered_annual - calcData.annual_bill_total).toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3 Plan Options */}
      {calcData && calcData.total_pending_bills > 0 && (
        <>
          <p className="text-xs tracking-widest uppercase font-medium text-slate-400">Choose Your Plan</p>
          <div className="grid md:grid-cols-3 gap-6">
            {calcData.options.map((opt) => {
              const isActive = currentPlan?.frequency === opt.frequency && currentPlan?.status === 'active';
              return (
                <Card key={opt.frequency}
                  className={`border shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                    isActive ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200'
                  }`}
                  data-testid={`plan-option-${opt.frequency}`}
                >
                  <CardContent className="p-6">
                    {isActive && (
                      <div className="flex items-center gap-1.5 mb-3">
                        <Check size={14} className="text-teal" />
                        <span className="text-xs font-semibold text-teal uppercase tracking-wider">Active Plan</span>
                      </div>
                    )}
                    <p className="text-xs tracking-widest uppercase font-medium text-slate-400 mb-1">{opt.label}</p>
                    <p className="text-3xl font-bold text-slate-900 mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>
                      ${opt.amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500 mb-4">per {opt.frequency === 'fortnightly' ? 'fortnight' : opt.frequency.replace('ly', '')}</p>
                    <div className="space-y-2 mb-5">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Calendar size={14} className="text-slate-400" />
                        <span>{opt.deductions_per_year}x deductions/year</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <DollarSign size={14} className="text-slate-400" />
                        <span>Covers ${calcData.annual_bill_total?.toFixed(2)}/yr</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Shield size={14} className="text-blue-500" />
                        <span>{calcData.safety_buffer_pct}% safety buffer</span>
                      </div>
                    </div>
                    <Button
                      onClick={() => selectPlan(opt.frequency)}
                      disabled={selecting === opt.frequency || isActive}
                      className={`w-full text-sm ${isActive ? 'bg-teal hover:bg-teal-600' : 'bg-navy hover:bg-navy-700'}`}
                      data-testid={`select-plan-${opt.frequency}`}
                    >
                      {selecting === opt.frequency ? (
                        <Loader2 className="animate-spin mr-2" size={16} />
                      ) : isActive ? (
                        <><Check size={16} className="mr-1" /> Current Plan</>
                      ) : (
                        <>Select {opt.label} <ArrowRight className="ml-2" size={16} /></>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {calcData && calcData.total_pending_bills === 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-8 text-center">
            <Calculator className="mx-auto text-slate-300 mb-3" size={40} />
            <p className="text-slate-500">Add some bills first to calculate your payment plan</p>
          </CardContent>
        </Card>
      )}

      {/* Active Plan + Fund & Trigger */}
      {currentPlan && (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-5">
              <p className="text-xs tracking-widest uppercase font-medium text-slate-400">Active Plan Details</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={triggerScheduler} disabled={triggering}
                  className="border-slate-300 text-sm" data-testid="trigger-scheduler-btn">
                  {triggering ? <Loader2 className="animate-spin mr-1" size={14} /> : <Play size={14} className="mr-1" />}
                  Run Auto-Pay Now
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
              <div>
                <p className="text-xs text-slate-500">Deduction</p>
                <p className="text-lg font-bold text-slate-900">${currentPlan.deduction_amount?.toFixed(2)}</p>
                <p className="text-xs text-slate-500 capitalize">{currentPlan.frequency}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Collected</p>
                <p className="text-lg font-bold text-green-600">${(currentPlan.total_collected || 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Paid Out</p>
                <p className="text-lg font-bold text-slate-900">${(currentPlan.total_paid_out || 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Next Deduction</p>
                <p className="text-lg font-bold text-slate-900">{currentPlan.next_deduction_date?.slice(0, 10)}</p>
              </div>
            </div>

            {/* Stripe Top-Up Section */}
            <div className="border-t border-slate-200 pt-5">
              <p className="text-xs tracking-widest uppercase font-medium text-slate-400 mb-3">Fund Wallet via Stripe</p>

              {/* Payment Method Toggle */}
              <div className="flex gap-2 mb-4" data-testid="payment-method-toggle">
                <button
                  onClick={() => setPaymentType('card')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    paymentType === 'card'
                      ? 'bg-navy text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  data-testid="payment-type-card"
                >
                  <CreditCard size={16} />
                  Card
                </button>
                <button
                  onClick={() => setPaymentType('au_becs_debit')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    paymentType === 'au_becs_debit'
                      ? 'bg-navy text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  data-testid="payment-type-becs"
                >
                  <Building2 size={16} />
                  Bank (BECS Direct Debit)
                </button>
              </div>

              {paymentType === 'au_becs_debit' && (
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-4 text-xs text-blue-800" data-testid="becs-info-banner">
                  <p className="font-semibold mb-1">AU BECS Direct Debit</p>
                  <p>Pay directly from your Australian bank account. BSB and account details are collected securely by Stripe — never stored on our servers. PCI DSS compliant.</p>
                  <div className="flex items-start gap-2 mt-3 pt-3 border-t border-teal-200">
                    <Checkbox
                      id="becs-agree"
                      checked={becsAgreed}
                      onCheckedChange={setBecsAgreed}
                      data-testid="becs-agree-checkbox"
                      className="mt-0.5"
                    />
                    <label htmlFor="becs-agree" className="text-xs text-blue-800 leading-relaxed cursor-pointer">
                      I have read and agree to the{' '}
                      <Link to="/legal/becs" target="_blank" className="font-semibold underline hover:text-teal">BECS Direct Debit Service Agreement</Link>
                      {' '}and authorise EasyBillsPay to debit my account.
                    </label>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { id: 'small', label: '$50' },
                  { id: 'medium', label: '$100' },
                  { id: 'large', label: '$250' },
                  { id: 'custom_plan', label: `$${currentPlan.deduction_amount?.toFixed(2)} (Plan)` },
                ].map(pkg => (
                  <Button key={pkg.id} variant="outline" size="sm"
                    onClick={() => handleStripeCheckout(pkg.id)}
                    disabled={checkingOut === pkg.id || (paymentType === 'au_becs_debit' && !becsAgreed)}
                    className="border-slate-300 text-sm h-10 hover:border-blue-400 hover:bg-teal-50"
                    data-testid={`stripe-topup-${pkg.id}`}
                  >
                    {checkingOut === pkg.id ? (
                      <Loader2 className="animate-spin mr-1" size={14} />
                    ) : paymentType === 'au_becs_debit' ? (
                      <Building2 size={14} className="mr-1.5 text-teal" />
                    ) : (
                      <CreditCard size={14} className="mr-1.5 text-teal" />
                    )}
                    {pkg.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                <ExternalLink size={12} /> Redirects to secure Stripe checkout
                {paymentType === 'au_becs_debit' && ' (BECS Direct Debit)'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction History */}
      {transactions.length > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
              <History size={16} className="text-slate-400" />
              <p className="text-sm font-semibold text-slate-900">Transaction History</p>
            </div>
            <div className="divide-y divide-slate-100">
              {transactions.slice(0, 15).map((tx, i) => (
                <div key={i} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors" data-testid={`tx-row-${i}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      tx.type === 'auto_deduction' || tx.type === 'plan_deduction' || tx.type === 'stripe_topup' || tx.type === 'deposit'
                        ? 'bg-green-50 text-green-600'
                        : tx.type === 'auto_bill_payment' || tx.type === 'bill_payment'
                          ? 'bg-teal-50 text-teal'
                          : 'bg-slate-100 text-slate-600'
                    }`}>
                      {tx.type.includes('deduction') || tx.type.includes('deposit') || tx.type.includes('topup') ? (
                        <DollarSign size={16} />
                      ) : (
                        <Zap size={16} />
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-slate-900">{tx.description}</p>
                      <p className="text-xs text-slate-500">{tx.type.replace(/_/g, ' ')} &middot; {tx.created_at?.slice(0, 10)}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${
                    tx.type.includes('deduction') || tx.type.includes('deposit') || tx.type.includes('topup')
                      ? 'text-green-600' : 'text-slate-900'
                  }`}>
                    {tx.type.includes('deduction') || tx.type.includes('deposit') || tx.type.includes('topup') ? '+' : '-'}${tx.amount?.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PaymentPlanPage;
