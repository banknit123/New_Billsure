import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { axiosInstance, API } from '../App';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, ShieldCheck } from 'lucide-react';

// Loaded once at module scope (loadStripe caches internally either way).
// Card details entered into <CardElement> below go straight from the
// browser to Stripe via the client_secret from POST /payment-methods/setup-intent
// -- this is the point of the whole flow: BillSure's servers never see a
// raw card number. See STRIPE_INTEGRATION_NOTES.md.
const stripePromise = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY)
  : null;

const cardElementOptions = {
  style: {
    base: {
      fontSize: '14px',
      color: '#0f172a',
      fontFamily: 'inherit',
      '::placeholder': { color: '#94a3b8' },
    },
    invalid: { color: '#dc2626' },
  },
};

const StripeCardForm = ({ onSaved, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [label, setLabel] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cardError, setCardError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setCardError('');
    try {
      const { data: intentData } = await axiosInstance.post(`${API}/payment-methods/setup-intent`);

      const result = await stripe.confirmCardSetup(intentData.client_secret, {
        payment_method: { card: elements.getElement(CardElement) },
      });

      if (result.error) {
        setCardError(result.error.message || 'Card could not be verified');
        setSubmitting(false);
        return;
      }

      await axiosInstance.post(`${API}/payment-methods/confirm-setup`, {
        setup_intent_id: result.setupIntent.id,
        label: label || 'Card',
        is_primary: isPrimary,
      });

      toast.success('Card saved for automatic payments');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not save card');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="stripe-card-form">
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
        <ShieldCheck size={16} className="text-blue-600 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-800">
          Your card number is entered directly into Stripe's secure form below and never reaches BillSure's servers.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-slate-600">Label</Label>
        <Input value={label} onChange={e => setLabel(e.target.value)}
          placeholder="e.g., Personal Visa" data-testid="stripe-card-label-input" className="border-slate-200" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-slate-600">Card Details</Label>
        <div className="border border-slate-200 rounded-md px-3 py-2.5 bg-white" data-testid="stripe-card-element">
          <CardElement options={cardElementOptions} onChange={(e) => setCardError(e.error?.message || '')} />
        </div>
        {cardError && <p className="text-xs text-red-600" data-testid="stripe-card-error">{cardError}</p>}
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" id="stripe-primary" checked={isPrimary}
          onChange={e => setIsPrimary(e.target.checked)}
          className="rounded border-slate-300" data-testid="stripe-card-primary-checkbox" />
        <Label htmlFor="stripe-primary" className="text-xs text-slate-600 cursor-pointer">Set as primary payment method</Label>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={!stripe || submitting} className="flex-1 bg-slate-900 hover:bg-slate-800 text-sm" data-testid="stripe-card-save-btn">
          {submitting ? <Loader2 className="animate-spin mr-1" size={14} /> : null}
          {submitting ? 'Saving...' : 'Save Card'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="border-slate-300">
          Cancel
        </Button>
      </div>
    </form>
  );
};

const StripeCardSetup = ({ onSaved, onCancel }) => {
  if (!stripePromise) {
    return (
      <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-4" data-testid="stripe-not-configured">
        Card payments aren't configured yet (missing REACT_APP_STRIPE_PUBLISHABLE_KEY). Contact support or add a bank account instead.
      </div>
    );
  }
  return (
    <Elements stripe={stripePromise}>
      <StripeCardForm onSaved={onSaved} onCancel={onCancel} />
    </Elements>
  );
};

export default StripeCardSetup;
