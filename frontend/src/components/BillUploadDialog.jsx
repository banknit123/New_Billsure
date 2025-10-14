import React, { useState } from 'react';
import { axiosInstance, API } from '../App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Upload, FileText, Loader2, CheckCircle } from 'lucide-react';
import Tesseract from 'tesseract.js';

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
      setFile(selectedFile);
      setExtracted(false);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
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
    toast.info('Extracting bill information...', { duration: 3000 });

    try {
      // Use Tesseract.js to extract text from image
      const result = await Tesseract.recognize(preview, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      const extractedText = result.data.text;
      console.log('Extracted text:', extractedText);

      // Parse the extracted text to find bill details
      const parsedData = parseBillText(extractedText);
      
      setFormData({
        ...formData,
        ...parsedData
      });

      setExtracted(true);
      toast.success('Bill information extracted! Please review and edit if needed.');
    } catch (error) {
      console.error('OCR Error:', error);
      toast.error('Failed to extract bill information. Please enter manually.');
    } finally {
      setProcessing(false);
    }
  };

  const parseBillText = (text) => {
    const parsed = {};

    // Extract amount (look for currency patterns like $123.45 or 123.45)
    const amountMatch = text.match(/\$?\s*(\d+[\d,]*\.?\d{0,2})/);
    if (amountMatch) {
      const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
      if (amount > 0 && amount < 10000) { // Reasonable bill amount
        parsed.amount = amount.toString();
      }
    }

    // Extract due date (look for date patterns)
    const dateMatch = text.match(/(?:due|payment|pay by)[:\s]*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i);
    if (dateMatch) {
      try {
        const dateParts = dateMatch[1].split(/[-/]/);
        if (dateParts.length === 3) {
          let [month, day, year] = dateParts;
          if (year.length === 2) {
            year = '20' + year;
          }
          parsed.due_date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      } catch (e) {
        console.error('Date parsing error:', e);
      }
    }

    // Extract account number (look for account/acct number)
    const accountMatch = text.match(/(?:account|acct|a\/c)[#\s:]*([0-9]{6,15})/i);
    if (accountMatch) {
      parsed.account_number = accountMatch[1];
    }

    // Try to detect provider/company name (usually at the top)
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 0) {
      // Look for company names in first few lines
      for (let i = 0; i < Math.min(3, lines.length); i++) {
        const line = lines[i].trim();
        if (line.length > 3 && line.length < 50 && !line.match(/^\d/)) {
          parsed.provider = line;
          break;
        }
      }
    }

    // Try to detect category based on keywords
    const textLower = text.toLowerCase();
    if (textLower.includes('electric') || textLower.includes('power')) {
      parsed.category = 'Electricity';
    } else if (textLower.includes('water')) {
      parsed.category = 'Water';
    } else if (textLower.includes('gas')) {
      parsed.category = 'Gas';
    } else if (textLower.includes('internet') || textLower.includes('broadband')) {
      parsed.category = 'Internet';
    } else if (textLower.includes('mobile') || textLower.includes('phone')) {
      parsed.category = 'Mobile';
    } else if (textLower.includes('council')) {
      parsed.category = 'Council';
    }

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
      if (onBillAdded) {
        onBillAdded();
      }
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
          <DialogTitle>Upload & Extract Bill Information</DialogTitle>
          <DialogDescription>
            Upload a bill image or PDF and we'll automatically extract the details using AI
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Upload Section */}
          <div className="space-y-4">
            <Label htmlFor="bill-file">Upload Bill Document</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-emerald-500 transition-colors">
              <input
                id="bill-file"
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="hidden"
                data-testid="file-input"
              />
              <label htmlFor="bill-file" className="cursor-pointer">
                {preview ? (
                  <div className="space-y-4">
                    <img src={preview} alt="Bill preview" className="max-h-48 mx-auto rounded" />
                    <p className="text-sm text-gray-600">{file?.name}</p>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto mb-4 text-gray-400" size={48} />
                    <p className="text-gray-600 mb-2">Click to upload or drag and drop</p>
                    <p className="text-sm text-gray-500">PNG, JPG, or PDF (max 10MB)</p>
                  </>
                )}
              </label>
            </div>

            {file && !extracted && (
              <Button 
                onClick={extractBillData} 
                disabled={processing}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                data-testid="extract-btn"
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" size={20} />
                    Extracting Information...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2" size={20} />
                    Extract Bill Information
                  </>
                )}
              </Button>
            )}

            {extracted && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle size={20} />
                  <span className="font-semibold">Information Extracted!</span>
                </div>
                <p className="text-sm text-green-600 mt-1">Review the details below and make any necessary corrections.</p>
              </div>
            )}
          </div>

          {/* Bill Details Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select value={formData.category} onValueChange={(value) => handleChange('category', value)} required>
                <SelectTrigger data-testid="upload-category-select">
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
              <Label htmlFor="provider">Provider *</Label>
              <Input
                id="provider"
                value={formData.provider}
                onChange={(e) => handleChange('provider', e.target.value)}
                placeholder="e.g., ABC Energy"
                required
                data-testid="upload-provider-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_number">Account Number *</Label>
              <Input
                id="account_number"
                value={formData.account_number}
                onChange={(e) => handleChange('account_number', e.target.value)}
                placeholder="e.g., 123456789"
                required
                data-testid="upload-account-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount ($) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                placeholder="0.00"
                required
                data-testid="upload-amount-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date *</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => handleChange('due_date', e.target.value)}
                required
                data-testid="upload-due-date-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency</Label>
              <Select value={formData.frequency} onValueChange={(value) => handleChange('frequency', value)} required>
                <SelectTrigger data-testid="upload-frequency-select">
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
              <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700" data-testid="upload-submit-btn">
                Save Bill
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="upload-cancel-btn">
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
