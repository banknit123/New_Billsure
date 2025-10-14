import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Clock, PiggyBank, Users, CheckCircle, Menu, X } from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const features = [
    {
      icon: <PiggyBank className="w-12 h-12 text-emerald-600" />,
      title: 'Bill Consolidation',
      description: 'Manage all your utility bills in one place. Never miss a payment again.',
      image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71'
    },
    {
      icon: <Clock className="w-12 h-12 text-emerald-600" />,
      title: 'Smart Payment Structuring',
      description: 'Set up weekly, fortnightly, or monthly contributions that automatically cover your bills.',
      image: 'https://images.unsplash.com/photo-1748439281934-2803c6a3ee36'
    },
    {
      icon: <Shield className="w-12 h-12 text-emerald-600" />,
      title: 'Secure & Automated',
      description: 'Your bills are paid automatically on time, every time. Bank-grade security.',
      image: 'https://images.unsplash.com/photo-1554098415-788601c80aef'
    }
  ];

  const benefits = [
    'Never miss a bill payment',
    'Avoid late fees and penalties',
    'Better budgeting with fixed contributions',
    'Transparent fee structure',
    'Share bills with family or roommates',
    'Real-time payment tracking'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white">
      {/* Navigation */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xl">B</span>
                </div>
                <span className="ml-3 text-2xl font-bold text-gray-900">BillEasyPay</span>
              </div>
            </div>
            
            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-4">
              <a href="#features" className="text-gray-700 hover:text-emerald-600 px-3 py-2 transition-colors">Features</a>
              <a href="#how-it-works" className="text-gray-700 hover:text-emerald-600 px-3 py-2 transition-colors">How It Works</a>
              <a href="#pricing" className="text-gray-700 hover:text-emerald-600 px-3 py-2 transition-colors">Pricing</a>
              <Button variant="outline" onClick={() => navigate('/login')} data-testid="login-btn">
                Login
              </Button>
              <Button onClick={() => navigate('/register')} className="bg-emerald-600 hover:bg-emerald-700" data-testid="register-btn">
                Get Started
              </Button>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-gray-700 hover:text-emerald-600"
                data-testid="mobile-menu-btn"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden pb-4 border-t" data-testid="mobile-menu">
              <div className="flex flex-col space-y-2 pt-4">
                <a href="#features" className="text-gray-700 hover:text-emerald-600 px-3 py-2">Features</a>
                <a href="#how-it-works" className="text-gray-700 hover:text-emerald-600 px-3 py-2">How It Works</a>
                <a href="#pricing" className="text-gray-700 hover:text-emerald-600 px-3 py-2">Pricing</a>
                <Button variant="outline" onClick={() => navigate('/login')} className="w-full">
                  Login
                </Button>
                <Button onClick={() => navigate('/register')} className="w-full bg-emerald-600 hover:bg-emerald-700">
                  Get Started
                </Button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight">
                All your bills,
                <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent"> one easy payment</span>
              </h1>
              <p className="text-xl text-gray-600 leading-relaxed">
                Never miss a bill payment again. Set up automatic contributions and let us handle the rest. Simple, secure, and stress-free.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg" 
                  onClick={() => navigate('/register')} 
                  className="bg-emerald-600 hover:bg-emerald-700 text-lg px-8 py-6"
                  data-testid="hero-get-started-btn"
                >
                  Get Started Free
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="text-lg px-8 py-6"
                  onClick={() => document.getElementById('how-it-works').scrollIntoView({ behavior: 'smooth' })}
                  data-testid="learn-more-btn"
                >
                  Learn More
                </Button>
              </div>
              <div className="flex items-center gap-8 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <span>No setup fees</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <span>Cancel anytime</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <img 
                  src="https://images.unsplash.com/photo-1758519289714-519a9d9b96e3" 
                  alt="Modern digital payment" 
                  className="w-full h-auto object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/20 to-transparent"></div>
              </div>
              <div className="absolute -bottom-6 -left-6 bg-white rounded-xl shadow-lg p-4 max-w-xs">
                <p className="text-sm text-gray-600">Trusted by thousands</p>
                <p className="text-2xl font-bold text-emerald-600">$2M+ in bills paid</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">How BillEasyPay Works</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">Three simple features that guarantee you'll never miss a bill payment</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-none shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group" data-testid={`feature-card-${index}`}>
                <div className="h-48 overflow-hidden">
                  <img 
                    src={feature.image} 
                    alt={feature.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                </div>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-center w-16 h-16 bg-emerald-50 rounded-xl">
                    {feature.icon}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-4 bg-gradient-to-b from-emerald-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Simple. Automatic. Reliable.</h2>
            <p className="text-xl text-gray-600">Get started in minutes</p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
            <div className="order-2 md:order-1">
              <img 
                src="https://images.unsplash.com/photo-1637262448017-0fbbec87a898" 
                alt="Financial management"
                className="rounded-2xl shadow-xl"
              />
            </div>
            <div className="order-1 md:order-2 space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xl font-bold">
                  1
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Add Your Bills</h3>
                  <p className="text-gray-600">Enter your utility bills manually or upload bill documents. We support electricity, water, council, mobile, internet, and more.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xl font-bold">
                  2
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Set Payment Frequency</h3>
                  <p className="text-gray-600">Choose weekly, fortnightly, or monthly contributions. We calculate the exact amount you need to save.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xl font-bold">
                  3
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Relax & Enjoy</h3>
                  <p className="text-gray-600">We automatically pay your bills on time. No more late fees, no more stress.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Benefits Grid */}
          <div className="grid md:grid-cols-3 gap-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-3 bg-white p-4 rounded-lg shadow-sm" data-testid={`benefit-${index}`}>
                <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                <span className="text-gray-700">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h2>
          <p className="text-xl text-gray-600 mb-12">One low monthly fee. No hidden charges.</p>
          
          <Card className="border-2 border-emerald-600 shadow-xl" data-testid="pricing-card">
            <CardContent className="p-12">
              <div className="mb-8">
                <div className="text-6xl font-bold text-gray-900 mb-2">
                  $5<span className="text-2xl text-gray-600">/month</span>
                </div>
                <p className="text-gray-600">That's less than a coffee per week!</p>
              </div>
              <ul className="space-y-4 mb-8 text-left max-w-md mx-auto">
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Unlimited bill management</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Automatic payment scheduling</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Payment reminders & notifications</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Share bills with family/roommates</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Bank-grade security</span>
                </li>
              </ul>
              <Button 
                size="lg" 
                onClick={() => navigate('/register')} 
                className="bg-emerald-600 hover:bg-emerald-700 text-lg px-12 py-6"
                data-testid="pricing-get-started-btn"
              >
                Start Your Free Trial
              </Button>
              <p className="text-sm text-gray-500 mt-4">No credit card required. Cancel anytime.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-emerald-600 to-teal-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Ready to take control of your bills?</h2>
          <p className="text-xl text-emerald-50 mb-8">Join thousands of users who never miss a payment</p>
          <Button 
            size="lg" 
            onClick={() => navigate('/register')} 
            className="bg-white text-emerald-600 hover:bg-gray-100 text-lg px-12 py-6"
            data-testid="cta-get-started-btn"
          >
            Get Started Now
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">B</span>
                </div>
                <span className="ml-2 text-xl font-bold text-white">BillEasyPay</span>
              </div>
              <p className="text-sm">Making bill payments simple, automatic, and stress-free.</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-emerald-400 transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-emerald-400 transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-emerald-400 transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-emerald-400 transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-emerald-400 transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-emerald-400 transition-colors">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-emerald-400 transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-emerald-400 transition-colors">Terms & Conditions</a></li>
                <li><a href="#" className="hover:text-emerald-400 transition-colors">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; 2025 BillEasyPay. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;