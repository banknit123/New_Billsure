import React, { useState } from 'react';
import { axiosInstance, API } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const DirectDebitRequestForm = ({ user, onCreated }) => {
  const [form, setForm] = useState({
    bsb: '', account_number: '', account_name: '', provider: '',
    max_amount: '', frequency: 'monthly'
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axiosInstance.post(`${API}/direct-debit/create`, {
        ...form,
        max_amount: parseFloat(form.max_amount),
      });
      toast.success('Direct debit mandate created');
      setForm({ bsb: '', account_number: '', account_name: '', provider: '', max_amount: '', frequency: 'monthly' });
      if (onCreated) onCreated();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create mandate');
    } finally { setSaving(false); }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <Card className="border-slate-200 shadow-sm" data-testid="ddr-form">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg" style={{ fontFamily: 'Outfit, sans-serif' }}>New Direct Debit Mandate</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">BSB</Label>
              <Input value={form.bsb} onChange={set('bsb')} placeholder="062-000" required
                data-testid="ddr-bsb-input" className="border-slate-200" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Account Number</Label>
              <Input value={form.account_number} onChange={set('account_number')} placeholder="12345678" required
                data-testid="ddr-account-input" className="border-slate-200" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Account Name</Label>
            <Input value={form.account_name} onChange={set('account_name')} placeholder="John Smith" required
              data-testid="ddr-name-input" className="border-slate-200" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Provider</Label>
              <Input value={form.provider} onChange={set('provider')} placeholder="AGL Energy" required
                data-testid="ddr-provider-input" className="border-slate-200" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Max Amount ($)</Label>
              <Input type="number" step="0.01" value={form.max_amount} onChange={set('max_amount')}
                placeholder="500.00" required data-testid="ddr-max-amount-input" className="border-slate-200" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Frequency</Label>
            <Select value={form.frequency} onValueChange={v => setForm({ ...form, frequency: v })}>
              <SelectTrigger data-testid="ddr-frequency-select" className="border-slate-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="fortnightly">Fortnightly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={saving} className="w-full bg-slate-900 hover:bg-slate-800 text-sm" data-testid="ddr-submit-btn">
            {saving ? <Loader2 className="animate-spin mr-1" size={14} /> : null}
            {saving ? 'Creating...' : 'Create Mandate'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default DirectDebitRequestForm;
