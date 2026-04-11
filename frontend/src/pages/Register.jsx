import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, axiosInstance, API } from '../App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';

export default function Register() {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await axiosInstance.post(`${API}/auth/register`, {
        full_name: form.full_name, email: form.email, password: form.password,
      });
      login(res.data.token, res.data.user);
      toast.success('Account created!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex">
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <Link to="/" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 mb-8 transition-colors">
            <ArrowLeft size={16} className="mr-1" /> Back
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Create your account
          </h1>
          <p className="text-sm text-slate-500 mb-8">Start managing your bills in minutes</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Full Name</Label>
              <Input value={form.full_name} onChange={set('full_name')} placeholder="John Smith" required
                data-testid="register-name-input" className="h-11 border-slate-200" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Email</Label>
              <Input type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" required
                data-testid="register-email-input" className="h-11 border-slate-200" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Password</Label>
              <Input type="password" value={form.password} onChange={set('password')} placeholder="Min 6 characters" required
                data-testid="register-password-input" className="h-11 border-slate-200" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Confirm Password</Label>
              <Input type="password" value={form.confirm} onChange={set('confirm')} placeholder="Repeat password" required
                data-testid="register-confirm-input" className="h-11 border-slate-200" />
            </div>
            <Button type="submit" disabled={loading} data-testid="register-submit-btn"
              className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-sm font-medium">
              {loading ? 'Creating...' : 'Create Account'}
            </Button>
          </form>

          <p className="text-sm text-slate-500 text-center mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
      <div className="hidden lg:block lg:w-[45%] bg-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900" />
        <div className="relative z-10 h-full flex flex-col justify-center px-16">
          <p className="text-xs tracking-widest uppercase text-blue-400 mb-3">Get Started</p>
          <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Take control of your bills today
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Join thousands managing their bills with fixed, predictable payments.
          </p>
        </div>
      </div>
    </div>
  );
}
