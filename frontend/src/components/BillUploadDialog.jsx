import React, { useState } from 'react';
import { axiosInstance, API } from '../App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Upload, FileText, Loader2, CheckCircle } from 'lucide-react';

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

const BillUploadDialog = ({ open, onOpenChange, onBillAdded }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [extracted, setExtracted] = useState(false);
  const [formData, setFormData] = useState({
    category: '',
    provider: '',
    account_number: '',
    amount: '',
    due_date: '',
    frequency: 'monthly'
  });

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!validTypes.includes(selectedFile.type)) {
        toast.error('Please upload a JPG, PNG, or PDF file');
        return;
      }

      if (selectedFile.size > 15 * 1024 * 1024) {
        toast.error('File size must be less than 15MB');
        return;
      }

      setFile(selectedFile);
      setExtracted(false);

      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => setPreview(reader.result);
        reader.readAsDataURL(selectedFile);
      } else {
        setPreview(null);
      }
    }
  };

  const extractBillData = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    setProcessing(true);
    toast.info('Extracting bill details... This may take 10-30 seconds');

    try {
      const fd = new FormData();
      fd.append('file', file);

      const res = await axiosInstance.post(`${API}/bills/extract`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000
      });

      const data = res.data;
      setFormData(prev => ({
        ...prev,
        category: data.category || prev.category,
        provider: data.provider || prev.provider,
        account_number: data.account_number || prev.account_number,
        amount: data.amount ? String(data.amount) : prev.amount,
        due_date: data.due_date || prev.due_date,
        frequency: data.frequency || prev.frequency,
      }));

      setExtracted(true);
      toast.success('Details extracted! Please review below.');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Extraction failed. Enter details manually.');
    } finally {
      setProcessing(false);
    }
  };

  const handleChange = (name, value) => {
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axiosInstance.post(`${API}/bills`, {
        ...formData,
        amount: parseFloat(formData.amount)
      });
      toast.success('Bill added successfully');
      onOpenChange(false);
      resetForm();
      if (onBillAdded) onBillAdded();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save bill');
    }
  };

  const resetForm = () => {
    setFile(null);
    setPreview(null);
    setExtracted(false);
    setFormData({
      category: '',
      provider: '',
      account_number: '',
      amount: '',
      due_date: '',
      frequency: 'monthly'
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) resetForm();
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="bill-upload-dialog">
        <DialogHeader>
          <DialogTitle>Upload & Extract Bill</DialogTitle>
          <DialogDescription>
            Upload a bill image or PDF - we'll extract the details automatically
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <Label>Upload Bill (Image or PDF)</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-emerald-500 transition-colors">
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,application/pdf"
                onChange={handleFileChange}
                className="hidden"
                id="bill-upload"
                data-testid="dialog-bill-file-input"
              />
              <label htmlFor="bill-upload" className="cursor-pointer">
                {preview ? (
                  <div>
                    <img src={preview} alt="Bill" className="max-h-48 mx-auto rounded" />
                    <p className="text-sm text-gray-600 mt-2">{file?.name}</p>
                    <p className="text-xs text-gray-500 mt-1">Click to change</p>
                  </div>
                ) : file ? (
                  <div>
                    <FileText className="mx-auto mb-2 text-emerald-500" size={48} />
                    <p className="text-gray-700 font-medium">{file.name}</p>
                    <p className="text-xs text-gray-500 mt-1">Click to change</p>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto mb-4 text-gray-400" size={48} />
                    <p className="text-gray-600 mb-2">Click to upload</p>
                    <p className="text-sm text-gray-500">JPG, PNG, or PDF (max 15MB)</p>
                  </>
                )}
              </label>
            </div>

            {file && !extracted && !processing && (
              <Button
                onClick={extractBillData}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                data-testid="dialog-extract-btn"
              >
                <FileText className="mr-2" size={20} />
                Extract Details (10-30 sec)
              </Button>
            )}

            {processing && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <Loader2 className="animate-spin text-yellow-600" size={20} />
                  <span className="font-semibold text-yellow-900">Analyzing bill...</span>
                </div>
              </div>
            )}

            {extracted && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="text-green-600" size={20} />
                  <span className="font-semibold text-green-900">Extracted!</span>
                </div>
                <div className="text-xs text-green-700 space-y-1">
                  {formData.category && <p>Category: {formData.category}</p>}
                  {formData.provider && <p>Provider: {formData.provider}</p>}
                  {formData.amount && <p>Amount: ${formData.amount}</p>}
                  {formData.account_number && <p>Account: {formData.account_number}</p>}
                  {formData.due_date && <p>Due: {formData.due_date}</p>}
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={formData.category} onValueChange={(v) => handleChange('category', v)} required>
                <SelectTrigger data-testid="dialog-category-select">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {BILL_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Provider *</Label>
              <Input
                value={formData.provider}
                onChange={(e) => handleChange('provider', e.target.value)}
                required
                data-testid="dialog-provider-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Account Number *</Label>
              <Input
                value={formData.account_number}
                onChange={(e) => handleChange('account_number', e.target.value)}
                required
                data-testid="dialog-account-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Amount ($) *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                required
                data-testid="dialog-amount-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Due Date *</Label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => handleChange('due_date', e.target.value)}
                required
                data-testid="dialog-due-date-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={formData.frequency} onValueChange={(v) => handleChange('frequency', v)}>
                <SelectTrigger data-testid="dialog-frequency-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700" data-testid="dialog-save-bill-btn">
                Save Bill
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="dialog-cancel-btn">
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BillUploadDialog;

