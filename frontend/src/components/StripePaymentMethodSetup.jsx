import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { axiosInstance, API } from '../App';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, ShieldCheck } from 'lucide-react';

// Loaded once at module scope. Card/BECS bank details entered into
// <PaymentElement> below go straight from the browser to Stripe -- this
// backend's servers never see a raw card number or bank account number.
// See STRIPE_INTEGRATION_NOTES.md.
const stripePromise = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY)
  : null;

const StripePaymentMethodForm = ({ onSaved, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [label, setLabel] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setFormError('');

    const { error: elementsError } = await elements.submit();
    if (elementsError) {
      setFormError(elementsError.message || 'Please check your details');
      setSubmitting(false);
      return;
    }

    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
      confirmParams: { return_url: window.location.href },
    });

    if (error) {
      setFormError(error.message || 'Could not verify payment method');
      setSubmitting(false);
      return;
    }

    try {
      await axiosInstance.post(`${API}/payment-methods/confirm-setup`, {
        setup_intent_id: setupIntent.id,
        label: label || 'Payment method',
        is_primary: isPrimary,
      });
      toast.success('Payment method saved');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not save payment method');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="stripe-payment-method-form">
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
        <ShieldCheck size={16} className="text-blue-600 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-800">
          Your card or bank account details are entered directly into Stripe's secure form below and never reach BillSure's servers.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-slate-600">Label</Label>
        <Input value={label} onChange={e => setLabel(e.target.value)}
          placeholder="e.g., Personal Visa, CBA Everyday" data-testid="payment-method-label-input" className="border-slate-200" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-slate-600">Payment Details</Label>
        <div className="border border-slate-200 rounded-md px-3 py-2.5 bg-white" data-testid="stripe-payment-element">
          <PaymentElement options={{ fields: { billingDetails: 'auto' } }} onChange={(e) => setFormError(e.error?.message || '')} />
        </div>
        {formError && <p className="text-xs text-red-600" data-testid="stripe-payment-method-error">{formError}</p>}
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" id="pm-primary" checked={isPrimary}
          onChange={e => setIsPrimary(e.target.checked)}
          className="rounded border-slate-300" data-testid="payment-method-primary-checkbox" />
        <Label htmlFor="pm-primary" className="text-xs text-slate-600 cursor-pointer">Set as primary payment method</Label>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={!stripe || submitting} className="flex-1 bg-slate-900 hover:bg-slate-800 text-sm" data-testid="save-payment-method-btn">
          {submitting ? <Loader2 className="animate-spin mr-1" size={14} /> : null}
          {submitting ? 'Saving...' : 'Save Payment Method'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="border-slate-300">
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
};

/**
 * Browser-side half of real payment-method tokenization: calls
 * POST /payment-methods/setup-intent to get a client_secret, renders
 * Stripe's <PaymentElement> (supports both card and AU BECS Direct Debit,
 * matching what backend/stripe_collections.py's create_setup_intent()
 * already accepts), confirms client-side via stripe.confirmSetup(), then
 * calls POST /payment-methods/confirm-setup. Replaces the old raw-entry
 * form (typed card/account numbers going straight into our own database)
 * everywhere a customer adds a payment method.
 */
const StripePaymentMethodSetup = ({ onSaved, onCancel }) => {
  const [clientSecret, setClientSecret] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState('');

  useEffect(() => {
    if (!stripePromise) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axiosInstance.post(`${API}/payment-methods/setup-intent`);
        if (!cancelled) setClientSecret(data.client_secret);
      } catch (err) {
        if (!cancelled) setInitError(err.response?.data?.detail || 'Could not start payment method setup');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!stripePromise) {
    return (
      <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-4" data-testid="stripe-not-configured">
        Card and bank payments aren't configured yet (missing REACT_APP_STRIPE_PUBLISHABLE_KEY). Contact support to add a payment method.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8" data-testid="stripe-payment-method-loading">
        <Loader2 className="animate-spin text-slate-400" size={24} />
      </div>
    );
  }

  if (initError || !clientSecret) {
    return (
      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-4" data-testid="stripe-init-error">
        {initError || 'Could not start payment method setup. Please try again.'}
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <StripePaymentMethodForm onSaved={onSaved} onCancel={onCancel} />
    </Elements>
  );
};

export default StripePaymentMethodSetup;
