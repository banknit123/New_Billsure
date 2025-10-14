import React, { useState, useEffect } from 'react';
import { axiosInstance, API } from '../App';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { CreditCard, Plus, Trash2, CheckCircle } from 'lucide-react';

const BankDetailsManager = ({ user, refreshUser }) => {
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    account_holder_name: '',
    bank_name: '',
    account_number: '',
    routing_number: '',
    account_type: 'checking'
  });

  useEffect(() => {
    fetchBankDetails();
  }, []);

  const fetchBankDetails = async () => {
    try {
      const response = await axiosInstance.get(`${API}/bank-details`);
      setBankAccounts(response.data);
    } catch (error) {
      console.error('Error fetching bank details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (name, value) => {
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axiosInstance.post(`${API}/bank-details`, formData);
      toast.success('Bank account added successfully');
      setDialogOpen(false);
      resetForm();
      fetchBankDetails();
      refreshUser();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add bank account');
    }
  };

  const handleDelete = async (bankId) => {
    if (!window.confirm('Are you sure you want to delete this bank account?')) return;
    
    try {
      await axiosInstance.delete(`${API}/bank-details/${bankId}`);
      toast.success('Bank account deleted successfully');
      fetchBankDetails();
    } catch (error) {
      toast.error('Failed to delete bank account');
    }
  };

  const resetForm = () => {
    setFormData({
      account_holder_name: '',
      bank_name: '',
      account_number: '',
      routing_number: '',
      account_type: 'checking'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="bank-details-manager">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Bank Accounts</h3>
          <p className="text-gray-600 mt-1">Manage your payment methods for automatic deductions</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-bank-btn">
              <Plus className="mr-2" size={20} />
              Add Bank Account
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md" data-testid="bank-dialog">
            <DialogHeader>
              <DialogTitle>Add Bank Account</DialogTitle>
              <DialogDescription>
                Enter your bank account details for automatic bill payments
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="account_holder_name">Account Holder Name</Label>
                <Input
                  id="account_holder_name"
                  value={formData.account_holder_name}
                  onChange={(e) => handleChange('account_holder_name', e.target.value)}
                  placeholder="John Doe"
                  required
                  data-testid="holder-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank_name">Bank Name</Label>
                <Input
                  id="bank_name"
                  value={formData.bank_name}
                  onChange={(e) => handleChange('bank_name', e.target.value)}
                  placeholder="Chase Bank"
                  required
                  data-testid="bank-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account_number">Account Number</Label>
                <Input
                  id="account_number"
                  value={formData.account_number}
                  onChange={(e) => handleChange('account_number', e.target.value)}
                  placeholder="1234567890"
                  required
                  data-testid="account-number-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="routing_number">Routing Number</Label>
                <Input
                  id="routing_number"
                  value={formData.routing_number}
                  onChange={(e) => handleChange('routing_number', e.target.value)}
                  placeholder="123456789"
                  required
                  data-testid="routing-number-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account_type">Account Type</Label>
                <Select value={formData.account_type} onValueChange={(value) => handleChange('account_type', value)} required>
                  <SelectTrigger data-testid="account-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checking">Checking</SelectItem>
                    <SelectItem value="savings">Savings</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-900">
                  <CreditCard className="inline mr-2" size={16} />
                  Your banking information is encrypted and secure
                </p>
              </div>
              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700" data-testid="bank-submit-btn">
                  Add Bank Account
                </Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} data-testid="bank-cancel-btn">
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {bankAccounts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {bankAccounts.map((account) => (
            <Card key={account.id} className="shadow-md hover:shadow-lg transition-shadow" data-testid={`bank-card-${account.id}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center">
                      <CreditCard className="text-emerald-600" size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">{account.bank_name}</h4>
                      <p className="text-sm text-gray-600 capitalize">{account.account_type}</p>
                    </div>
                  </div>
                  {account.is_primary && (
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold flex items-center gap-1">
                      <CheckCircle size={14} />
                      Primary
                    </span>
                  )}
                </div>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Account Holder</span>
                    <span className="font-medium">{account.account_holder_name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Account Number</span>
                    <span className="font-medium">{account.account_number}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Routing Number</span>
                    <span className="font-medium">{account.routing_number}</span>
                  </div>
                </div>
                <Button 
                  onClick={() => handleDelete(account.id)} 
                  variant="outline" 
                  size="sm"
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                  data-testid={`delete-bank-btn-${account.id}`}
                >
                  <Trash2 size={16} className="mr-2" />
                  Remove Account
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="shadow-md">
          <CardContent className="p-12 text-center">
            <CreditCard className="mx-auto mb-4 text-gray-400" size={64} />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Bank Accounts Yet</h3>
            <p className="text-gray-600 mb-6">Add a bank account to enable automatic bill payments</p>
            <Button 
              onClick={() => setDialogOpen(true)} 
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="empty-state-add-bank-btn"
            >
              <Plus className="mr-2" size={20} />
              Add Your First Bank Account
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BankDetailsManager;
