import React, { useState, useEffect } from 'react';
import { axiosInstance, API } from '../App';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { CreditCard, Building2, Plus, Trash2, Star, Loader2 } from 'lucide-react';

const PaymentMethodsManager = ({ user, refreshUser }) => {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ type: 'bank_account', label: '', bank_name: '', bsb: '', account_number: '', card_number: '', card_brand: '', is_primary: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetch(); }, []);

  const fetch = async () => {
    try {
      const res = await axiosInstance.get(`${API}/payment-methods`);
      setMethods(res.data);
    } catch(err) { console.error(err.message); } finally { setLoading(false); }
  };

  const add = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axiosInstance.post(`${API}/payment-methods`, form);
      toast.success('Payment method added');
      setShowAdd(false);
      resetForm();
      fetch();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    try {
      await axiosInstance.delete(`${API}/payment-methods/${id}`);
      toast.success('Removed');
      fetch();
    } catch { toast.error('Failed'); }
  };

  const setPrimary = async (id) => {
    try {
      await axiosInstance.put(`${API}/payment-methods/${id}/set-primary`);
      toast.success('Primary method updated');
      fetch();
    } catch { toast.error('Failed'); }
  };

  const resetForm = () => setForm({ type: 'bank_account', label: '', bank_name: '', bsb: '', account_number: '', card_number: '', card_brand: '', is_primary: false });

  return (
    <div className="space-y-6" data-testid="payment-methods-page">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Payment Methods
          </h2>
          <p className="text-sm text-slate-500 mt-1">Manage your bank accounts and cards for automatic deductions</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-slate-900 hover:bg-slate-800 text-sm" data-testid="add-payment-method-btn">
          <Plus size={16} className="mr-1" /> Add Method
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => <div key={i} className="h-20 bg-white rounded-lg border border-slate-200 animate-pulse" />)}
        </div>
      ) : methods.length === 0 ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-12 text-center">
            <CreditCard className="mx-auto text-slate-300 mb-3" size={40} />
            <p className="text-slate-500 text-sm">No payment methods added</p>
            <p className="text-xs text-slate-400 mt-1">Add a bank account or card to enable automatic deductions</p>
            <Button onClick={() => setShowAdd(true)} className="mt-4 bg-slate-900 hover:bg-slate-800 text-sm" data-testid="add-first-method-btn">
              <Plus size={16} className="mr-1" /> Add Payment Method
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {methods.map(m => (
            <Card key={m.id} className={`border shadow-sm transition-all ${m.is_primary ? 'border-blue-400 ring-1 ring-blue-400' : 'border-slate-200'}`}
              data-testid={`payment-method-${m.id}`}>
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    m.type === 'bank_account' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                  }`}>
                    {m.type === 'bank_account' ? <Building2 size={20} /> : <CreditCard size={20} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900">{m.label}</p>
                      {m.is_primary && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">Primary</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {m.type === 'bank_account' ? `BSB: ${m.bsb || '—'} | Acc: ${m.account_number_masked || '—'}` :
                       `${m.card_brand || 'Card'} ending ${m.card_last4 || '****'}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!m.is_primary && (
                    <Button variant="ghost" size="sm" onClick={() => setPrimary(m.id)}
                      className="text-slate-500 hover:text-blue-600 text-xs" data-testid={`set-primary-${m.id}`}>
                      <Star size={14} className="mr-1" /> Set Primary
                    </Button>
                  )}
                  <button onClick={() => remove(m.id)} className="text-slate-400 hover:text-red-500 transition-colors p-2"
                    data-testid={`delete-method-${m.id}`}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={v => { setShowAdd(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-md" data-testid="add-payment-method-dialog">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Outfit, sans-serif' }}>Add Payment Method</DialogTitle>
          </DialogHeader>
          <form onSubmit={add} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Type</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger data-testid="method-type-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_account">Bank Account</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="debit_card">Debit Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Label</Label>
              <Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })}
                placeholder="e.g., Commonwealth Savings" required data-testid="method-label-input"
                className="border-slate-200" />
            </div>

            {form.type === 'bank_account' ? (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Bank Name</Label>
                  <Input value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })}
                    placeholder="Commonwealth Bank" data-testid="method-bank-name-input" className="border-slate-200" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-600">BSB</Label>
                    <Input value={form.bsb} onChange={e => setForm({ ...form, bsb: e.target.value })}
                      placeholder="062-000" data-testid="method-bsb-input" className="border-slate-200" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-600">Account Number</Label>
                    <Input value={form.account_number} onChange={e => setForm({ ...form, account_number: e.target.value })}
                      placeholder="12345678" data-testid="method-account-input" className="border-slate-200" />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Card Number</Label>
                  <Input value={form.card_number} onChange={e => setForm({ ...form, card_number: e.target.value })}
                    placeholder="4242 4242 4242 4242" data-testid="method-card-number-input" className="border-slate-200" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Card Brand</Label>
                  <Select value={form.card_brand} onValueChange={v => setForm({ ...form, card_brand: v })}>
                    <SelectTrigger data-testid="method-card-brand-select"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Visa">Visa</SelectItem>
                      <SelectItem value="Mastercard">Mastercard</SelectItem>
                      <SelectItem value="Amex">Amex</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="flex items-center gap-2">
              <input type="checkbox" id="primary" checked={form.is_primary}
                onChange={e => setForm({ ...form, is_primary: e.target.checked })}
                className="rounded border-slate-300" data-testid="method-primary-checkbox" />
              <Label htmlFor="primary" className="text-xs text-slate-600 cursor-pointer">Set as primary payment method</Label>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving} className="flex-1 bg-slate-900 hover:bg-slate-800 text-sm" data-testid="save-method-btn">
                {saving ? <Loader2 className="animate-spin mr-1" size={14} /> : null}
                {saving ? 'Adding...' : 'Add Method'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)} className="border-slate-300">
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentMethodsManager;
