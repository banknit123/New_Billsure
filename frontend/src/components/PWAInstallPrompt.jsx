import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show banner if not dismissed before
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed) setShowBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowBanner(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:max-w-sm" data-testid="pwa-install-banner">
      <div className="bg-navy rounded-xl shadow-2xl p-4 flex items-center gap-3 border border-navy-500">
        <img src="/logo-icon.png" alt="BillSure" className="w-11 h-11 rounded-lg flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Install BillSure</p>
          <p className="text-xs text-slate-400 mt-0.5">Add to home screen for the full app experience</p>
        </div>
        <Button onClick={handleInstall} size="sm" className="bg-teal text-white hover:bg-teal-600 text-xs px-3 flex-shrink-0" data-testid="pwa-install-btn">
          <Download size={14} className="mr-1" /> Install
        </Button>
        <button onClick={handleDismiss} className="text-slate-500 hover:text-white p-1 flex-shrink-0" data-testid="pwa-dismiss-btn">
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
