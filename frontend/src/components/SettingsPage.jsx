import React, { useState } from 'react';
import DirectDebitManagement from './DirectDebitManagement';
import ProviderConnectionManager from './ProviderConnectionManager';
import BankDetailsManager from './BankDetailsManager';

const tabs = [
  { id: 'bank', label: 'Bank Details' },
  { id: 'ddr', label: 'Direct Debit' },
  { id: 'providers', label: 'Providers' },
];

const SettingsPage = ({ user, refreshUser }) => {
  const [activeTab, setActiveTab] = useState('bank');

  return (
    <div className="space-y-6" data-testid="settings-page">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
          Settings
        </h2>
        <p className="text-sm text-slate-500 mt-1">Manage your bank details, direct debits, and provider connections</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
              activeTab === t.id
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            data-testid={`settings-tab-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'bank' && <BankDetailsManager user={user} refreshUser={refreshUser} />}
        {activeTab === 'ddr' && <DirectDebitManagement user={user} refreshUser={refreshUser} />}
        {activeTab === 'providers' && <ProviderConnectionManager user={user} refreshUser={refreshUser} />}
      </div>
    </div>
  );
};

export default SettingsPage;
