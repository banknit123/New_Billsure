import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, CreditCard, Bell, Shield, CheckCircle } from 'lucide-react';

const SettingsPage = ({ user }) => {
  return (
    <div className="space-y-6" data-testid="settings-page">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Account Settings</h2>
        <p className="text-gray-600 mt-1">Manage your account preferences and subscription</p>
      </div>

      {/* Account Information */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User size={20} />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Full Name</p>
              <p className="text-lg font-semibold text-gray-900" data-testid="settings-name">{user?.full_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Email</p>
              <p className="text-lg font-semibold text-gray-900" data-testid="settings-email">{user?.email}</p>
            </div>
            {user?.phone && (
              <div>
                <p className="text-sm text-gray-600 mb-1">Phone</p>
                <p className="text-lg font-semibold text-gray-900" data-testid="settings-phone">{user.phone}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-600 mb-1">Member Since</p>
              <p className="text-lg font-semibold text-gray-900">
                {new Date(user?.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard size={20} />
            Subscription
          </CardTitle>
          <CardDescription>Manage your BillEasyPay subscription</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-6 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-2xl font-bold text-gray-900">Premium Plan</p>
                {user?.subscription_active && (
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                    <CheckCircle size={14} />
                    Active
                  </span>
                )}
              </div>
              <p className="text-gray-600">Unlimited bills • Automatic payments • Priority support</p>
              <p className="text-3xl font-bold text-emerald-600 mt-4">
                ${user?.subscription_fee?.toFixed(2) || '5.00'}
                <span className="text-lg text-gray-600">/month</span>
              </p>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle className="text-emerald-600" size={16} />
              <span>Unlimited bill management</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle className="text-emerald-600" size={16} />
              <span>Automatic payment scheduling</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle className="text-emerald-600" size={16} />
              <span>Bill sharing with family/roommates</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle className="text-emerald-600" size={16} />
              <span>24/7 customer support</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell size={20} />
            Notifications
          </CardTitle>
          <CardDescription>Manage your notification preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-semibold text-gray-900">Email Notifications</p>
              <p className="text-sm text-gray-600">Receive email updates about your bills</p>
            </div>
            <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-semibold">
              Enabled
            </div>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-semibold text-gray-900">Payment Reminders</p>
              <p className="text-sm text-gray-600">Get reminded before bill due dates</p>
            </div>
            <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-semibold">
              Enabled
            </div>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-semibold text-gray-900">Transaction Alerts</p>
              <p className="text-sm text-gray-600">Instant alerts for all transactions</p>
            </div>
            <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-semibold">
              Enabled
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield size={20} />
            Security
          </CardTitle>
          <CardDescription>Keep your account secure</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="text-green-600" size={20} />
              <p className="font-semibold text-green-900">Your account is secure</p>
            </div>
            <p className="text-sm text-green-700">All your data is encrypted and protected with bank-grade security.</p>
          </div>
          <Button variant="outline" className="w-full" data-testid="change-password-btn">
            Change Password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;