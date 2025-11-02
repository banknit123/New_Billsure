import React, { useState } from 'react';
import { axiosInstance, API } from '../App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { CreditCard, CheckCircle, AlertCircle, FileText } from 'lucide-react';

const PROVIDER_TYPES = [
  'Electricity',
  'Water',
  'Gas',
  'Council',
  'Internet',
  'Mobile',
  'Insurance'
];

const DirectDebitRequestForm = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [bsbValidation, setBsbValidation] = useState(null);
  
  const [formData, setFormData] = useState({
    // Bank Details
    bank_name: '',
    bsb: '',
    account_number: '',
    account_holder_name: '',
    account_type: 'savings',
    
    // Provider Details
    provider: '',
    provider_type: '',
    provider_account_number: '',
    
    // Payment Details
    payment_frequency: 'monthly',
    max_payment_amount: '',
    start_date: '',
    
    // Authorization
    signature: '',
    terms_accepted: false,
    authorization_confirmed: false
  });

  const handleChange = (name, value) => {
    setFormData({ ...formData, [name]: value });
    
    // Real-time BSB validation
    if (name === 'bsb' && value.replace(/[^0-9]/g, '').length === 6) {
      validateBSB(value);
    }
  };

  const validateBSB = async (bsb) => {
    try {
      const response = await axiosInstance.post(`${API}/direct-debit/validate-bsb`, null, {
        params: { bsb }
      });
      setBsbValidation(response.data);
      if (response.data.valid) {
        setFormData(prev => ({ ...prev, bank_name: response.data.bank_name, bsb: response.data.formatted }));
      }
    } catch (error) {
      setBsbValidation({ valid: false, message: 'Invalid BSB' });
    }
  };

  const validateStep1 = () => {
    if (!formData.bank_name || !formData.bsb || !formData.account_number || !formData.account_holder_name) {
      toast.error('Please fill in all bank details');
      return false;
    }
    if (!bsbValidation || !bsbValidation.valid) {
      toast.error('Please enter a valid BSB');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.provider || !formData.provider_type || !formData.provider_account_number) {
      toast.error('Please fill in all provider details');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!formData.max_payment_amount || !formData.start_date) {
      toast.error('Please fill in all payment details');
      return false;
    }
    const amount = parseFloat(formData.max_payment_amount);
    if (amount <= 0 || amount > 10000) {
      toast.error('Maximum payment amount must be between $1 and $10,000');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 3 && !validateStep3()) return;
    setStep(step + 1);
  };

  const handleSubmit = async () => {
    if (!formData.signature) {
      toast.error('Please provide your signature');
      return;
    }
    if (!formData.terms_accepted || !formData.authorization_confirmed) {
      toast.error('Please accept all terms and authorization');
      return;
    }

    setLoading(true);
    try {
      const response = await axiosInstance.post(`${API}/direct-debit/create`, formData);
      toast.success('Direct Debit Request created successfully!');
      if (onComplete) onComplete(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create Direct Debit Request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="ddr-form">
      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center flex-1">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
              step >= s ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              {step > s ? <CheckCircle size={20} /> : s}
            </div>
            {s < 4 && <div className={`flex-1 h-1 mx-2 ${step > s ? 'bg-emerald-600' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Bank Details */}
      {step === 1 && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard size={24} />
              Step 1: Bank Account Details
            </CardTitle>
            <CardDescription>Enter your Australian bank account details for direct debit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bsb">BSB Number *</Label>
              <Input
                id="bsb"
                value={formData.bsb}
                onChange={(e) => handleChange('bsb', e.target.value)}
                placeholder="XXX-XXX"
                maxLength={7}
                data-testid="ddr-bsb-input"
              />
              {bsbValidation && (
                <p className={`text-sm ${bsbValidation.valid ? 'text-green-600' : 'text-red-600'}`}>
                  {bsbValidation.message} {bsbValidation.valid && `(${bsbValidation.bank_name})`}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_number">Account Number *</Label>
              <Input
                id="account_number"
                value={formData.account_number}
                onChange={(e) => handleChange('account_number', e.target.value)}
                placeholder="Account number"
                data-testid="ddr-account-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_holder_name">Account Holder Name *</Label>
              <Input
                id="account_holder_name"
                value={formData.account_holder_name}
                onChange={(e) => handleChange('account_holder_name', e.target.value)}
                placeholder="Full name as shown on account"
                data-testid="ddr-name-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Account Type *</Label>
              <Select value={formData.account_type} onValueChange={(v) => handleChange('account_type', v)}>
                <SelectTrigger data-testid="ddr-account-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="savings">Savings Account</SelectItem>
                  <SelectItem value="cheque">Cheque/Transaction Account</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg mt-4">
              <p className="text-sm text-blue-900">
                <FileText className="inline mr-2" size={16} />
                Your bank details are encrypted and stored securely. This information is used only for processing direct debit payments.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Provider Details */}
      {step === 2 && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Step 2: Utility Provider Details</CardTitle>
            <CardDescription>Select the provider you want to pay via direct debit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Provider Type *</Label>
              <Select value={formData.provider_type} onValueChange={(v) => handleChange('provider_type', v)}>
                <SelectTrigger data-testid="ddr-provider-type-select">
                  <SelectValue placeholder="Select provider type" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider">Provider Name *</Label>
              <Input
                id="provider"
                value={formData.provider}
                onChange={(e) => handleChange('provider', e.target.value)}
                placeholder="e.g., ABC Energy, XYZ Water"
                data-testid="ddr-provider-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider_account_number">Your Account Number with Provider *</Label>
              <Input
                id="provider_account_number"
                value={formData.provider_account_number}
                onChange={(e) => handleChange('provider_account_number', e.target.value)}
                placeholder="Provider account/customer number"
                data-testid="ddr-provider-account-input"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Payment Details */}
      {step === 3 && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Step 3: Payment Configuration</CardTitle>
            <CardDescription>Set up your payment schedule and limits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Payment Frequency *</Label>
              <Select value={formData.payment_frequency} onValueChange={(v) => handleChange('payment_frequency', v)}>
                <SelectTrigger data-testid="ddr-frequency-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="fortnightly">Fortnightly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_payment_amount">Maximum Payment Amount (per transaction) *</Label>
              <Input
                id="max_payment_amount"
                type="number"
                step="0.01"
                value={formData.max_payment_amount}
                onChange={(e) => handleChange('max_payment_amount', e.target.value)}
                placeholder="e.g., 500.00"
                data-testid="ddr-max-amount-input"
              />
              <p className="text-xs text-gray-600">
                Set the maximum amount that can be debited per transaction for your protection
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date *</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => handleChange('start_date', e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                data-testid="ddr-start-date-input"
              />
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg mt-4">
              <p className="text-sm text-yellow-900">
                <AlertCircle className="inline mr-2" size={16} />
                You can cancel this direct debit arrangement at any time by contacting us or your financial institution.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Authorization & Terms */}
      {step === 4 && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Step 4: Authorization & Terms</CardTitle>
            <CardDescription>Review and authorize the Direct Debit Request</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary */}
            <div className="bg-gray-50 p-6 rounded-lg space-y-3">
              <h4 className="font-bold text-lg mb-4">Direct Debit Request Summary</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="font-semibold">Bank:</span> {bsbValidation?.bank_name}</div>
                <div><span className="font-semibold">BSB:</span> {formData.bsb}</div>
                <div><span className="font-semibold">Account:</span> ****{formData.account_number.slice(-4)}</div>
                <div><span className="font-semibold">Account Holder:</span> {formData.account_holder_name}</div>
                <div><span className="font-semibold">Provider:</span> {formData.provider}</div>
                <div><span className="font-semibold">Type:</span> {formData.provider_type}</div>
                <div><span className="font-semibold">Frequency:</span> {formData.payment_frequency}</div>
                <div><span className="font-semibold">Max Amount:</span> ${formData.max_payment_amount}</div>
              </div>
            </div>

            {/* Terms */}
            <div className="border rounded-lg p-4 max-h-60 overflow-y-auto bg-white">
              <h5 className="font-bold mb-3">Direct Debit Request Service Agreement</h5>
              <div className="text-sm space-y-2 text-gray-700">
                <p><strong>1. Debiting Arrangements:</strong> By signing this Direct Debit Request, you authorize BillEasyPay to debit your account through the Bulk Electronic Clearing System (BECS) according to the terms of this agreement.</p>
                
                <p><strong>2. Payment Frequency:</strong> Debits will be made {formData.payment_frequency} for amounts up to ${formData.max_payment_amount} per transaction, starting from {formData.start_date}.</p>
                
                <p><strong>3. Cancellation:</strong> You may cancel this arrangement at any time by providing 7 days notice to BillEasyPay or by contacting your financial institution.</p>
                
                <p><strong>4. Changes:</strong> We will notify you of any changes to the debit amount or frequency at least 14 days in advance.</p>
                
                <p><strong>5. Disputes:</strong> If you believe a debit has been made incorrectly, contact us immediately on 1300-XXX-XXX or email support@billseasypay.com</p>
                
                <p><strong>6. Your Rights:</strong> You have the right to request a refund if a debit is made in error or outside the terms of this agreement.</p>
                
                <p><strong>7. Financial Institution Obligations:</strong> Your financial institution may, at its discretion, decline to process a debit if there are insufficient funds in your account.</p>
              </div>
            </div>

            {/* Digital Signature */}
            <div className="space-y-2">
              <Label htmlFor="signature">Digital Signature (Type your full name) *</Label>
              <Input
                id="signature"
                value={formData.signature}
                onChange={(e) => handleChange('signature', e.target.value)}
                placeholder="Type your full name as authorization"
                data-testid="ddr-signature-input"
              />
              <p className="text-xs text-gray-600">
                By typing your name, you are providing your digital signature and authorizing this Direct Debit Request
              </p>
            </div>

            {/* Checkboxes */}
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="terms"
                  checked={formData.terms_accepted}
                  onCheckedChange={(checked) => handleChange('terms_accepted', checked)}
                  data-testid="ddr-terms-checkbox"
                />
                <label htmlFor="terms" className="text-sm cursor-pointer">
                  I have read and agree to the Direct Debit Request Service Agreement
                </label>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="authorization"
                  checked={formData.authorization_confirmed}
                  onCheckedChange={(checked) => handleChange('authorization_confirmed', checked)}
                  data-testid="ddr-auth-checkbox"
                />
                <label htmlFor="authorization" className="text-sm cursor-pointer">
                  I authorize BillEasyPay to debit my account as specified above and confirm all details are correct
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex gap-3">
        {step > 1 && (
          <Button variant="outline" onClick={() => setStep(step - 1)} data-testid="ddr-back-btn">
            Back
          </Button>
        )}
        {step < 4 ? (
          <Button onClick={handleNext} className="flex-1 bg-emerald-600 hover:bg-emerald-700" data-testid="ddr-next-btn">
            Next
          </Button>
        ) : (
          <Button 
            onClick={handleSubmit} 
            disabled={loading}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            data-testid="ddr-submit-btn"
          >
            {loading ? 'Creating...' : 'Authorize Direct Debit'}
          </Button>
        )}
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} data-testid="ddr-cancel-btn">
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
};

export default DirectDebitRequestForm;
