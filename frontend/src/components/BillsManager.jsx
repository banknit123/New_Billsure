import React, { useState, useEffect } from 'react';
import { axiosInstance, API } from '../App';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, Search, FileText, ScanLine } from 'lucide-react';
import BillUploadDialog from './BillUploadDialog';
import AccurassiBillExtractor from './AccurassiBillExtractor';

const CATEGORIES = ['Electricity','Water','Gas','Internet','Mobile','Council','Insurance','School Fees','Tuition Fees','Other'];

const BillsManager = ({ user, refreshUser }) => {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => { fetchBills(); }, []);

  const fetchBills = async () => {
    try {
      const res = await axiosInstance.get(`${API}/bills`);
      setBills(res.data);
    } catch {} finally { setLoading(false); }
  };

  const deleteBill = async (id) => {
    setDeleting(id);
    try {
      await axiosInstance.delete(`${API}/bills/${id}`);
      toast.success('Bill removed');
      fetchBills();
      refreshUser();
    } catch (err) {
      toast.error('Failed to delete');
    } finally { setDeleting(null); }
  };

  const filtered = bills.filter(b => {
    if (filter !== 'all' && b.status !== filter) return false;
    if (search && !b.provider?.toLowerCase().includes(search.toLowerCase()) &&
        !b.category?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const pending = bills.filter(b => b.status === 'pending');
  const totalPending = pending.reduce((s, b) => s + (b.amount || 0), 0);

  return (
    <div className="space-y-6" data-testid="bills-manager">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Bills
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {bills.length} total &middot; {pending.length} pending &middot; ${totalPending.toFixed(2)} outstanding
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowManual(true)} data-testid="add-bill-manual-btn"
            className="border-slate-300 text-slate-700 text-sm">
            <Plus size={16} className="mr-1" /> Add Manually
          </Button>
        </div>
      </div>

      {/* Scan / Upload Card */}
      <AccurassiBillExtractor user={user} refreshUser={() => { refreshUser(); fetchBills(); }} />

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search bills..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 h-10 border-slate-200" data-testid="bills-search-input" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40 h-10 border-slate-200" data-testid="bills-filter-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bills Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="mx-auto text-slate-300 mb-3" size={40} />
              <p className="text-slate-500 text-sm">No bills found</p>
              <p className="text-xs text-slate-400 mt-1">Upload a bill or add one manually</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="bills-table">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-3">Provider</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-3">Category</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-3">Biller Code</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-3">Reference</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-3">Amount</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-3">Due Date</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-3">Status</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(bill => (
                    <tr key={bill.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors" data-testid={`bill-row-${bill.id}`}>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-slate-900">{bill.provider}</p>
                        <p className="text-xs text-slate-500">{bill.account_number}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium px-2 py-1 rounded-md bg-slate-100 text-slate-700">
                          {bill.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700 font-mono" data-testid={`bill-biller-code-${bill.id}`}>
                        {bill.biller_code || bill.bpay_code || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700 font-mono" data-testid={`bill-reference-${bill.id}`}>
                        {bill.reference_number || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">${bill.amount?.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{bill.due_date?.slice(0, 10)}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-medium px-2 py-1 rounded-md ${
                          bill.status === 'paid' ? 'bg-green-50 text-green-700' :
                          bill.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                          'bg-red-50 text-red-700'
                        }`}>
                          {bill.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {bill.status === 'pending' && (
                          <button onClick={() => deleteBill(bill.id)} disabled={deleting === bill.id}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                            data-testid={`delete-bill-${bill.id}`}>
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Add Dialog */}
      <BillUploadDialog open={showManual} onOpenChange={setShowManual} onBillAdded={() => { fetchBills(); refreshUser(); }} />
    </div>
  );
};

export default BillsManager;
