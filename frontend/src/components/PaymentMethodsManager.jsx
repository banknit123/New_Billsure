import React, { useState, useEffect } from 'react';
import { axiosInstance, API } from '../App';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { CreditCard, Building2, Plus, Trash2, Star } from 'lucide-react';
import StripePaymentMethodSetup from './StripePaymentMethodSetup';

const PaymentMethodsManager = ({ user, refreshUser }) => {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => { fetch(); }, []);

  const fetch = async () => {
    try {
      const res = await axiosInstance.get(`${API}/payment-methods`);
      setMethods(res.data);
    } catch(err) { console.error(err.message); } finally { setLoading(false); }
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

  return (
    <div className="space-y-6" data-testid="payment-methods-page">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Payment Methods
          </h2>
          <p className="text-sm text-slate-500 mt-1">Manage your cards and bank accounts for automatic deductions</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-slate-900 hover:bg-slate-800 text-sm" data-testid="add-payment-method-btn">
          <Plus size={16} className="mr-1" /> Add Payment Method
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
            <p className="text-xs text-slate-400 mt-1">Add a card or bank account to enable automatic deductions</p>
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
                    m.type === 'card' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {m.type === 'card' ? <CreditCard size={20} /> : <Building2 size={20} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900">{m.label}</p>
                      {m.is_primary && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">Primary</span>
                      )}
                      {m.stripe_payment_method_id ? (
                        <span className="text-xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-medium" data-testid={`autopay-ready-${m.id}`}>Auto-pay ready</span>
                      ) : (
                        <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium" data-testid={`manual-only-${m.id}`}>Manual only (legacy)</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {m.type === 'card' ? `${m.card_brand || 'Card'} ending ${m.card_last4 || '****'}` :
                       m.type === 'au_becs_debit' ? `${m.bank_name || 'Bank'} ending ${m.account_number_masked?.slice(-4) || '****'}` :
                       `BSB: ${m.bsb || '—'} | Acc: ${m.account_number_masked || '—'}`}
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

      {/* Add Payment Method -- Stripe tokenization only (card or AU BECS
          Direct Debit). Card/account details are entered directly into
          Stripe's own UI component and never reach this app's servers. */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md" data-testid="add-payment-method-dialog">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Outfit, sans-serif' }}>Add Payment Method</DialogTitle>
          </DialogHeader>
          <StripePaymentMethodSetup
            onSaved={() => { setShowAdd(false); fetch(); }}
            onCancel={() => setShowAdd(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentMethodsManager;
