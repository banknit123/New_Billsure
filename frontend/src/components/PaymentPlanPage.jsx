import React, { useState, useEffect } from 'react';
import { axiosInstance, API } from '../App';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Calculator, Check, Calendar, DollarSign, Shield, ArrowRight, Loader2 } from 'lucide-react';

const PaymentPlanPage = ({ user, refreshUser }) => {
  const [calcData, setCalcData] = useState(null);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(null);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [calcRes, planRes] = await Promise.all([
        axiosInstance.get(`${API}/payment-plan/calculate`),
        axiosInstance.get(`${API}/payment-plan/current`),
      ]);
      setCalcData(calcRes.data);
      setCurrentPlan(planRes.data.status === 'none' ? null : planRes.data);
    } catch {} finally { setLoading(false); }
  };

  const selectPlan = async (freq) => {
    setSelecting(freq);
    try {
      const res = await axiosInstance.post(`${API}/payment-plan/select?frequency=${freq}`);
      setCurrentPlan(res.data);
      toast.success(`${freq.charAt(0).toUpperCase() + freq.slice(1)} plan activated!`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to set plan');
    } finally { setSelecting(null); }
  };

  const simulateDeduction = async () => {
    setSimulating(true);
    try {
      const res = await axiosInstance.post(`${API}/payment-plan/simulate-deduction`);
      toast.success(res.data.message);
      refreshUser();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Simulation failed');
    } finally { setSimulating(false); }
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
          Choose a fixed deduction amount — we'll pay your bills automatically
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
                <p className="text-xl font-bold text-blue-600" style={{ fontFamily: 'Outfit, sans-serif' }}>
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

            {/* Visual buffer bar */}
            <div className="mt-6">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Actual Bills</span>
                <span>+ {calcData.safety_buffer_pct}% Buffer</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full flex">
                  <div className="bg-slate-900 rounded-l-full" style={{
                    width: `${(calcData.annual_bill_total / calcData.buffered_annual * 100).toFixed(1)}%`
                  }} />
                  <div className="bg-blue-500 rounded-r-full" style={{
                    width: `${(100 - calcData.annual_bill_total / calcData.buffered_annual * 100).toFixed(1)}%`
                  }} />
                </div>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-slate-600">${calcData.annual_bill_total?.toFixed(2)}</span>
                <span className="text-blue-600">+${(calcData.buffered_annual - calcData.annual_bill_total).toFixed(2)}</span>
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
                        <Check size={14} className="text-blue-600" />
                        <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Active Plan</span>
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
                        <span>{calcData.safety_buffer_pct}% safety buffer included</span>
                      </div>
                    </div>

                    <Button
                      onClick={() => selectPlan(opt.frequency)}
                      disabled={selecting === opt.frequency || isActive}
                      className={`w-full text-sm ${
                        isActive ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-900 hover:bg-slate-800'
                      }`}
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

      {/* Active Plan Details */}
      {currentPlan && (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs tracking-widest uppercase font-medium text-slate-400">Active Plan Details</p>
              <Button variant="outline" size="sm" onClick={simulateDeduction} disabled={simulating}
                className="border-slate-300 text-sm" data-testid="simulate-deduction-btn">
                {simulating ? <Loader2 className="animate-spin mr-1" size={14} /> : null}
                Simulate Deduction
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-xs text-slate-500">Deduction</p>
                <p className="text-lg font-bold text-slate-900">${currentPlan.deduction_amount?.toFixed(2)}</p>
                <p className="text-xs text-slate-500 capitalize">{currentPlan.frequency}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Collected</p>
                <p className="text-lg font-bold text-green-600">${currentPlan.total_collected?.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Paid Out</p>
                <p className="text-lg font-bold text-slate-900">${currentPlan.total_paid_out?.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Next Deduction</p>
                <p className="text-lg font-bold text-slate-900">{currentPlan.next_deduction_date?.slice(0, 10)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PaymentPlanPage;
