import React, { useState, useEffect } from 'react';
import { axiosInstance, API } from '../App';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { FileText, Plus, CheckCircle, XCircle, Calendar, DollarSign, Building } from 'lucide-react';
import DirectDebitRequestForm from './DirectDebitRequestForm';

const DirectDebitManagement = ({ user, refreshUser }) => {
  const [mandates, setMandates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedMandate, setSelectedMandate] = useState(null);

  useEffect(() => {
    fetchMandates();
  }, []);

  const fetchMandates = async () => {
    try {
      const response = await axiosInstance.get(`${API}/direct-debit/mandates`);
      setMandates(response.data);
    } catch (error) {
      console.error('Error fetching mandates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelMandate = async (mandateId) => {
    if (!window.confirm('Are you sure you want to cancel this Direct Debit mandate? This action cannot be undone.')) {
      return;
    }

    try {
      await axiosInstance.put(`${API}/direct-debit/mandate/${mandateId}/cancel`);
      toast.success('Direct Debit mandate cancelled successfully');
      fetchMandates();
    } catch (error) {
      toast.error('Failed to cancel mandate');
    }
  };

  const handleMandateCreated = (mandate) => {
    setShowCreateDialog(false);
    fetchMandates();
    if (refreshUser) refreshUser();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="direct-debit-management">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold text-gray-900">Direct Debit Management</h3>
          <p className="text-gray-600 mt-1">Manage your automatic payment arrangements</p>
        </div>
        <Button 
          onClick={() => setShowCreateDialog(true)}
          className="bg-emerald-600 hover:bg-emerald-700"
          data-testid="create-ddr-btn"
        >
          <Plus className="mr-2" size={20} />
          Set Up Direct Debit
        </Button>
      </div>

      {mandates.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {mandates.map((mandate) => (
            <Card 
              key={mandate.id} 
              className={`shadow-md hover:shadow-lg transition-shadow ${
                mandate.status === 'cancelled' ? 'opacity-60' : ''
              }`}
              data-testid={`mandate-card-${mandate.id}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center">
                      <FileText className="text-emerald-600" size={24} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{mandate.provider}</CardTitle>
                      <CardDescription>{mandate.provider_type}</CardDescription>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    mandate.status === 'active' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {mandate.status === 'active' ? (
                      <><CheckCircle className="inline mr-1" size={12} /> Active</>
                    ) : (
                      <><XCircle className="inline mr-1" size={12} /> Cancelled</>
                    )}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Mandate Details */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-600 mb-1">Mandate Reference</p>
                    <p className="font-semibold font-mono">{mandate.mandate_reference}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 mb-1">Bank</p>
                    <p className="font-semibold">{mandate.bank_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 mb-1">Account</p>
                    <p className="font-semibold">****{mandate.account_number.slice(-4)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 mb-1">BSB</p>
                    <p className="font-semibold">{mandate.bsb}</p>
                  </div>
                </div>

                <div className="border-t pt-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-2">
                      <Calendar size={16} />
                      Payment Frequency
                    </span>
                    <span className="font-semibold capitalize">{mandate.payment_frequency}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-2">
                      <DollarSign size={16} />
                      Max Amount
                    </span>
                    <span className="font-semibold">${mandate.max_payment_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-2">
                      <Building size={16} />
                      Provider Account
                    </span>
                    <span className="font-semibold">{mandate.provider_account_number}</span>
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded text-xs text-gray-600">
                  <p><strong>Created:</strong> {new Date(mandate.created_at).toLocaleDateString()}</p>
                  <p><strong>Start Date:</strong> {new Date(mandate.start_date).toLocaleDateString()}</p>
                  <p><strong>Authorized by:</strong> {mandate.signature}</p>
                </div>

                {mandate.status === 'active' && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setSelectedMandate(mandate)}
                      className="flex-1"
                      data-testid={`view-mandate-btn-${mandate.id}`}
                    >
                      View Details
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleCancelMandate(mandate.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      data-testid={`cancel-mandate-btn-${mandate.id}`}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="shadow-md">
          <CardContent className="p-12 text-center">
            <FileText className="mx-auto mb-4 text-gray-400" size={64} />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Direct Debit Arrangements</h3>
            <p className="text-gray-600 mb-6">Set up automatic payments for your bills with Direct Debit</p>
            <Button 
              onClick={() => setShowCreateDialog(true)}
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="empty-state-create-ddr-btn"
            >
              <Plus className="mr-2" size={20} />
              Set Up Direct Debit
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create DDR Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Set Up Direct Debit Request</DialogTitle>
          </DialogHeader>
          <DirectDebitRequestForm 
            onComplete={handleMandateCreated}
            onCancel={() => setShowCreateDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* View Mandate Details Dialog */}
      <Dialog open={selectedMandate !== null} onOpenChange={() => setSelectedMandate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Direct Debit Mandate Details</DialogTitle>
          </DialogHeader>
          {selectedMandate && (
            <div className="space-y-4">
              <div className="bg-emerald-50 p-4 rounded-lg">
                <h4 className="font-bold text-emerald-900 mb-2">Active Mandate</h4>
                <p className="text-sm text-emerald-800">
                  This Direct Debit arrangement is currently active. Payments will be processed automatically according to the schedule below.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-semibold text-gray-900">Mandate Reference</p>
                  <p className="text-gray-700">{selectedMandate.mandate_reference}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Provider</p>
                  <p className="text-gray-700">{selectedMandate.provider}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Bank Name</p>
                  <p className="text-gray-700">{selectedMandate.bank_name}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">BSB</p>
                  <p className="text-gray-700">{selectedMandate.bsb}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Account Number</p>
                  <p className="text-gray-700">****{selectedMandate.account_number.slice(-4)}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Account Type</p>
                  <p className="text-gray-700 capitalize">{selectedMandate.account_type}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Payment Frequency</p>
                  <p className="text-gray-700 capitalize">{selectedMandate.payment_frequency}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Maximum Amount</p>
                  <p className="text-gray-700">${selectedMandate.max_payment_amount.toFixed(2)}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Start Date</p>
                  <p className="text-gray-700">{new Date(selectedMandate.start_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Authorized Date</p>
                  <p className="text-gray-700">{new Date(selectedMandate.authorization_date).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg">
                <p className="text-sm text-yellow-900">
                  <strong>Cancellation:</strong> You can cancel this arrangement at any time by clicking the "Cancel" button or contacting your financial institution directly.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DirectDebitManagement;
