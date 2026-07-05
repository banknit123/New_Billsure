import React, { useEffect, useState } from 'react';

const CONSENT_KEY = 'billsure_cookie_consent'; // 'accepted' | 'declined'

// Gates third-party analytics (PostHog) behind an explicit visitor choice.
// Necessary/authentication cookies are always active regardless of this
// banner — only the optional analytics script is deferred.
export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (stored === 'accepted') {
      window.__enablePostHogAnalytics && window.__enablePostHogAnalytics();
    } else if (stored !== 'declined') {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    window.__enablePostHogAnalytics && window.__enablePostHogAnalytics();
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(CONSENT_KEY, 'declined');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 inset-x-0 z-[9998] bg-[#0f172a] text-white px-4 py-4 sm:px-6 sm:py-5 shadow-[0_-4px_16px_rgba(0,0,0,0.2)]"
    >
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm text-slate-200 flex-1">
          We use essential cookies to run BillSure (login, security). With your consent, we'd also like to use
          privacy-conscious analytics (PostHog) to understand how the product is used — you can decline and still use
          the full site. See our{' '}
          <a href="/legal/privacy" className="underline text-teal-300 hover:text-teal-200">
            Privacy Policy
          </a>
          .
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={decline}
            className="px-4 py-2 text-sm font-medium rounded-md border border-slate-500 text-slate-200 hover:bg-slate-800"
          >
            Necessary only
          </button>
          <button
            onClick={accept}
            className="px-4 py-2 text-sm font-medium rounded-md bg-teal-500 text-slate-900 hover:bg-teal-400"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
