import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ListChecks, Loader2, CheckCircle2, AlertTriangle, ShieldCheck,
  ChevronDown, ChevronUp, Send, XCircle, RefreshCw,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const STATUS_STYLES = {
  pending_approval: 'bg-amber-50 text-amber-700',
  approved: 'bg-blue-50 text-blue-700',
  executing: 'bg-blue-50 text-blue-700',
  completed: 'bg-emerald-50 text-emerald-700',
};

const ITEM_STATUS_STYLES = {
  queued: 'bg-slate-100 text-slate-600',
  submitted: 'bg-amber-50 text-amber-700',
  cleared: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-700',
};

const AdminPaymentRuns = () => {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [horizonDays, setHorizonDays] = useState(3);
  const [expandedRun, setExpandedRun] = useState(null);
  const [runItems, setRunItems] = useState({});
  const [itemsLoading, setItemsLoading] = useState({});
  const [approving, setApproving] = useState({});
  const [itemRefs, setItemRefs] = useState({});
  const [itemReasons, setItemReasons] = useState({});
  const [itemBusy, setItemBusy] = useState({});

  const [reconciliation, setReconciliation] = useState(null);
  const [exceptions, setExceptions] = useState([]);
  const [reconLoading, setReconLoading] = useState(true);
  const [runningRecon, setRunningRecon] = useState(false);

  const axiosInstance = axios.create({
    headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
  });

  const fetchRuns = useCallback(async () => {
    try {
      const res = await axiosInstance.get(`${API}/admin/payment-runs`);
      setRuns(res.data || []);
    } catch (err) {
      toast.error('Failed to load payment runs');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReconciliation = useCallback(async () => {
    setReconLoading(true);
    try {
      const [latestRes, exceptionsRes] = await Promise.all([
        axiosInstance.get(`${API}/admin/reconciliation/latest`),
        axiosInstance.get(`${API}/admin/reconciliation/exceptions`),
      ]);
      setReconciliation(latestRes.data);
      setExceptions(exceptionsRes.data || []);
    } catch (err) {
      toast.error('Failed to load reconciliation status');
    } finally {
      setReconLoading(false);
    }
  }, []);

  useEffect(() => { fetchRuns(); fetchReconciliation(); }, [fetchRuns, fetchReconciliation]);

  const handleRunReconciliation = async () => {
    setRunningRecon(true);
    try {
      await axiosInstance.post(`${API}/admin/reconciliation/run`);
      toast.success('Reconciliation run complete');
      fetchReconciliation();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Reconciliation run failed');
    } finally {
      setRunningRecon(false);
    }
  };

  const handleCreateRun = async () => {
    setCreating(true);
    try {
      const res = await axiosInstance.post(`${API}/admin/payment-runs`, null, {
        params: { horizon_days: horizonDays }
      });
      toast.success(`Payment run built: ${res.data.item_count} bill(s), $${Number(res.data.total_amount).toFixed(2)} total`);
      fetchRuns();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create payment run');
    } finally {
      setCreating(false);
    }
  };

  const toggleRun = async (runId) => {
    if (expandedRun === runId) {
      setExpandedRun(null);
      return;
    }
    setExpandedRun(runId);
    if (!runItems[runId]) {
      setItemsLoading(p => ({ ...p, [runId]: true }));
      try {
        const res = await axiosInstance.get(`${API}/admin/payment-runs/${runId}/items`);
        setRunItems(p => ({ ...p, [runId]: res.data || [] }));
      } catch (err) {
        toast.error('Failed to load run items');
      } finally {
        setItemsLoading(p => ({ ...p, [runId]: false }));
      }
    }
  };

  const refreshRunItems = async (runId) => {
    try {
      const res = await axiosInstance.get(`${API}/admin/payment-runs/${runId}/items`);
      setRunItems(p => ({ ...p, [runId]: res.data || [] }));
    } catch (err) {
      toast.error('Failed to refresh run items');
    }
  };

  const handleApprove = async (runId) => {
    setApproving(p => ({ ...p, [runId]: true }));
    try {
      await axiosInstance.post(`${API}/admin/payment-runs/${runId}/approve`);
      toast.success('Payment run approved');
      fetchRuns();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Approval failed');
    } finally {
      setApproving(p => ({ ...p, [runId]: false }));
    }
  };

  const handleSubmitItem = async (runId, itemId) => {
    setItemBusy(p => ({ ...p, [itemId]: true }));
    try {
      await axiosInstance.post(`${API}/admin/payment-runs/items/${itemId}/submit`, {
        provider_payment_reference: itemRefs[itemId] || ''
      });
      toast.success('Item marked submitted');
      refreshRunItems(runId);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to mark submitted');
    } finally {
      setItemBusy(p => ({ ...p, [itemId]: false }));
    }
  };

  const handleClearItem = async (runId, itemId) => {
    setItemBusy(p => ({ ...p, [itemId]: true }));
    try {
      await axiosInstance.post(`${API}/admin/payment-runs/items/${itemId}/clear`, {
        provider_payment_reference: itemRefs[itemId] || ''
      });
      toast.success('Item cleared — ledger updated');
      refreshRunItems(runId);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to clear item');
    } finally {
      setItemBusy(p => ({ ...p, [itemId]: false }));
    }
  };

  const handleFailItem = async (runId, itemId) => {
    const reason = itemReasons[itemId];
    if (!reason) {
      toast.error('Enter a reason before marking failed');
      return;
    }
    setItemBusy(p => ({ ...p, [itemId]: true }));
    try {
      await axiosInstance.post(`${API}/admin/payment-runs/items/${itemId}/fail`, { reason });
      toast.success('Item marked failed');
      refreshRunItems(runId);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to mark item failed');
    } finally {
      setItemBusy(p => ({ ...p, [itemId]: false }));
    }
  };

  const reconOk = reconciliation && reconciliation.status === 'ok' && exceptions.length === 0;

  return (
    <div className="space-y-6" data-testid="admin-payment-runs">
      <div>
        <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Payment Runs</h2>
        <p className="text-sm text-slate-500 mt-1">Prioritised, maker-checker bill payment — bills are only paid out of a customer's own cleared, available balance</p>
      </div>

      {/* Reconciliation status */}
      <Card className={`border ${reconLoading ? 'border-slate-200' : reconOk ? 'border-emerald-200' : 'border-red-200'}`} data-testid="reconciliation-status-card">
        <CardContent className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              {reconLoading ? (
                <Loader2 className="animate-spin text-slate-400" size={22} />
              ) : reconOk ? (
                <ShieldCheck size={22} className="text-emerald-600" />
              ) : (
                <AlertTriangle size={22} className="text-red-600" />
              )}
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {reconLoading ? 'Checking reconciliation status…' : reconOk ? 'Trust account reconciled' : 'Reconciliation exception open'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {reconciliation ? (
                    <>Last run: {new Date(reconciliation.run_at).toLocaleString()} · trust ledger ${Number(reconciliation.trust_ledger_balance).toFixed(2)} · customers ${Number(reconciliation.sum_customer_balances).toFixed(2)}</>
                  ) : !reconLoading ? 'No reconciliation run on record — payment run approval is blocked until one runs' : ''}
                  {exceptions.length > 0 && <span className="text-red-600 font-medium"> · {exceptions.length} open exception(s)</span>}
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={handleRunReconciliation} disabled={runningRecon}
              className="border-slate-300 text-xs" data-testid="run-reconciliation-btn">
              {runningRecon ? <Loader2 className="animate-spin mr-1" size={12} /> : <RefreshCw size={12} className="mr-1" />}
              Run Reconciliation Now
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Create run */}
      <Card className="border-slate-200">
        <CardContent className="p-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <ListChecks size={20} className="text-teal" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Build a new payment run</p>
              <p className="text-xs text-slate-500">Queues due bills payable from each customer's own cleared, available balance</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Horizon (days)</label>
            <Input type="number" min={1} max={30} value={horizonDays}
              onChange={e => setHorizonDays(Number(e.target.value) || 3)}
              className="w-20 h-8 text-sm border-slate-200" data-testid="horizon-days-input" />
            <Button size="sm" onClick={handleCreateRun} disabled={creating}
              className="bg-slate-900 hover:bg-slate-800 text-xs h-8" data-testid="create-payment-run-btn">
              {creating ? <Loader2 className="animate-spin mr-1" size={12} /> : null}
              Create Run
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Runs list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-slate-400" size={28} />
        </div>
      ) : runs.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="p-12 text-center">
            <CheckCircle2 className="mx-auto text-green-400 mb-3" size={40} />
            <p className="text-slate-500 text-sm font-medium">No payment runs yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {runs.map(run => {
            const isExpanded = expandedRun === run.id;
            const items = runItems[run.id] || [];
            return (
              <Card key={run.id} className="border-slate-200 shadow-sm" data-testid={`payment-run-${run.id}`}>
                <CardHeader className="px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => toggleRun(run.id)}>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-sm font-semibold text-slate-900">Run {run.id.slice(0, 8)}</CardTitle>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_STYLES[run.status] || 'bg-slate-100 text-slate-600'}`}>
                            {run.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {run.item_count} bill{run.item_count !== 1 ? 's' : ''} · ${Number(run.total_amount).toFixed(2)} · created {new Date(run.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {run.status === 'pending_approval' && (
                        <Button size="sm" onClick={(e) => { e.stopPropagation(); handleApprove(run.id); }}
                          disabled={approving[run.id]}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
                          data-testid={`approve-run-${run.id}`}>
                          {approving[run.id] ? <Loader2 className="animate-spin mr-1" size={12} /> : <CheckCircle2 size={12} className="mr-1" />}
                          Approve
                        </Button>
                      )}
                      {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="px-6 pb-6 pt-0">
                    {itemsLoading[run.id] ? (
                      <div className="flex justify-center py-6"><Loader2 className="animate-spin text-slate-400" size={20} /></div>
                    ) : items.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4">No items in this run</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm" data-testid={`run-items-table-${run.id}`}>
                          <thead>
                            <tr className="border-b border-slate-200">
                              <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase">Priority</th>
                              <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase">Amount</th>
                              <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                              <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase">Provider Reference</th>
                              <th className="text-right py-2 px-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map(item => (
                              <tr key={item.id} className="border-b border-slate-100" data-testid={`run-item-${item.id}`}>
                                <td className="py-3 px-3 text-slate-600">{item.priority_rank}</td>
                                <td className="py-3 px-3 font-bold text-slate-900">${Number(item.amount).toFixed(2)}</td>
                                <td className="py-3 px-3">
                                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ITEM_STATUS_STYLES[item.status] || 'bg-slate-100 text-slate-600'}`}>
                                    {item.status}
                                  </span>
                                </td>
                                <td className="py-3 px-3">
                                  <Input
                                    placeholder="Bank/BPAY ref..."
                                    value={itemRefs[item.id] ?? item.provider_payment_reference ?? ''}
                                    onChange={(e) => setItemRefs(p => ({ ...p, [item.id]: e.target.value }))}
                                    className="h-7 text-xs border-slate-200 w-40"
                                    disabled={item.status === 'cleared' || item.status === 'failed'}
                                    data-testid={`item-ref-${item.id}`}
                                  />
                                </td>
                                <td className="py-3 px-3">
                                  <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                    {item.status === 'queued' && (
                                      <Button size="sm" onClick={() => handleSubmitItem(run.id, item.id)} disabled={itemBusy[item.id]}
                                        className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-7 px-2.5" data-testid={`submit-item-${item.id}`}>
                                        <Send size={12} className="mr-1" /> Submit
                                      </Button>
                                    )}
                                    {item.status === 'submitted' && (
                                      <Button size="sm" onClick={() => handleClearItem(run.id, item.id)} disabled={itemBusy[item.id]}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2.5" data-testid={`clear-item-${item.id}`}>
                                        <CheckCircle2 size={12} className="mr-1" /> Clear
                                      </Button>
                                    )}
                                    {(item.status === 'queued' || item.status === 'submitted') && (
                                      <>
                                        <Input
                                          placeholder="Fail reason..."
                                          value={itemReasons[item.id] || ''}
                                          onChange={(e) => setItemReasons(p => ({ ...p, [item.id]: e.target.value }))}
                                          className="h-7 text-xs border-slate-200 w-28"
                                          data-testid={`item-fail-reason-${item.id}`}
                                        />
                                        <Button size="sm" variant="outline" onClick={() => handleFailItem(run.id, item.id)} disabled={itemBusy[item.id]}
                                          className="border-red-200 text-red-600 hover:bg-red-50 text-xs h-7 px-2.5" data-testid={`fail-item-${item.id}`}>
                                          <XCircle size={12} className="mr-1" /> Fail
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminPaymentRuns;
