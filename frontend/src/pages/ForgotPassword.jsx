import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { axiosInstance, API } from '../App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Mail, CheckCircle2 } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axiosInstance.post(`${API}/auth/forgot-password`, { email });
      setSent(true);
      toast.success('Check your email for a reset link');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link to="/login" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 mb-8 transition-colors">
          <ArrowLeft size={16} className="mr-1" /> Back to login
        </Link>

        {sent ? (
          <div className="text-center" data-testid="reset-sent-message">
            <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={28} className="text-teal" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Check your email
            </h1>
            <p className="text-sm text-slate-500 mb-6">
              If <strong>{email}</strong> is registered, you'll receive a password reset link shortly.
            </p>
            <Link to="/login">
              <Button className="bg-navy hover:bg-navy-700 text-sm">Back to Sign In</Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center mb-6">
              <Mail size={24} className="text-teal" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Reset your password
            </h1>
            <p className="text-sm text-slate-500 mb-8">Enter your email and we'll send you a reset link</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Email address</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" required data-testid="forgot-email-input"
                  className="h-11 border-slate-200 focus:border-teal focus:ring-teal" />
              </div>
              <Button type="submit" disabled={loading} data-testid="forgot-submit-btn"
                className="w-full h-11 bg-navy hover:bg-navy-700 text-sm font-medium">
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </form>

            <p className="text-sm text-slate-500 text-center mt-6">
              Remember your password?{' '}
              <Link to="/login" className="text-teal hover:underline font-medium">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
