import React, { useState, useEffect } from 'react';
import { axiosInstance, API } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Receipt, AlertCircle, Upload } from 'lucide-react';
import BillUploadDialog from './BillUploadDialog';

const BILL_CATEGORIES = [
  'Electricity',
  'Water',
  'Council',
  'Mobile',
  'Internet',
  'School Fees',
  'Tuition Fees',
  'Gas',
  'Insurance',
  'Other'
];

const BillsManager = ({ user, refreshUser }) => {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [formData, setFormData] = useState({
    category: '',
    provider: '',
    account_number: '',
    amount: '',
    due_date: '',
    frequency: 'monthly'
  });

  useEffect(() => {
    fetchBills();
  }, []);

  const fetchBills = async () => {
    try {
      const response = await axiosInstance.get(`${API}/bills`);
      setBills(response.data);
    } catch (error) {
      toast.error('Failed to fetch bills');
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
      if (editingBill) {
        await axiosInstance.put(`${API}/bills/${editingBill.id}`, formData);
        toast.success('Bill updated successfully');
      } else {
        await axiosInstance.post(`${API}/bills`, formData);
        toast.success('Bill added successfully');
      }
      setDialogOpen(false);
      resetForm();
      fetchBills();
      refreshUser();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save bill');
    }
  };

  const handleEdit = (bill) => {
    setEditingBill(bill);
    setFormData({
      category: bill.category,
      provider: bill.provider,
      account_number: bill.account_number,
      amount: bill.amount.toString(),
      due_date: bill.due_date.split('T')[0],
      frequency: bill.frequency
    });
    setDialogOpen(true);
  };

  const handleDelete = async (billId) => {
    if (!window.confirm('Are you sure you want to delete this bill?')) return;
    
    try {
      await axiosInstance.delete(`${API}/bills/${billId}`);
      toast.success('Bill deleted successfully');
      fetchBills();
      refreshUser();
    } catch (error) {
      toast.error('Failed to delete bill');
    }
  };

  const handlePayBill = async (billId) => {
    if (!window.confirm('Are you sure you want to pay this bill?')) return;
    
    try {
      await axiosInstance.post(`${API}/transactions/pay-bill/${billId}`);
      toast.success('Bill paid successfully');
      fetchBills();
      refreshUser();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to pay bill');
    }
  };

  const resetForm = () => {
    setFormData({
      category: '',
      provider: '',
      account_number: '',
      amount: '',
      due_date: '',
      frequency: 'monthly'
    });
    setEditingBill(null);
  };

  const handleDialogClose = (open) => {
    setDialogOpen(open);
    if (!open) {
      resetForm();
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
    <div className="space-y-6" data-testid="bills-manager">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Manage Your Bills</h2>
          <p className="text-gray-600 mt-1">Add, edit, and track all your utility bills in one place</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-bill-btn">
              <Plus className="mr-2" size={20} />
              Add Bill
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md" data-testid="bill-dialog">
            <DialogHeader>
              <DialogTitle>{editingBill ? 'Edit Bill' : 'Add New Bill'}</DialogTitle>
              <DialogDescription>
                {editingBill ? 'Update your bill information' : 'Enter your bill details below'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={formData.category} onValueChange={(value) => handleChange('category', value)} required>
                  <SelectTrigger data-testid="bill-category-select">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {BILL_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Input
                  id="provider"
                  value={formData.provider}
                  onChange={(e) => handleChange('provider', e.target.value)}
                  placeholder="e.g., ABC Energy"
                  required
                  data-testid="bill-provider-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account_number">Account Number</Label>
                <Input
                  id="account_number"
                  value={formData.account_number}
                  onChange={(e) => handleChange('account_number', e.target.value)}
                  placeholder="e.g., 123456789"
                  required
                  data-testid="bill-account-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount ($)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => handleChange('amount', e.target.value)}
                  placeholder="0.00"
                  required
                  data-testid="bill-amount-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => handleChange('due_date', e.target.value)}
                  required
                  data-testid="bill-due-date-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="frequency">Frequency</Label>
                <Select value={formData.frequency} onValueChange={(value) => handleChange('frequency', value)} required>
                  <SelectTrigger data-testid="bill-frequency-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700" data-testid="bill-submit-btn">
                  {editingBill ? 'Update Bill' : 'Add Bill'}
                </Button>
                <Button type="button" variant="outline" onClick={() => handleDialogClose(false)} data-testid="bill-cancel-btn">
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Bills List */}
      {bills.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bills.map((bill) => (
            <Card key={bill.id} className="shadow-md hover:shadow-lg transition-shadow" data-testid={`bill-card-${bill.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center">
                      <Receipt className="text-emerald-600" size={24} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{bill.category}</CardTitle>
                      <p className="text-sm text-gray-600">{bill.provider}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    bill.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {bill.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Account</span>
                    <span className="font-medium">{bill.account_number}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Amount</span>
                    <span className="font-bold text-emerald-600">${bill.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Due Date</span>
                    <span className="font-medium">{new Date(bill.due_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Frequency</span>
                    <span className="font-medium capitalize">{bill.frequency}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {bill.status === 'pending' && (
                    <Button 
                      onClick={() => handlePayBill(bill.id)} 
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      size="sm"
                      data-testid={`pay-bill-btn-${bill.id}`}
                    >
                      Pay Now
                    </Button>
                  )}
                  <Button 
                    onClick={() => handleEdit(bill)} 
                    variant="outline" 
                    size="sm"
                    data-testid={`edit-bill-btn-${bill.id}`}
                  >
                    <Edit size={16} />
                  </Button>
                  <Button 
                    onClick={() => handleDelete(bill.id)} 
                    variant="outline" 
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    data-testid={`delete-bill-btn-${bill.id}`}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="shadow-md">
          <CardContent className="p-12 text-center">
            <Receipt className="mx-auto mb-4 text-gray-400" size={64} />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Bills Yet</h3>
            <p className="text-gray-600 mb-6">Start by adding your first bill to track and manage payments</p>
            <Button 
              onClick={() => setDialogOpen(true)} 
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="empty-state-add-bill-btn"
            >
              <Plus className="mr-2" size={20} />
              Add Your First Bill
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BillsManager;