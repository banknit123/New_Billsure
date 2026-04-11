import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Shield, Clock, BarChart3, CreditCard } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Nav */}
      <nav className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
            BillsEasyPay
          </h1>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate('/login')} data-testid="landing-login-btn"
              className="border-slate-300 text-slate-700 hover:bg-slate-50">
              Log in
            </Button>
            <Button onClick={() => navigate('/register')} data-testid="landing-register-btn"
              className="bg-slate-900 text-white hover:bg-slate-800">
              Get Started <ArrowRight className="ml-1" size={16} />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-20 md:py-28">
        <div className="max-w-3xl">
          <p className="text-xs tracking-widest uppercase font-medium text-blue-600 mb-4">Smart Bill Management</p>
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight leading-tight mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
            One fixed payment.<br />All your bills covered.
          </h2>
          <p className="text-lg text-slate-500 leading-relaxed mb-8 max-w-xl">
            Upload your bills, choose a fixed deduction plan, and we handle the rest.
            No more missed payments. No more stress.
          </p>
          <div className="flex gap-3">
            <Button size="lg" onClick={() => navigate('/register')} data-testid="hero-cta-btn"
              className="bg-slate-900 text-white hover:bg-slate-800 px-8 h-12 text-base">
              Start Now <ArrowRight className="ml-2" size={18} />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/login')} data-testid="hero-login-btn"
              className="border-slate-300 text-slate-700 h-12 text-base">
              I have an account
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-slate-200 bg-white py-16">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-xs tracking-widest uppercase font-medium text-slate-400 mb-8">How it works</p>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { icon: CreditCard, title: 'Upload Bills', desc: 'Add your utility, internet, insurance — any recurring bill via upload or OCR scan.' },
              { icon: BarChart3, title: 'Choose a Plan', desc: 'We calculate 3 fixed deduction options: weekly, fortnightly, or monthly — with a safety buffer.' },
              { icon: Clock, title: 'Auto Payments', desc: 'Set it and forget it. We deduct a fixed amount and pay your bills on time, every time.' },
              { icon: Shield, title: 'Stay Protected', desc: 'An 8% safety buffer ensures you\'re always ahead of your bills. No surprises.' },
            ].map((f, i) => (
              <div key={i} className="group">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center mb-4 group-hover:bg-blue-50 transition-colors">
                  <f.icon size={20} className="text-slate-600 group-hover:text-blue-600 transition-colors" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-xs text-slate-400">
          <span style={{ fontFamily: 'Outfit, sans-serif' }} className="font-medium text-slate-500">BillsEasyPay</span>
          <span>Simulated payment platform for demonstration</span>
        </div>
      </footer>
    </div>
  );
}
