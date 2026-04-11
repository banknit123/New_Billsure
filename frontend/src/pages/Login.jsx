import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, axiosInstance, API } from '../App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axiosInstance.post(`${API}/auth/login`, { email, password });
      login(res.data.token, res.data.user);
      toast.success('Welcome back');
      navigate(res.data.user.is_admin ? '/admin' : '/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex">
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <Link to="/" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 mb-8 transition-colors">
            <ArrowLeft size={16} className="mr-1" /> Back
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Welcome back
          </h1>
          <p className="text-sm text-slate-500 mb-8">Sign in to manage your bills</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" required data-testid="login-email-input"
                className="h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password" required data-testid="login-password-input"
                className="h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500" />
            </div>
            <Button type="submit" disabled={loading} data-testid="login-submit-btn"
              className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-sm font-medium">
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <p className="text-sm text-slate-500 text-center mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-blue-600 hover:underline font-medium">Create one</Link>
          </p>
        </div>
      </div>
      <div className="hidden lg:block lg:w-[45%] bg-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900" />
        <div className="relative z-10 h-full flex flex-col justify-center px-16">
          <p className="text-xs tracking-widest uppercase text-blue-400 mb-3">BillsEasyPay</p>
          <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>
            One fixed payment covers all your bills
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Upload your bills, select a plan, and let us handle the rest. Simple, predictable, reliable.
          </p>
        </div>
      </div>
    </div>
  );
}
