import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Banknote, CheckCircle2, Search, ChevronDown, ChevronUp,
  DollarSign, Clock, Users, Loader2, FileText, AlertTriangle
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const AdminPayments = () => {
  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({});
  const [bulkProcessing, setBulkProcessing] = useState({});
  const [paymentRefs, setPaymentRefs] = useState({});
  const [bulkRef, setBulkRef] = useState({});
  const [expandedProviders, setExpandedProviders] = useState({});
  const [selectedBills, setSelectedBills] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  const axiosInstance = axios.create({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });

  const fetchQueue = useCallback(async () => {
    try {
      const res = await axiosInstance.get(`${API}/admin/payment-queue`);
      setQueue(res.data);
      // Auto-expand all providers
      const expanded = {};
      res.data.providers?.forEach(p => { expanded[p.provider] = true; });
      setExpandedProviders(expanded);
    } catch (err) {
      toast.error('Failed to load payment queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const handlePaySingle = async (billId, provider) => {
    setProcessing(p => ({ ...p, [billId]: true }));
    try {
      await axiosInstance.post(`${API}/admin/pay-bill`, {
        bill_id: billId,
        payment_reference: paymentRefs[billId] || null
      });
      toast.success(`Bill paid successfully`);
      fetchQueue();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Payment failed');
    } finally {
      setProcessing(p => ({ ...p, [billId]: false }));
    }
  };

  const handlePayBulk = async (providerName) => {
    const providerBills = queue?.providers?.find(p => p.provider === providerName);
    const selected = providerBills?.bills
      ?.filter(b => selectedBills[b.bill_id])
      ?.map(b => b.bill_id) || [];

    const billIds = selected.length > 0 ? selected : providerBills?.bills?.map(b => b.bill_id) || [];

    if (billIds.length === 0) return;

    setBulkProcessing(p => ({ ...p, [providerName]: true }));
    try {
      const res = await axiosInstance.post(`${API}/admin/pay-bills-bulk`, {
        bill_ids: billIds,
        payment_reference: bulkRef[providerName] || null
      });
      toast.success(res.data.message);
      fetchQueue();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Bulk payment failed');
    } finally {
      setBulkProcessing(p => ({ ...p, [providerName]: false }));
    }
  };

  const toggleProvider = (provider) => {
    setExpandedProviders(p => ({ ...p, [provider]: !p[provider] }));
  };

  const toggleBillSelection = (billId) => {
    setSelectedBills(p => ({ ...p, [billId]: !p[billId] }));
  };

  const selectAllForProvider = (providerName) => {
    const providerBills = queue?.providers?.find(p => p.provider === providerName);
    const allSelected = providerBills?.bills?.every(b => selectedBills[b.bill_id]);
    const updates = {};
    providerBills?.bills?.forEach(b => { updates[b.bill_id] = !allSelected; });
    setSelectedBills(p => ({ ...p, ...updates }));
  };

  const filteredProviders = queue?.providers?.filter(p =>
    p.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.bills.some(b =>
      b.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.biller_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.reference_number?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  ) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-payments">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Payment Processing</h2>
          <p className="text-sm text-slate-500 mt-1">Review pending bills and process BPAY/bank payments on behalf of customers</p>
        </div>
        <Button variant="outline" onClick={fetchQueue} className="border-slate-300 text-sm" data-testid="refresh-queue-btn">
          Refresh Queue
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock size={22} className="text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Pending Bills</p>
              <p className="text-2xl font-bold text-slate-900" data-testid="pending-count">{queue?.total_pending || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-blue-50 flex items-center justify-center">
              <DollarSign size={22} className="text-teal" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Total Amount</p>
              <p className="text-2xl font-bold text-slate-900" data-testid="total-amount">${queue?.total_amount?.toFixed(2) || '0.00'}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-violet-50 flex items-center justify-center">
              <Users size={22} className="text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Providers</p>
              <p className="text-2xl font-bold text-slate-900" data-testid="provider-count">{queue?.providers?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <Input
          placeholder="Search by provider, customer, biller code, or reference..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 border-slate-200"
          data-testid="payment-search-input"
        />
      </div>

      {/* No Pending Bills */}
      {filteredProviders.length === 0 && (
        <Card className="border-slate-200">
          <CardContent className="p-12 text-center">
            <CheckCircle2 className="mx-auto text-green-400 mb-3" size={40} />
            <p className="text-slate-500 text-sm font-medium">No pending bills to process</p>
            <p className="text-xs text-slate-400 mt-1">All customer bills have been paid</p>
          </CardContent>
        </Card>
      )}

      {/* Provider Groups */}
      {filteredProviders.map(provider => {
        const isExpanded = expandedProviders[provider.provider];
        const allSelected = provider.bills.every(b => selectedBills[b.bill_id]);
        const selectedCount = provider.bills.filter(b => selectedBills[b.bill_id]).length;

        return (
          <Card key={provider.provider} className="border-slate-200 shadow-sm" data-testid={`provider-group-${provider.provider}`}>
            <CardHeader className="px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => toggleProvider(provider.provider)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Banknote size={20} className="text-teal" />
                  <div>
                    <CardTitle className="text-base font-semibold text-slate-900">{provider.provider}</CardTitle>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {provider.bill_count} bill{provider.bill_count !== 1 ? 's' : ''} &middot; Total: <span className="font-semibold text-slate-700">${provider.total_amount.toFixed(2)}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {selectedCount > 0 && (
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-md font-medium">{selectedCount} selected</span>
                  )}
                  {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="px-6 pb-6 pt-0">
                {/* Bulk Actions */}
                <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => selectAllForProvider(provider.provider)}
                      className="rounded border-slate-300"
                      data-testid={`select-all-${provider.provider}`}
                    />
                    Select All
                  </label>
                  <Input
                    placeholder="Bulk payment reference..."
                    value={bulkRef[provider.provider] || ''}
                    onChange={(e) => setBulkRef(p => ({ ...p, [provider.provider]: e.target.value }))}
                    className="flex-1 h-8 text-sm border-slate-200"
                    data-testid={`bulk-ref-${provider.provider}`}
                  />
                  <Button
                    size="sm"
                    onClick={() => handlePayBulk(provider.provider)}
                    disabled={bulkProcessing[provider.provider]}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-4"
                    data-testid={`bulk-pay-${provider.provider}`}
                  >
                    {bulkProcessing[provider.provider] ? (
                      <Loader2 className="animate-spin mr-1" size={12} />
                    ) : (
                      <Banknote size={12} className="mr-1" />
                    )}
                    Pay {selectedCount > 0 ? `${selectedCount} Selected` : 'All'}
                  </Button>
                </div>

                {/* Bills Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid={`payment-table-${provider.provider}`}>
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase w-8"></th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase">Customer</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase">Biller Code</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase">Reference No.</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase">Account</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase">Amount</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase">Due Date</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase">Payment Ref</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-slate-500 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {provider.bills.map(bill => (
                        <tr key={bill.bill_id} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors" data-testid={`payment-row-${bill.bill_id}`}>
                          <td className="py-3 px-3">
                            <input
                              type="checkbox"
                              checked={!!selectedBills[bill.bill_id]}
                              onChange={() => toggleBillSelection(bill.bill_id)}
                              className="rounded border-slate-300"
                            />
                          </td>
                          <td className="py-3 px-3">
                            <p className="font-medium text-slate-900 text-sm">{bill.user_name}</p>
                            <p className="text-xs text-slate-400">{bill.user_email}</p>
                          </td>
                          <td className="py-3 px-3">
                            {bill.biller_code ? (
                              <span className="font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-xs" data-testid={`biller-code-${bill.bill_id}`}>
                                {bill.biller_code}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-amber-600">
                                <AlertTriangle size={12} /> Missing
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {bill.reference_number ? (
                              <span className="font-mono text-sm text-slate-700" data-testid={`ref-number-${bill.bill_id}`}>
                                {bill.reference_number}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-amber-600">
                                <AlertTriangle size={12} /> Missing
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-sm text-slate-600 font-mono">{bill.account_number}</td>
                          <td className="py-3 px-3 text-sm font-bold text-slate-900">${bill.amount.toFixed(2)}</td>
                          <td className="py-3 px-3 text-sm text-slate-600">{bill.due_date?.slice(0, 10)}</td>
                          <td className="py-3 px-3">
                            <Input
                              placeholder="Bank ref..."
                              value={paymentRefs[bill.bill_id] || ''}
                              onChange={(e) => setPaymentRefs(p => ({ ...p, [bill.bill_id]: e.target.value }))}
                              className="h-7 text-xs border-slate-200 w-32"
                              data-testid={`pay-ref-${bill.bill_id}`}
                            />
                          </td>
                          <td className="py-3 px-3 text-right">
                            <Button
                              size="sm"
                              onClick={() => handlePaySingle(bill.bill_id, provider.provider)}
                              disabled={processing[bill.bill_id]}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-3"
                              data-testid={`pay-single-${bill.bill_id}`}
                            >
                              {processing[bill.bill_id] ? (
                                <Loader2 className="animate-spin" size={12} />
                              ) : (
                                'Pay'
                              )}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
};

export default AdminPayments;
