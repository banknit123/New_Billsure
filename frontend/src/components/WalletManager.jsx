import React, { useState, useEffect } from 'react';
import { axiosInstance, API } from '../App';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Wallet, Plus, TrendingUp, Receipt, CreditCard, Calendar } from 'lucide-react';

const WalletManager = ({ user, refreshUser }) => {
  const [transactions, setTransactions] = useState([]);
  const [paymentStructure, setPaymentStructure] = useState(null);
  const [loading, setLoading] = useState(true);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [structureDialogOpen, setStructureDialogOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [paymentFrequency, setPaymentFrequency] = useState('monthly');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [transactionsRes, structureRes] = await Promise.all([
        axiosInstance.get(`${API}/transactions`),
        axiosInstance.get(`${API}/payment-structure`).catch(() => ({ data: null }))
      ]);
      setTransactions(transactionsRes.data);
      setPaymentStructure(structureRes.data);
    } catch (error) {
      console.error('Error fetching wallet data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async (e) => {
    e.preventDefault();
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      await axiosInstance.post(`${API}/transactions/deposit`, {
        amount: parseFloat(depositAmount),
        payment_method: 'card'
      });
      toast.success('Deposit successful!');
      setDepositDialogOpen(false);
      setDepositAmount('');
      fetchData();
      refreshUser();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Deposit failed');
    }
  };

  const handleSetupPaymentStructure = async (e) => {
    e.preventDefault();
    try {
      const response = await axiosInstance.post(`${API}/payment-structure`, {
        payment_frequency: paymentFrequency
      });
      setPaymentStructure(response.data);
      toast.success('Payment structure set up successfully!');
      setStructureDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to set up payment structure');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="wallet-manager">
      {/* Wallet Balance Card */}
      <Card className="bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-xl" data-testid="wallet-balance-card">
        <CardContent className="p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 mb-2">Current Balance</p>
              <h2 className="text-5xl font-bold">${user?.wallet_balance?.toFixed(2) || '0.00'}</h2>
              <p className="text-emerald-100 mt-4 text-sm">Available for bill payments</p>
            </div>
            <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm">
              <Wallet size={48} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="grid md:grid-cols-2 gap-6">
        <Dialog open={depositDialogOpen} onOpenChange={setDepositDialogOpen}>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow group" data-testid="add-funds-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Add Funds</h3>
                    <p className="text-gray-600">Deposit money to your wallet</p>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-xl group-hover:bg-emerald-100 transition-colors">
                    <Plus className="text-emerald-600" size={32} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent data-testid="deposit-dialog">
            <DialogHeader>
              <DialogTitle>Add Funds to Wallet</DialogTitle>
              <DialogDescription>Enter the amount you want to deposit</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleDeposit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="deposit_amount">Amount ($)</Label>
                <Input
                  id="deposit_amount"
                  type="number"
                  step="0.01"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  data-testid="deposit-amount-input"
                />
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-900">
                  <CreditCard className="inline mr-2" size={16} />
                  This is a mock payment. In production, this would integrate with Stripe/PayPal.
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700" data-testid="deposit-submit-btn">
                  Deposit Funds
                </Button>
                <Button type="button" variant="outline" onClick={() => setDepositDialogOpen(false)} data-testid="deposit-cancel-btn">
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={structureDialogOpen} onOpenChange={setStructureDialogOpen}>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow group" data-testid="setup-structure-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Payment Structure</h3>
                    <p className="text-gray-600">Set up automatic contributions</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-xl group-hover:bg-blue-100 transition-colors">
                    <Calendar className="text-blue-600" size={32} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent data-testid="structure-dialog">
            <DialogHeader>
              <DialogTitle>Set Up Payment Structure</DialogTitle>
              <DialogDescription>
                Choose how often you want to contribute to your bill payments
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSetupPaymentStructure} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="payment_frequency">Payment Frequency</Label>
                <Select value={paymentFrequency} onValueChange={setPaymentFrequency} required>
                  <SelectTrigger data-testid="frequency-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="fortnightly">Fortnightly (Every 2 weeks)</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="bg-emerald-50 p-4 rounded-lg">
                <p className="text-sm text-emerald-900">
                  We'll calculate the exact contribution amount based on your total monthly bills.
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700" data-testid="structure-submit-btn">
                  Set Up Structure
                </Button>
                <Button type="button" variant="outline" onClick={() => setStructureDialogOpen(false)} data-testid="structure-cancel-btn">
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Payment Structure Info */}
      {paymentStructure && (
        <Card className="shadow-md border-l-4 border-l-emerald-500" data-testid="payment-structure-info">
          <CardHeader>
            <CardTitle>Your Payment Structure</CardTitle>
            <CardDescription>Automatic contribution schedule</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">Payment Frequency</p>
                <p className="text-2xl font-bold text-gray-900 capitalize">{paymentStructure.payment_frequency}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Contribution Amount</p>
                <p className="text-2xl font-bold text-emerald-600">${paymentStructure.contribution_amount.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Monthly Bills</p>
                <p className="text-2xl font-bold text-gray-900">${paymentStructure.total_monthly_bills.toFixed(2)}</p>
              </div>
            </div>
            <div className="mt-4 p-4 bg-emerald-50 rounded-lg">
              <p className="text-sm text-emerald-900">
                <Calendar className="inline mr-2" size={16} />
                Next scheduled contribution: {new Date(paymentStructure.next_payment_date).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions History */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>All your wallet transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length > 0 ? (
            <div className="space-y-3">
              {transactions.map((transaction, index) => (
                <div 
                  key={transaction.id} 
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  data-testid={`wallet-transaction-${index}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      transaction.type === 'deposit' ? 'bg-green-100 text-green-600' : 
                      transaction.type === 'bill_payment' ? 'bg-blue-100 text-blue-600' :
                      'bg-orange-100 text-orange-600'
                    }`}>
                      {transaction.type === 'deposit' ? <TrendingUp size={20} /> : <Receipt size={20} />}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{transaction.description}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(transaction.created_at).toLocaleString()}
                      </p>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        transaction.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {transaction.status}
                      </span>
                    </div>
                  </div>
                  <p className={`text-xl font-bold ${
                    transaction.type === 'deposit' ? 'text-green-600' : 'text-blue-600'
                  }`}>
                    {transaction.type === 'deposit' ? '+' : '-'}${transaction.amount.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Wallet className="mx-auto mb-4 text-gray-400" size={64} />
              <p className="text-lg font-semibold">No transactions yet</p>
              <p className="text-sm mt-2">Your transaction history will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WalletManager;