import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import {
  ArrowRight, Shield, Clock, BarChart3, CreditCard, Upload, FileText,
  CheckCircle2, Zap, Lock, Building2, ChevronRight, Star, Users,
  Receipt, CalendarCheck, TrendingDown, Eye, Smartphone, Globe,
  BadgeCheck, ShieldCheck, Mail, Phone, MapPin, ArrowUpRight,
  Banknote, PiggyBank, BellRing, ScanLine
} from 'lucide-react';

// Animated counter hook
function useCountUp(target, duration = 2000, startOnView = true) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!startOnView) { setStarted(true); return; }
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStarted(true); },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [startOnView]);

  useEffect(() => {
    if (!started) return;
    let start = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [started, target, duration]);

  return { count, ref };
}

const FAQ_DATA = [
  {
    q: "How does BillsEasyPay work?",
    a: "Simply upload your bills (electricity, gas, internet, insurance — any recurring bill) via PDF or manual entry. We calculate three fixed deduction options (weekly, fortnightly, or monthly) with an 8% safety buffer. Choose a plan, fund your wallet via Stripe, and we automatically pay your bills on time."
  },
  {
    q: "What types of bills can I manage?",
    a: "You can manage any recurring bill — electricity, gas, water, internet, phone, insurance, council rates, streaming subscriptions, rent, and more. If it has a due date and an amount, BillsEasyPay can handle it."
  },
  {
    q: "How do I upload my bills?",
    a: "You have two options: Upload a PDF bill and our system automatically extracts the provider, amount, due date, and account number. Or enter the details manually if you prefer. We support all major Australian utility bill formats."
  },
  {
    q: "What is the 8% safety buffer?",
    a: "The safety buffer adds 8% on top of your calculated deductions to ensure you're always ahead of your bills. This means if a bill comes in slightly higher than expected, you're already covered. Any excess stays in your wallet as a credit."
  },
  {
    q: "How are payments processed?",
    a: "Payments are processed securely through Stripe, Australia's leading payment gateway. You can pay via credit card, debit card, or BECS Direct Debit (bank transfer). Your card details are never stored on our servers — Stripe handles everything."
  },
  {
    q: "Is my financial data secure?",
    a: "Absolutely. We use AES-128 (Fernet) encryption for all sensitive data stored in our database. Bank account numbers, BSB codes, and routing numbers are encrypted at rest. We are PCI DSS compliant, meaning card data is processed exclusively by Stripe on their certified infrastructure. Your raw card numbers never touch our servers."
  },
  {
    q: "What happens if I don't have enough in my wallet?",
    a: "If your wallet balance is insufficient for an upcoming bill payment, we'll send you a notification alert so you can top up. Bills won't bounce — they'll remain pending until your wallet is funded. The safety buffer is designed to prevent this scenario."
  },
  {
    q: "Can I cancel or change my payment plan?",
    a: "Yes, you can switch between weekly, fortnightly, and monthly plans at any time from your dashboard. Changes take effect immediately. There are no lock-in contracts or cancellation fees."
  },
  {
    q: "How does automatic bill payment work?",
    a: "Once you've uploaded your bills and selected a payment plan, our system automatically deducts the fixed amount from your wallet on schedule. When bills are due, we pay them from your wallet balance. You'll receive notifications for every transaction."
  },
  {
    q: "What is BECS Direct Debit?",
    a: "BECS (Bulk Electronic Clearing System) Direct Debit is the Australian standard for bank-to-bank transfers. It allows us to debit funds directly from your Australian bank account via Stripe's secure checkout. Your BSB and account details are collected by Stripe — never stored on our servers."
  },
  {
    q: "Is there a mobile app?",
    a: "BillsEasyPay is a fully responsive web application that works beautifully on any device — desktop, tablet, or mobile. Simply open it in your browser. No download required."
  },
  {
    q: "Who can I contact for support?",
    a: "You can reach our support team at support@billseasypay.com. We're an Australian-owned company and pride ourselves on fast, helpful support for all our customers."
  }
];

const TESTIMONIALS = [
  {
    name: "Sarah Mitchell",
    role: "Small Business Owner, Sydney",
    text: "I used to spend hours every month sorting through bills and worrying about due dates. BillsEasyPay changed everything — I set it up once and now everything runs on autopilot. The safety buffer is genius.",
    rating: 5
  },
  {
    name: "James Cooper",
    role: "Property Manager, Melbourne",
    text: "Managing bills across multiple rental properties was a nightmare. Now I upload each bill as a PDF, and BillsEasyPay extracts everything automatically. The admin dashboard gives me full visibility. Highly recommend.",
    rating: 5
  },
  {
    name: "Priya Sharma",
    role: "Working Parent, Brisbane",
    text: "Between work and kids, I was constantly forgetting bills and getting hit with late fees. The automatic payment plan means I never miss a due date. It genuinely took a weight off my shoulders.",
    rating: 5
  }
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [mobileMenu, setMobileMenu] = useState(false);

  const stat1 = useCountUp(2500, 2200);
  const stat2 = useCountUp(98, 2000);
  const stat3 = useCountUp(150000, 2400);

  const scrollTo = (id) => {
    setMobileMenu(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* ============ NAVIGATION ============ */}
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight cursor-pointer" style={{ fontFamily: 'Outfit, sans-serif' }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} data-testid="landing-logo">
            BillsEasyPay
          </h1>
          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <button onClick={() => scrollTo('how-it-works')} className="text-sm text-slate-500 hover:text-slate-900 transition-colors">How It Works</button>
            <button onClick={() => scrollTo('features')} className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Features</button>
            <button onClick={() => scrollTo('security')} className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Security</button>
            <button onClick={() => scrollTo('faq')} className="text-sm text-slate-500 hover:text-slate-900 transition-colors">FAQ</button>
            <div className="flex gap-3 ml-4">
              <Button variant="outline" onClick={() => navigate('/login')} data-testid="landing-login-btn"
                className="border-slate-300 text-slate-700 hover:bg-slate-50 h-9 text-sm">
                Log in
              </Button>
              <Button onClick={() => navigate('/register')} data-testid="landing-register-btn"
                className="bg-slate-900 text-white hover:bg-slate-800 h-9 text-sm">
                Get Started <ArrowRight className="ml-1" size={14} />
              </Button>
            </div>
          </div>
          {/* Mobile Menu Toggle */}
          <button className="md:hidden p-2" onClick={() => setMobileMenu(!mobileMenu)} data-testid="mobile-menu-toggle">
            <div className="space-y-1.5">
              <div className={`w-6 h-0.5 bg-slate-900 transition-all ${mobileMenu ? 'rotate-45 translate-y-2' : ''}`} />
              <div className={`w-6 h-0.5 bg-slate-900 transition-all ${mobileMenu ? 'opacity-0' : ''}`} />
              <div className={`w-6 h-0.5 bg-slate-900 transition-all ${mobileMenu ? '-rotate-45 -translate-y-2' : ''}`} />
            </div>
          </button>
        </div>
        {/* Mobile Menu */}
        {mobileMenu && (
          <div className="md:hidden border-t border-slate-100 bg-white px-6 py-4 space-y-3">
            <button onClick={() => scrollTo('how-it-works')} className="block text-sm text-slate-600 py-2 w-full text-left">How It Works</button>
            <button onClick={() => scrollTo('features')} className="block text-sm text-slate-600 py-2 w-full text-left">Features</button>
            <button onClick={() => scrollTo('security')} className="block text-sm text-slate-600 py-2 w-full text-left">Security</button>
            <button onClick={() => scrollTo('faq')} className="block text-sm text-slate-600 py-2 w-full text-left">FAQ</button>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => navigate('/login')} className="flex-1 border-slate-300 text-sm">Log in</Button>
              <Button onClick={() => navigate('/register')} className="flex-1 bg-slate-900 text-white text-sm">Get Started</Button>
            </div>
          </div>
        )}
      </nav>

      {/* ============ HERO SECTION ============ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-24 lg:py-28 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 mb-6">
                <Zap size={14} className="text-blue-600" />
                <span className="text-xs font-semibold text-blue-700 tracking-wide uppercase">Smart Bill Management</span>
              </div>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight leading-[1.1] mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
                One fixed payment.<br />
                <span className="text-blue-600">All your bills</span> covered.
              </h2>
              <p className="text-base md:text-lg text-slate-500 leading-relaxed mb-8 max-w-lg">
                Upload your bills, choose a fixed deduction plan, and we handle the rest.
                No more missed payments. No more late fees. No more stress.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mb-8">
                <Button size="lg" onClick={() => navigate('/register')} data-testid="hero-cta-btn"
                  className="bg-slate-900 text-white hover:bg-slate-800 px-8 h-12 text-base shadow-lg shadow-slate-900/10">
                  Start Managing Bills <ArrowRight className="ml-2" size={18} />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate('/login')} data-testid="hero-login-btn"
                  className="border-slate-300 text-slate-700 h-12 text-base">
                  I have an account
                </Button>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1"><CheckCircle2 size={14} className="text-green-500" /> Free to sign up</span>
                <span className="flex items-center gap-1"><Lock size={14} className="text-green-500" /> Bank-grade security</span>
                <span className="flex items-center gap-1"><Shield size={14} className="text-green-500" /> PCI DSS compliant</span>
              </div>
            </div>
            <div className="hidden lg:block relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-slate-900/10 border border-slate-200">
                <img
                  src="https://images.unsplash.com/photo-1556155092-490a1ba16284?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=80&w=800"
                  alt="Managing bills on laptop"
                  className="w-full h-auto object-cover"
                  loading="lazy"
                />
              </div>
              {/* Floating stat cards */}
              <div className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-lg border border-slate-100 px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                  <CheckCircle2 size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Bills Paid On Time</p>
                  <p className="text-lg font-bold text-slate-900">98%</p>
                </div>
              </div>
              <div className="absolute -top-4 -right-4 bg-white rounded-xl shadow-lg border border-slate-100 px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <TrendingDown size={20} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Late Fee Savings</p>
                  <p className="text-lg font-bold text-slate-900">$120/yr</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ STATS BAR ============ */}
      <section className="border-y border-slate-200 bg-white" ref={stat1.ref}>
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-3xl md:text-4xl font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>{stat1.count.toLocaleString()}+</p>
              <p className="text-sm text-slate-500 mt-1">Bills Managed</p>
            </div>
            <div ref={stat2.ref}>
              <p className="text-3xl md:text-4xl font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>{stat2.count}%</p>
              <p className="text-sm text-slate-500 mt-1">On-Time Payments</p>
            </div>
            <div ref={stat3.ref}>
              <p className="text-3xl md:text-4xl font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>$<span>{stat3.count.toLocaleString()}</span>+</p>
              <p className="text-sm text-slate-500 mt-1">Late Fees Saved</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-bold text-blue-600" style={{ fontFamily: 'Outfit' }}>4.9<Star size={20} className="inline ml-1 text-amber-400 fill-amber-400 -mt-1" /></p>
              <p className="text-sm text-slate-500 mt-1">Customer Rating</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how-it-works" className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-xs tracking-widest uppercase font-semibold text-blue-600 mb-3">How It Works</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mb-4" style={{ fontFamily: 'Outfit' }}>
              Four simple steps to bill freedom
            </h2>
            <p className="text-base text-slate-500 max-w-2xl mx-auto">
              Stop juggling due dates and worrying about missed payments.
              Get set up in under 5 minutes.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { step: 1, icon: Upload, title: 'Upload Your Bills', desc: 'Upload a PDF bill or enter details manually. Our system auto-extracts provider, amount, due date, and account number.', color: 'bg-blue-50 text-blue-600' },
              { step: 2, icon: BarChart3, title: 'Choose Your Plan', desc: 'We calculate 3 fixed deduction options — weekly, fortnightly, or monthly — each with an 8% safety buffer built in.', color: 'bg-emerald-50 text-emerald-600' },
              { step: 3, icon: Banknote, title: 'Fund Your Wallet', desc: 'Top up via Stripe using credit card, debit card, or BECS bank transfer. Secure, instant, and PCI compliant.', color: 'bg-violet-50 text-violet-600' },
              { step: 4, icon: CalendarCheck, title: 'We Pay On Time', desc: 'Sit back. We automatically deduct your fixed amount and pay every bill before the due date. You get notified at every step.', color: 'bg-amber-50 text-amber-600' },
            ].map((s) => (
              <div key={s.step} className="relative group">
                <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg hover:border-slate-300 transition-all duration-300 h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs font-bold text-slate-300 bg-slate-50 rounded-full w-7 h-7 flex items-center justify-center">{s.step}</span>
                    <div className={`w-10 h-10 rounded-lg ${s.color} flex items-center justify-center`}>
                      <s.icon size={20} />
                    </div>
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-2 text-base" style={{ fontFamily: 'Outfit' }}>{s.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
                </div>
                {s.step < 4 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 -translate-y-1/2 z-10">
                    <ChevronRight size={20} className="text-slate-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FEATURE: BILL UPLOAD ============ */}
      <section id="features" className="py-16 md:py-24 bg-white border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs tracking-widest uppercase font-semibold text-blue-600 mb-3">All Bills, One Place</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mb-4" style={{ fontFamily: 'Outfit' }}>
                Every bill at your fingertips
              </h2>
              <p className="text-base text-slate-500 leading-relaxed mb-6">
                No more filing cabinets or email searching. Upload any bill in seconds and we organise everything for you — amounts, due dates, providers, and payment status.
              </p>
              <div className="grid grid-cols-2 gap-4 mb-6">
                {[
                  { icon: FileText, label: 'Upload PDF bills' },
                  { icon: ScanLine, label: 'Auto-extract details' },
                  { icon: Receipt, label: 'Manual entry option' },
                  { icon: Eye, label: 'Track every bill' },
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <f.icon size={18} className="text-blue-600 shrink-0" />
                    <span className="text-sm font-medium text-slate-700">{f.label}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-slate-400">Supports electricity, gas, water, internet, phone, insurance, council rates, and more.</p>
            </div>
            <div className="relative">
              <div className="rounded-2xl overflow-hidden shadow-xl border border-slate-200">
                <img
                  src="https://images.unsplash.com/photo-1664575198263-269a022d6e14?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=80&w=700"
                  alt="Managing bills digitally"
                  className="w-full h-auto object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FEATURE: SMART PAYMENT PLANS ============ */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <div className="grid gap-4">
                {[
                  { freq: 'Weekly', amount: '$47.50', desc: 'Small, regular deductions that spread the cost evenly', color: 'border-l-blue-500' },
                  { freq: 'Fortnightly', amount: '$95.00', desc: 'Balanced payments aligned with most pay cycles', color: 'border-l-emerald-500' },
                  { freq: 'Monthly', amount: '$190.00', desc: 'One payment per month — simple and straightforward', color: 'border-l-violet-500' },
                ].map((p, i) => (
                  <div key={i} className={`bg-white rounded-xl border border-slate-200 ${p.color} border-l-4 p-5 hover:shadow-md transition-shadow`}>
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>{p.freq}</h4>
                      <span className="text-lg font-bold text-slate-900">{p.amount}</span>
                    </div>
                    <p className="text-sm text-slate-500">{p.desc}</p>
                  </div>
                ))}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
                  <Shield size={20} className="text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900">8% Safety Buffer Included</p>
                    <p className="text-xs text-blue-700 mt-0.5">Every plan includes an 8% buffer so you're always ahead of your bills. Any excess stays as wallet credit.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <p className="text-xs tracking-widest uppercase font-semibold text-emerald-600 mb-3">Smart Payment Plans</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mb-4" style={{ fontFamily: 'Outfit' }}>
                Three plans. Zero stress.
              </h2>
              <p className="text-base text-slate-500 leading-relaxed mb-6">
                We analyse all your bills and calculate three fixed deduction options that cover everything.
                Pick the frequency that suits your pay cycle — weekly, fortnightly, or monthly. Switch anytime.
              </p>
              <ul className="space-y-3">
                {[
                  'Covers all uploaded bills in one predictable payment',
                  '8% safety buffer protects against bill fluctuations',
                  'Switch plans anytime — no lock-in, no penalties',
                  'Automatic wallet deductions on your chosen schedule',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FEATURE: AUTO-PAY & NOTIFICATIONS ============ */}
      <section className="py-16 md:py-24 bg-white border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-xs tracking-widest uppercase font-semibold text-violet-600 mb-3">Set It & Forget It</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mb-4" style={{ fontFamily: 'Outfit' }}>
              Automatic payments. Real-time alerts.
            </h2>
            <p className="text-base text-slate-500 max-w-2xl mx-auto">
              Never worry about a due date again. We handle payments automatically and keep you informed at every step.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: CalendarCheck, title: 'Scheduled Auto-Pay', desc: 'Bills are automatically paid from your wallet before the due date. No manual action needed.' },
              { icon: BellRing, title: 'Smart Notifications', desc: 'Get alerts for upcoming bills (5 days ahead), overdue payments, low wallet balance, and successful payments.' },
              { icon: TrendingDown, title: 'Never Pay Late Fees', desc: 'With automatic payments and the 8% buffer, late fees become a thing of the past. Save up to $120/year.' },
              { icon: PiggyBank, title: 'Wallet Management', desc: 'Top up your wallet instantly via Stripe (card or bank). Track your balance and transaction history in real time.' },
              { icon: Receipt, title: 'Transaction History', desc: 'Full audit trail of every deduction, payment, and top-up. Download statements anytime from your dashboard.' },
              { icon: Smartphone, title: 'Works on Any Device', desc: 'Fully responsive dashboard that works perfectly on desktop, tablet, and mobile. Manage bills from anywhere.' },
            ].map((f, i) => (
              <div key={i} className="bg-slate-50 rounded-xl border border-slate-100 p-6 hover:bg-white hover:shadow-md hover:border-slate-200 transition-all duration-300">
                <div className="w-11 h-11 rounded-lg bg-violet-50 flex items-center justify-center mb-4">
                  <f.icon size={22} className="text-violet-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2" style={{ fontFamily: 'Outfit' }}>{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FEATURE: MULTIPLE PAYMENT METHODS ============ */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs tracking-widest uppercase font-semibold text-blue-600 mb-3">Flexible Payments</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mb-4" style={{ fontFamily: 'Outfit' }}>
                Pay your way
              </h2>
              <p className="text-base text-slate-500 leading-relaxed mb-6">
                Choose how you fund your wallet. We support all major payment methods through Stripe's
                PCI-certified infrastructure, so your details are always secure.
              </p>
              <div className="space-y-4">
                {[
                  { icon: CreditCard, title: 'Credit & Debit Cards', desc: 'Visa, Mastercard — instant top-ups via Stripe Checkout.' },
                  { icon: Building2, title: 'BECS Direct Debit', desc: 'Pay directly from your Australian bank account. BSB and account details collected securely by Stripe.' },
                  { icon: Shield, title: 'PCI DSS Compliant', desc: 'Your raw card and bank numbers never touch our servers. Stripe handles all sensitive payment data.' },
                ].map((m, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-xl bg-white border border-slate-200 hover:shadow-sm transition-shadow">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <m.icon size={20} className="text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm" style={{ fontFamily: 'Outfit' }}>{m.title}</h4>
                      <p className="text-sm text-slate-500 mt-0.5">{m.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="rounded-2xl overflow-hidden shadow-xl border border-slate-200">
                <img
                  src="https://images.pexels.com/photos/36730586/pexels-photo-36730586.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
                  alt="Secure online payment"
                  className="w-full h-auto object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ SECURITY SECTION ============ */}
      <section id="security" className="py-16 md:py-24 bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-xs tracking-widest uppercase font-semibold text-blue-400 mb-3">World-Class Security</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4" style={{ fontFamily: 'Outfit' }}>
              Security is our top priority
            </h2>
            <p className="text-base text-slate-400 max-w-2xl mx-auto">
              Your financial data is protected with the same encryption standards used by banks and government institutions.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: ShieldCheck,
                title: 'PCI DSS Compliant',
                desc: 'All card data is processed exclusively through Stripe\'s PCI Level 1 certified infrastructure. Raw card numbers never enter our system.',
              },
              {
                icon: Lock,
                title: 'AES-128 Encryption',
                desc: 'All sensitive financial data — bank accounts, BSB codes, routing numbers — is encrypted at rest using military-grade Fernet (AES-128-CBC) encryption.',
              },
              {
                icon: BadgeCheck,
                title: 'Stripe Certified',
                desc: 'Payments processed by Stripe, trusted by millions of businesses worldwide. Card and bank details are collected on Stripe\'s secure hosted pages.',
              },
              {
                icon: Globe,
                title: 'Australian Owned',
                desc: 'BillsEasyPay is an Australian-owned company, built and operated for Australians. Your data stays protected under Australian privacy laws.',
              },
            ].map((s, i) => (
              <div key={i} className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 hover:border-slate-600 transition-colors">
                <div className="w-12 h-12 rounded-lg bg-blue-600/10 flex items-center justify-center mb-4">
                  <s.icon size={24} className="text-blue-400" />
                </div>
                <h3 className="font-semibold text-white mb-2" style={{ fontFamily: 'Outfit' }}>{s.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ TESTIMONIALS ============ */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-xs tracking-widest uppercase font-semibold text-amber-600 mb-3">Customer Stories</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mb-4" style={{ fontFamily: 'Outfit' }}>
              Trusted by Australians everywhere
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow" data-testid={`testimonial-${i}`}>
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} size={16} className="text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-slate-600 leading-relaxed mb-5 italic">"{t.text}"</p>
                <div className="border-t border-slate-100 pt-4">
                  <p className="font-semibold text-slate-900 text-sm" style={{ fontFamily: 'Outfit' }}>{t.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FAQ SECTION ============ */}
      <section id="faq" className="py-16 md:py-24 bg-white border-y border-slate-200">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-xs tracking-widest uppercase font-semibold text-blue-600 mb-3">FAQ</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mb-4" style={{ fontFamily: 'Outfit' }}>
              Frequently asked questions
            </h2>
            <p className="text-base text-slate-500">
              Everything you need to know about BillsEasyPay.
            </p>
          </div>
          <Accordion type="single" collapsible className="w-full" data-testid="faq-accordion">
            {FAQ_DATA.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border-slate-200">
                <AccordionTrigger className="text-left text-base font-medium text-slate-900 hover:no-underline hover:text-blue-600 py-5" data-testid={`faq-trigger-${i}`}>
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-500 leading-relaxed pb-5" data-testid={`faq-content-${i}`}>
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ============ CTA BANNER ============ */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="bg-slate-900 rounded-2xl p-8 md:p-14 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent pointer-events-none" />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4" style={{ fontFamily: 'Outfit' }}>
                Ready to take control of your bills?
              </h2>
              <p className="text-base text-slate-400 max-w-xl mx-auto mb-8">
                Join thousands of Australians who've simplified their bill payments.
                Sign up for free in under 2 minutes.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button size="lg" onClick={() => navigate('/register')} data-testid="cta-register-btn"
                  className="bg-blue-600 text-white hover:bg-blue-700 px-8 h-12 text-base shadow-lg shadow-blue-600/20">
                  Get Started Free <ArrowRight className="ml-2" size={18} />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate('/login')}
                  className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white h-12 text-base">
                  Log in to your account
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-4">No credit card required. Free to sign up.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-3" style={{ fontFamily: 'Outfit' }}>BillsEasyPay</h3>
              <p className="text-sm text-slate-500 leading-relaxed mb-4">
                Australia's smart bill management platform. One fixed payment covers all your bills.
              </p>
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-green-600" />
                <span className="text-xs text-slate-400">PCI DSS Compliant</span>
              </div>
            </div>
            {/* Product */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wide">Product</h4>
              <ul className="space-y-2">
                <li><button onClick={() => scrollTo('how-it-works')} className="text-sm text-slate-500 hover:text-blue-600 transition-colors">How It Works</button></li>
                <li><button onClick={() => scrollTo('features')} className="text-sm text-slate-500 hover:text-blue-600 transition-colors">Features</button></li>
                <li><button onClick={() => scrollTo('security')} className="text-sm text-slate-500 hover:text-blue-600 transition-colors">Security</button></li>
                <li><button onClick={() => scrollTo('faq')} className="text-sm text-slate-500 hover:text-blue-600 transition-colors">FAQ</button></li>
              </ul>
            </div>
            {/* Bill Types */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wide">Supported Bills</h4>
              <ul className="space-y-2">
                <li className="text-sm text-slate-500">Electricity & Gas</li>
                <li className="text-sm text-slate-500">Water & Sewerage</li>
                <li className="text-sm text-slate-500">Internet & Phone</li>
                <li className="text-sm text-slate-500">Insurance & Council Rates</li>
              </ul>
            </div>
            {/* Contact */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wide">Contact</h4>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm text-slate-500">
                  <Mail size={14} className="shrink-0" /> support@billseasypay.com
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-500">
                  <MapPin size={14} className="shrink-0" /> Sydney, Australia
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-400">
              &copy; {new Date().getFullYear()} BillsEasyPay. All rights reserved. Australian owned & operated.
            </p>
            <div className="flex gap-4 text-xs text-slate-400">
              <span className="hover:text-slate-600 cursor-pointer transition-colors">Privacy Policy</span>
              <span className="hover:text-slate-600 cursor-pointer transition-colors">Terms of Service</span>
              <span className="hover:text-slate-600 cursor-pointer transition-colors">Security</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
