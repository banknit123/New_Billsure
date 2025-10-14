import React, { useState } from 'react';
import { axiosInstance, API } from '../App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Upload, FileText, Loader2, CheckCircle } from 'lucide-react';
import { createWorker } from 'tesseract.js';

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
  const [ocrProgress, setOcrProgress] = useState(0);
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
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      if (!validTypes.includes(selectedFile.type)) {
        toast.error('Please upload a JPG or PNG image');
        return;
      }

      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }

      setFile(selectedFile);
      setExtracted(false);
      setOcrProgress(0);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.onerror = () => {
        toast.error('Failed to read file');
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const extractBillData = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    setProcessing(true);
    setOcrProgress(0);
    toast.info('Starting extraction... This may take 15-30 seconds', { duration: 3000 });

    let worker;
    
    try {
      console.log('Creating Tesseract worker...');
      
      worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const progress = Math.round(m.progress * 100);
            setOcrProgress(progress);
          }
        }
      });

      console.log('Worker created successfully');

      const { data: { text } } = await worker.recognize(file);
      
      console.log('Text extracted:', text.substring(0, 200));

      if (!text || text.trim().length < 10) {
        toast.error('Could not extract text. Please try a clearer image.');
        await worker.terminate();
        setProcessing(false);
        return;
      }

      const parsedData = parseBillText(text);
      
      setFormData({
        ...formData,
        ...parsedData
      });

      setExtracted(true);
      toast.success('Information extracted! Please review below.');

      await worker.terminate();
      
    } catch (error) {
      console.error('OCR Error:', error);
      toast.error('Extraction failed: ' + error.message + '. You can enter details manually.');
      
      if (worker) {
        try {
          await worker.terminate();
        } catch (e) {
          console.error('Worker termination error:', e);
        }
      }
    } finally {
      setProcessing(false);
      setOcrProgress(0);
    }
  };

  const parseBillText = (text) => {
    const parsed = {};
    const textLower = text.toLowerCase();

    // Amount extraction
    const amountPatterns = [
      /(?:amount due|total due|balance)[:\s]*\$?\s*(\d+[,\d]*\.?\d{0,2})/i,
      /\$\s*(\d+[,\d]*\.\d{2})/g
    ];
    
    for (const pattern of amountPatterns) {
      const matches = [...text.matchAll(pattern)];
      const amounts = matches.map(m => parseFloat(m[1].replace(/,/g, '')))
        .filter(a => a > 10 && a < 10000);
      if (amounts.length > 0) {
        parsed.amount = Math.max(...amounts).toString();
        break;
      }
    }

    // Date extraction
    const dateMatch = text.match(/(?:due|pay by)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
    if (dateMatch) {
      try {
        const [m, d, y] = dateMatch[1].split(/[-/]/);
        const year = y.length === 2 ? '20' + y : y;
        parsed.due_date = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      } catch (e) {}
    }

    // Account number
    const accountMatch = text.match(/(?:account|acct)[#\s:]*([0-9]{6,15})/i);
    if (accountMatch) {
      parsed.account_number = accountMatch[1];
    }

    // Provider (first non-number line)
    const lines = text.split('\n').filter(l => l.trim().length > 3);
    for (let line of lines.slice(0, 5)) {
      if (line.match(/[a-zA-Z]/) && !line.match(/^\d+$/)) {
        parsed.provider = line.trim();
        break;
      }
    }

    // Category detection
    if (textLower.includes('electric') || textLower.includes('power')) parsed.category = 'Electricity';
    else if (textLower.includes('water')) parsed.category = 'Water';
    else if (textLower.includes('gas')) parsed.category = 'Gas';
    else if (textLower.includes('internet') || textLower.includes('broadband')) parsed.category = 'Internet';
    else if (textLower.includes('mobile') || textLower.includes('phone')) parsed.category = 'Mobile';
    else if (textLower.includes('council')) parsed.category = 'Council';

    return parsed;
  };

  const handleChange = (name, value) => {
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axiosInstance.post(`${API}/bills`, formData);
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
    setOcrProgress(0);
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload & Extract Bill</DialogTitle>
          <DialogDescription>
            Upload a bill image - we'll extract the details automatically
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <Label>Upload Bill Image</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-emerald-500 transition-colors">
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleFileChange}
                className="hidden"
                id="bill-upload"
              />
              <label htmlFor="bill-upload" className="cursor-pointer">
                {preview ? (
                  <div>
                    <img src={preview} alt="Bill" className="max-h-48 mx-auto rounded" />
                    <p className="text-sm text-gray-600 mt-2">{file?.name}</p>
                    <p className="text-xs text-gray-500 mt-1">Click to change</p>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto mb-4 text-gray-400" size={48} />
                    <p className="text-gray-600 mb-2">Click to upload</p>
                    <p className="text-sm text-gray-500">JPG or PNG (max 10MB)</p>
                  </>
                )}
              </label>
            </div>

            {file && !extracted && !processing && (
              <div className="space-y-3">
                <Button 
                  onClick={extractBillData}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  <FileText className="mr-2" size={20} />
                  Extract with AI (15-30 sec)
                </Button>
                <div className="bg-blue-50 p-3 rounded text-xs text-blue-900">
                  💡 Use a clear, well-lit photo for best results
                </div>
              </div>
            )}

            {processing && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="animate-spin text-yellow-600" size={20} />
                  <span className="font-semibold text-yellow-900">Processing...</span>
                </div>
                {ocrProgress > 0 && (
                  <div className="mt-2">
                    <div className="w-full bg-yellow-200 rounded-full h-2">
                      <div className="bg-yellow-600 h-2 rounded-full" style={{width: `${ocrProgress}%`}}></div>
                    </div>
                    <p className="text-xs text-center mt-1">{ocrProgress}%</p>
                  </div>
                )}
              </div>
            )}

            {extracted && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="text-green-600" size={20} />
                  <span className="font-semibold text-green-900">Extracted!</span>
                </div>
                <div className="text-xs text-green-700 space-y-1">
                  {formData.category && <p>✓ Category: {formData.category}</p>}
                  {formData.provider && <p>✓ Provider: {formData.provider}</p>}
                  {formData.amount && <p>✓ Amount: ${formData.amount}</p>}
                  {formData.account_number && <p>✓ Account: {formData.account_number}</p>}
                  {formData.due_date && <p>✓ Due: {formData.due_date}</p>}
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={formData.category} onValueChange={(v) => handleChange('category', v)} required>
                <SelectTrigger>
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
              />
            </div>

            <div className="space-y-2">
              <Label>Account Number *</Label>
              <Input
                value={formData.account_number}
                onChange={(e) => handleChange('account_number', e.target.value)}
                required
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
              />
            </div>

            <div className="space-y-2">
              <Label>Due Date *</Label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => handleChange('due_date', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={formData.frequency} onValueChange={(v) => handleChange('frequency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                Save Bill
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
