import React, { useState, useEffect } from 'react';
import { axiosInstance, API } from '../App';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { FileText, Upload, Loader2, CheckCircle, ScanLine, AlertCircle } from 'lucide-react';

const BILL_CATEGORIES = [
  'Electricity', 'Water', 'Council', 'Mobile', 'Internet',
  'School Fees', 'Tuition Fees', 'Gas', 'Insurance', 'Other'
];

const AccurassiBillExtractor = ({ user, refreshUser }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [extracted, setExtracted] = useState(false);
  const [extractionMethod, setExtractionMethod] = useState('');
  const [saving, setSaving] = useState(false);
  const [apiStatus, setApiStatus] = useState(null);
  const [formData, setFormData] = useState({
    category: '',
    provider: '',
    account_number: '',
    amount: '',
    due_date: '',
    frequency: 'monthly',
    bpay_code: ''
  });

  useEffect(() => {
    checkApiStatus();
  }, []);

  const checkApiStatus = async () => {
    try {
      const res = await axiosInstance.get(`${API}/accurassi/status`);
      setApiStatus(res.data);
    } catch {
      setApiStatus({ configured: false, ocr_available: true });
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(selected.type)) {
      toast.error('Please upload a JPG, PNG, or PDF file');
      return;
    }
    if (selected.size > 15 * 1024 * 1024) {
      toast.error('File must be under 15MB');
      return;
    }

    setFile(selected);
    setExtracted(false);
    setExtractionMethod('');

    if (selected.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(selected);
    } else {
      setPreview(null);
    }
  };

  const handleExtract = async () => {
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
      setExtractionMethod(data.extraction_method || 'ocr');
      setFormData({
        category: data.category || '',
        provider: data.provider || '',
        account_number: data.account_number || '',
        amount: data.amount ? String(data.amount) : '',
        due_date: data.due_date || '',
        frequency: data.frequency || 'monthly',
        bpay_code: data.bpay_code || ''
      });
      setExtracted(true);
      toast.success('Bill details extracted! Please review and save.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Extraction failed. Try a clearer image.');
    } finally {
      setProcessing(false);
    }
  };

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.category || !formData.provider || !formData.account_number || !formData.amount || !formData.due_date) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSaving(true);
    try {
      await axiosInstance.post(`${API}/bills`, {
        ...formData,
        amount: parseFloat(formData.amount)
      });
      toast.success('Bill saved successfully!');
      resetForm();
      if (refreshUser) refreshUser();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save bill');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setPreview(null);
    setExtracted(false);
    setExtractionMethod('');
    setFormData({ category: '', provider: '', account_number: '', amount: '', due_date: '', frequency: 'monthly', bpay_code: '' });
  };

  return (
    <Card className="shadow-md" data-testid="accurassi-bill-extractor">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center">
            <ScanLine className="text-emerald-600" size={24} />
          </div>
          <div>
            <CardTitle>Smart Bill Extraction</CardTitle>
            <CardDescription>
              Upload a bill image or PDF to automatically extract details
              {apiStatus?.configured ? ' (Accurassi API)' : ' (OCR)'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Upload Area */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-emerald-500 transition-colors">
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png,application/pdf"
            onChange={handleFileChange}
            className="hidden"
            id="accurassi-upload"
            data-testid="bill-file-input"
          />
          <label htmlFor="accurassi-upload" className="cursor-pointer">
            {preview ? (
              <div>
                <img src={preview} alt="Bill preview" className="max-h-48 mx-auto rounded" />
                <p className="text-sm text-gray-600 mt-2">{file?.name}</p>
                <p className="text-xs text-gray-500 mt-1">Click to change</p>
              </div>
            ) : file ? (
              <div>
                <FileText className="mx-auto mb-2 text-emerald-500" size={48} />
                <p className="text-gray-700 font-medium">{file.name}</p>
                <p className="text-sm text-gray-500 mt-1">PDF document selected</p>
                <p className="text-xs text-gray-500 mt-1">Click to change</p>
              </div>
            ) : (
              <>
                <Upload className="mx-auto mb-4 text-gray-400" size={48} />
                <p className="text-gray-600 mb-1">Click to upload a bill</p>
                <p className="text-sm text-gray-500">JPG, PNG, or PDF (max 15MB)</p>
              </>
            )}
          </label>
        </div>

        {/* Extract Button */}
        {file && !extracted && !processing && (
          <Button
            onClick={handleExtract}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            data-testid="extract-bill-btn"
          >
            <ScanLine className="mr-2" size={18} />
            Extract Bill Details
          </Button>
        )}

        {/* Processing */}
        {processing && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
            <Loader2 className="animate-spin text-amber-600" size={24} />
            <div>
              <p className="font-semibold text-amber-900">Analyzing bill...</p>
              <p className="text-sm text-amber-700">Extracting amounts, dates, and provider info</p>
            </div>
          </div>
        )}

        {/* Extracted Summary */}
        {extracted && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="text-green-600" size={20} />
              <span className="font-semibold text-green-900">
                Details Extracted via {extractionMethod === 'accurassi' ? 'Accurassi API' : 'OCR'}
              </span>
            </div>
            <div className="text-xs text-green-700 grid grid-cols-2 gap-1">
              {formData.category && <p>Category: {formData.category}</p>}
              {formData.provider && <p>Provider: {formData.provider}</p>}
              {formData.amount && <p>Amount: ${formData.amount}</p>}
              {formData.account_number && <p>Account: {formData.account_number}</p>}
              {formData.due_date && <p>Due: {formData.due_date}</p>}
              {formData.bpay_code && <p>BPAY: {formData.bpay_code}</p>}
            </div>
          </div>
        )}

        {/* Form */}
        {(extracted || file) && (
          <form onSubmit={handleSave} className="space-y-4 border-t pt-4">
            <p className="text-sm text-gray-600 font-medium">
              {extracted ? 'Review extracted details and save:' : 'Enter bill details manually:'}
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Category *</Label>
                <Select value={formData.category} onValueChange={(v) => handleChange('category', v)}>
                  <SelectTrigger data-testid="extract-category-select">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {BILL_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Provider *</Label>
                <Input
                  value={formData.provider}
                  onChange={(e) => handleChange('provider', e.target.value)}
                  placeholder="e.g., AGL Energy"
                  data-testid="extract-provider-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Account Number *</Label>
                <Input
                  value={formData.account_number}
                  onChange={(e) => handleChange('account_number', e.target.value)}
                  placeholder="Account #"
                  data-testid="extract-account-input"
                />
              </div>
              <div className="space-y-1">
                <Label>Amount ($) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => handleChange('amount', e.target.value)}
                  placeholder="0.00"
                  data-testid="extract-amount-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Due Date *</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => handleChange('due_date', e.target.value)}
                  data-testid="extract-due-date-input"
                />
              </div>
              <div className="space-y-1">
                <Label>Frequency</Label>
                <Select value={formData.frequency} onValueChange={(v) => handleChange('frequency', v)}>
                  <SelectTrigger data-testid="extract-frequency-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>BPAY Code (optional)</Label>
              <Input
                value={formData.bpay_code}
                onChange={(e) => handleChange('bpay_code', e.target.value)}
                placeholder="BPAY biller code"
                data-testid="extract-bpay-input"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                disabled={saving}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                data-testid="save-extracted-bill-btn"
              >
                {saving ? 'Saving...' : 'Save Bill'}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm} data-testid="reset-extract-btn">
                Reset
              </Button>
            </div>
          </form>
        )}

        {/* Info Box */}
        {!file && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="text-blue-600 mt-0.5 flex-shrink-0" size={18} />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-1">Supported Bill Types</p>
                <ul className="space-y-0.5 text-blue-800 text-xs">
                  <li>Electricity, Water, Gas, Internet, Mobile</li>
                  <li>Council rates, Insurance, School fees</li>
                  <li>Upload a clear photo or PDF for best results</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AccurassiBillExtractor;
