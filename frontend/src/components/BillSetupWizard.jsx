import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance, API } from '../App';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  Upload, FileText, Loader2, CheckCircle2, ArrowRight, ArrowLeft,
  ScanLine, Calendar, DollarSign, CreditCard, Building2, Shield, Check
} from 'lucide-react';
import StripePaymentMethodSetup from './StripePaymentMethodSetup';

const CATEGORIES = ['Electricity','Water','Gas','Internet','Mobile','Council','Insurance','Other'];

const STEPS = [
  { id: 'upload', label: 'Upload Bill' },
  { id: 'review', label: 'Review Details' },
  { id: 'plan', label: 'Payment Plan' },
  { id: 'payment', label: 'Payment Method' },
];

const BillSetupWizard = ({ user, refreshUser, onComplete }) => {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  // Step 1: Upload
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Step 2: Review extracted data
  const [formData, setFormData] = useState({
    category: '', provider: '', account_number: '',
    biller_code: '', reference_number: '', amount: '',
    due_date: '', frequency: 'monthly',
  });
  const [saving, setSaving] = useState(false);
  const [savedBillId, setSavedBillId] = useState(null);

  // Step 3: Payment plan
  const [calcData, setCalcData] = useState(null);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [selectedFreq, setSelectedFreq] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);

  // Step 4: Payment method
  const [methods, setMethods] = useState([]);
  const [methodsLoading, setMethodsLoading] = useState(false);
  const [showAddMethod, setShowAddMethod] = useState(false);

  // ===== Step 1: Upload & Extract =====
  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    const validTypes = ['image/jpeg','image/jpg','image/png','application/pdf'];
    if (!validTypes.includes(selected.type)) {
      toast.error('Please upload a JPG, PNG, or PDF file');
      return;
    }
    setFile(selected);
  };

  const handleExtract = async () => {
    if (!file) { toast.error('Select a file first'); return; }
    setProcessing(true);
    toast.info('Extracting bill details...');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await axiosInstance.post(`${API}/bills/extract`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      const d = res.data;
      setFormData({
        category: d.category || '', provider: d.provider || '',
        account_number: d.account_number || '', biller_code: d.biller_code || '',
        reference_number: d.reference_number || '', amount: d.amount ? String(d.amount) : '',
        due_date: d.due_date || '', frequency: d.frequency || 'monthly',
      });
      toast.success('Bill details extracted!');
      setStep(1); // Auto-advance to review
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Extraction failed');
    } finally { setProcessing(false); }
  };

  // ===== Step 2: Save Bill =====
  const handleSaveBill = async () => {
    if (!formData.provider || !formData.amount || !formData.due_date) {
      toast.error('Provider, amount, and due date are required');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...formData, amount: parseFloat(formData.amount) };
      const res = await axiosInstance.post(`${API}/bills`, payload);
      setSavedBillId(res.data.id);
      toast.success('Bill saved! Now set up your payment plan.');
      refreshUser();
      setStep(2); // Auto-advance to plan
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save bill');
    } finally { setSaving(false); }
  };

  // ===== Step 3: Payment Plan =====
  const fetchPlanData = useCallback(async () => {
    setPlanLoading(true);
    try {
      const [calcRes, planRes] = await Promise.all([
        axiosInstance.get(`${API}/payment-plan/calculate`),
        axiosInstance.get(`${API}/payment-plan/current`),
      ]);
      // Flatten options array to {weekly: amount, fortnightly: amount, monthly: amount}
      const raw = calcRes.data;
      const flat = {};
      if (raw.options) {
        raw.options.forEach(o => { flat[o.frequency] = o.amount; });
      } else {
        flat.weekly = raw.weekly;
        flat.fortnightly = raw.fortnightly;
        flat.monthly = raw.monthly;
      }
      setCalcData(flat);
      setCurrentPlan(planRes.data.status === 'none' ? null : planRes.data);
    } catch(err) { console.error(err.message); } finally { setPlanLoading(false); }
  }, []);

  useEffect(() => { if (step === 2) fetchPlanData(); }, [step, fetchPlanData]);

  const selectPlan = async (freq) => {
    setSelectedFreq(freq);
    try {
      await axiosInstance.post(`${API}/payment-plan/select`, { frequency: freq });
      toast.success(`${freq.charAt(0).toUpperCase() + freq.slice(1)} plan activated!`);
      refreshUser();
      setStep(3); // Auto-advance to payment method
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to select plan');
    }
  };

  // ===== Step 4: Payment Method =====
  const fetchMethods = useCallback(async () => {
    setMethodsLoading(true);
    try {
      const res = await axiosInstance.get(`${API}/payment-methods`);
      setMethods(res.data);
    } catch(err) { console.error(err.message); } finally { setMethodsLoading(false); }
  }, []);

  useEffect(() => { if (step === 3) fetchMethods(); }, [step, fetchMethods]);

  const finishSetup = () => {
    toast.success('Setup complete! Your bills are now managed automatically.');
    if (onComplete) onComplete();
    else navigate('/dashboard');
  };

  const currentStep = STEPS[step];

  return (
    <div className="max-w-2xl mx-auto" data-testid="bill-setup-wizard">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1">
            <div className={`flex items-center gap-2 ${i <= step ? 'text-teal' : 'text-slate-300'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                i < step ? 'bg-teal border-teal text-white' :
                i === step ? 'border-teal text-teal bg-teal-50' :
                'border-slate-200 text-slate-400'
              }`}>
                {i < step ? <Check size={14} /> : i + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${i <= step ? 'text-slate-800' : 'text-slate-400'}`}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-3 ${i < step ? 'bg-teal' : 'bg-slate-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* ===== STEP 1: Upload ===== */}
      {step === 0 && (
        <Card className="border-slate-200 shadow-sm" data-testid="wizard-step-upload">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto mb-4">
              <Upload size={28} className="text-teal" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>Upload Your Bill</h3>
            <p className="text-sm text-slate-500 mb-6">Upload a PDF or photo of your bill. We'll extract the details automatically.</p>

            <label className="block cursor-pointer mb-4">
              <div className={`border-2 border-dashed rounded-xl p-8 transition-colors ${
                file ? 'border-teal bg-teal-50/30' : 'border-slate-200 hover:border-teal-300'
              }`}>
                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText size={20} className="text-teal" />
                    <span className="text-sm font-medium text-slate-700">{file.name}</span>
                    <CheckCircle2 size={16} className="text-teal" />
                  </div>
                ) : (
                  <div>
                    <ScanLine size={32} className="text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Click to select PDF, JPG, or PNG</p>
                  </div>
                )}
              </div>
              <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} data-testid="bill-file-input" />
            </label>

            <Button onClick={handleExtract} disabled={!file || processing} className="bg-teal text-white hover:bg-teal-600 px-8" data-testid="extract-btn">
              {processing ? <><Loader2 className="animate-spin mr-2" size={16} /> Extracting...</> : <>Extract Bill Details <ArrowRight className="ml-2" size={16} /></>}
            </Button>

            <button onClick={() => { setFormData({ ...formData }); setStep(1); }} className="block mx-auto mt-4 text-xs text-slate-400 hover:text-teal transition-colors" data-testid="manual-entry-link">
              Or enter details manually
            </button>
          </CardContent>
        </Card>
      )}

      {/* ===== STEP 2: Review & Confirm ===== */}
      {step === 1 && (
        <Card className="border-slate-200 shadow-sm" data-testid="wizard-step-review">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>Review Bill Details</h3>
            <p className="text-xs text-slate-500 mb-5">Confirm the extracted information is correct</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs text-slate-500">Category</Label>
                <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}>
                  <SelectTrigger className="h-10 mt-1" data-testid="bill-category"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs text-slate-500">Provider</Label>
                <Input value={formData.provider} onChange={e => setFormData({...formData, provider: e.target.value})}
                  className="h-10 mt-1" placeholder="e.g. AGL Energy" data-testid="bill-provider" />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Amount ($)</Label>
                <Input type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})}
                  className="h-10 mt-1" placeholder="0.00" data-testid="bill-amount" />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Due Date</Label>
                <Input type="date" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})}
                  className="h-10 mt-1" data-testid="bill-due-date" />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Frequency</Label>
                <Select value={formData.frequency} onValueChange={v => setFormData({...formData, frequency: v})}>
                  <SelectTrigger className="h-10 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-slate-500">Account / Ref #</Label>
                <Input value={formData.account_number} onChange={e => setFormData({...formData, account_number: e.target.value})}
                  className="h-10 mt-1" placeholder="Optional" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => setStep(0)} className="flex-1 border-slate-200" data-testid="back-to-upload">
                <ArrowLeft size={14} className="mr-1" /> Back
              </Button>
              <Button onClick={handleSaveBill} disabled={saving} className="flex-1 bg-teal text-white hover:bg-teal-600" data-testid="confirm-bill-btn">
                {saving ? <Loader2 className="animate-spin mr-2" size={14} /> : <CheckCircle2 size={14} className="mr-2" />}
                Confirm & Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== STEP 3: Payment Plan ===== */}
      {step === 2 && (
        <Card className="border-slate-200 shadow-sm" data-testid="wizard-step-plan">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>Choose Payment Plan</h3>
            <p className="text-xs text-slate-500 mb-5">Select how often you'd like to make fixed payments</p>

            {currentPlan ? (
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-4" data-testid="existing-plan-notice">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 size={16} className="text-teal" />
                  <span className="text-sm font-semibold text-teal-800">Plan Active</span>
                </div>
                <p className="text-xs text-teal-700">
                  You're on a <strong>{currentPlan.frequency}</strong> plan — ${currentPlan.deduction_amount?.toFixed(2)}/period.
                  Your new bill has been included in the calculation.
                </p>
                <Button onClick={() => setStep(3)} className="mt-3 bg-teal text-white hover:bg-teal-600 text-sm" data-testid="continue-to-payment">
                  Continue <ArrowRight size={14} className="ml-1" />
                </Button>
              </div>
            ) : planLoading ? (
              <div className="py-8 text-center"><Loader2 className="animate-spin mx-auto text-slate-300" size={24} /></div>
            ) : calcData ? (
              <div className="space-y-3">
                {[
                  { freq: 'weekly', label: 'Weekly', amount: calcData.weekly },
                  { freq: 'fortnightly', label: 'Fortnightly', amount: calcData.fortnightly },
                  { freq: 'monthly', label: 'Monthly', amount: calcData.monthly },
                ].map(opt => (
                  <button key={opt.freq} onClick={() => selectPlan(opt.freq)}
                    disabled={selectedFreq}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
                      selectedFreq === opt.freq ? 'border-teal bg-teal-50' : 'border-slate-200 hover:border-teal-300'
                    }`}
                    data-testid={`plan-${opt.freq}`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{opt.label}</p>
                      <p className="text-xs text-slate-500">Fixed deduction every {opt.freq === 'weekly' ? 'week' : opt.freq === 'fortnightly' ? '2 weeks' : 'month'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-navy" style={{ fontFamily: 'Outfit' }}>${opt.amount?.toFixed(2)}</p>
                      <p className="text-[10px] text-slate-400">inc. 8% buffer</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-4">No bills to calculate plan.</p>
            )}

            <button onClick={() => setStep(1)} className="mt-4 text-xs text-slate-400 hover:text-teal transition-colors">
              <ArrowLeft size={12} className="inline mr-1" /> Back to bill details
            </button>
          </CardContent>
        </Card>
      )}

      {/* ===== STEP 4: Payment Method ===== */}
      {step === 3 && (
        <Card className="border-slate-200 shadow-sm" data-testid="wizard-step-payment">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>Payment Method</h3>
            <p className="text-xs text-slate-500 mb-5">How should we collect your fixed payments?</p>

            {methodsLoading ? (
              <div className="py-8 text-center"><Loader2 className="animate-spin mx-auto text-slate-300" size={24} /></div>
            ) : methods.length > 0 && !showAddMethod ? (
              <div data-testid="existing-methods">
                <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 size={16} className="text-teal" />
                    <span className="text-sm font-semibold text-teal-800">Payment method on file</span>
                  </div>
                  {methods.filter(m => m.is_primary).map(m => (
                    <div key={m.id} className="flex items-center gap-2 text-sm text-teal-700">
                      {m.type === 'bank_account' ? <Building2 size={14} /> : <CreditCard size={14} />}
                      <span>{m.label} {m.account_number_masked && `(${m.account_number_masked})`}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <Button onClick={finishSetup} className="flex-1 bg-teal text-white hover:bg-teal-600" data-testid="finish-setup-btn">
                    <CheckCircle2 size={14} className="mr-2" /> Complete Setup
                  </Button>
                  <Button variant="outline" onClick={() => setShowAddMethod(true)} className="border-slate-200 text-sm" data-testid="add-new-method-btn">
                    Add New
                  </Button>
                </div>
              </div>
            ) : (
              <div data-testid="add-method-form">
                <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 p-3 rounded-lg mb-4">
                  <Shield size={14} className="text-teal flex-shrink-0" />
                  Your card or bank details are entered directly into Stripe's secure form and never reach BillSure's servers.
                </div>
                <StripePaymentMethodSetup
                  onSaved={() => { setShowAddMethod(false); fetchMethods(); }}
                  onCancel={methods.length > 0 ? () => setShowAddMethod(false) : undefined}
                />
              </div>
            )}

            <button onClick={() => setStep(2)} className="mt-4 text-xs text-slate-400 hover:text-teal transition-colors">
              <ArrowLeft size={12} className="inline mr-1" /> Back to payment plan
            </button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BillSetupWizard;
