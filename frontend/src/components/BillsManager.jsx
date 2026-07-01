import React, { useState, useEffect, useCallback } from 'react';
import { axiosInstance, API } from '../App';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Plus, Trash2, FileText, Check, Clock, AlertTriangle } from 'lucide-react';
import BillSetupWizard from './BillSetupWizard';

const STATUS_STYLES = {
  paid: { icon: Check, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Paid' },
  pending: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Pending' },
  overdue: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', label: 'Overdue' },
};

const BillsManager = ({ user, refreshUser }) => {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const fetchBills = useCallback(async () => {
    try {
      const res = await axiosInstance.get(`${API}/bills`);
      setBills(res.data);
    } catch(err) { console.error(err.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  const deleteBill = async (id) => {
    setDeleting(id);
    try {
      await axiosInstance.delete(`${API}/bills/${id}`);
      toast.success('Bill removed');
      fetchBills();
      refreshUser();
    } catch { toast.error('Failed to delete'); }
    finally { setDeleting(null); }
  };

  if (showWizard) {
    return (
      <div data-testid="bills-wizard-view">
        <button onClick={() => setShowWizard(false)} className="text-xs text-slate-400 hover:text-teal mb-4 transition-colors" data-testid="back-to-bills-list">
          ← Back to bills list
        </button>
        <BillSetupWizard user={user} refreshUser={refreshUser} onComplete={() => { setShowWizard(false); fetchBills(); }} />
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="bills-page">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>My Bills</h2>
          <p className="text-sm text-slate-500 mt-0.5">{bills.length} bill{bills.length !== 1 ? 's' : ''} tracked</p>
        </div>
        <Button onClick={() => setShowWizard(true)} className="bg-teal text-white hover:bg-teal-600 text-sm" data-testid="add-bill-btn">
          <Plus size={16} className="mr-1.5" /> Add Bill
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-white rounded-xl border border-slate-200 animate-pulse" />)}
        </div>
      ) : bills.length === 0 ? (
        <Card className="border-slate-200" data-testid="no-bills">
          <CardContent className="p-12 text-center">
            <FileText className="mx-auto mb-4 text-slate-300" size={48} />
            <h3 className="text-lg font-semibold text-slate-900 mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>No Bills Yet</h3>
            <p className="text-sm text-slate-500 mb-4">Upload your first bill to get started with smart payment smoothing.</p>
            <Button onClick={() => setShowWizard(true)} className="bg-teal text-white hover:bg-teal-600">
              <Plus size={16} className="mr-1.5" /> Add Your First Bill
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {bills.map(bill => {
            const st = STATUS_STYLES[bill.status] || STATUS_STYLES.pending;
            const StIcon = st.icon;
            return (
              <Card key={bill.id} className="border-slate-200 hover:shadow-sm transition-shadow" data-testid={`bill-${bill.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-9 h-9 rounded-lg ${st.bg} flex items-center justify-center flex-shrink-0`}>
                        <StIcon size={16} className={st.color} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{bill.provider}</p>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          <span>{bill.category}</span>
                          <span>·</span>
                          <span>Due {bill.due_date}</span>
                          <span>·</span>
                          <span className="capitalize">{bill.frequency}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900">${bill.amount?.toFixed(2)}</p>
                        <span className={`text-[10px] font-medium ${st.color}`}>{st.label}</span>
                      </div>
                      <button onClick={() => deleteBill(bill.id)} disabled={deleting === bill.id}
                        className="text-slate-300 hover:text-red-500 transition-colors p-1" data-testid={`delete-bill-${bill.id}`}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BillsManager;
