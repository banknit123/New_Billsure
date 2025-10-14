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
      // Check file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      if (!validTypes.includes(selectedFile.type)) {
        toast.error('Please upload a JPG or PNG image');
        return;
      }

      // Check file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }

      setFile(selectedFile);
      setExtracted(false);
      
      // Create preview
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
    toast.info('Extracting bill information...', { duration: 3000 });

    try {
      // Check file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file (PNG, JPG)');
        setProcessing(false);
        return;
      }

      console.log('Starting OCR on file:', file.name);

      // Use Tesseract.js to extract text from image
      const { data } = await Tesseract.recognize(
        file,
        'eng',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
            }
          }
        }
      );

      const extractedText = data.text;
      console.log('Extracted text:', extractedText);

      if (!extractedText || extractedText.trim().length < 10) {
        toast.error('Could not extract enough text from image. Please try a clearer image or enter manually.');
        setProcessing(false);
        return;
      }

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
      toast.error('Failed to extract bill information. Please enter manually or try a different image.');
    } finally {
      setProcessing(false);
    }
  };

  const parseBillText = (text) => {
    const parsed = {};
    const textLower = text.toLowerCase();

    // Enhanced amount extraction with multiple patterns
    let amountFound = false;
    
    // Pattern 1: Look for "amount due", "total", "balance due"
    const amountPatterns = [
      /(?:amount due|total due|balance due|amount|total|balance)[:\s]*\$?\s*(\d+[,\d]*\.?\d{0,2})/i,
      /\$\s*(\d+[,\d]*\.\d{2})/g,
      /(?:pay|payment)[:\s]*\$?\s*(\d+[,\d]*\.?\d{0,2})/i
    ];
    
    for (const pattern of amountPatterns) {
      const matches = text.matchAll(pattern);
      const amounts = [];
      for (const match of matches) {
        const amount = parseFloat(match[1].replace(/,/g, ''));
        if (amount > 10 && amount < 10000) {
          amounts.push(amount);
        }
      }
      if (amounts.length > 0) {
        // Take the largest amount as it's likely the total
        parsed.amount = Math.max(...amounts).toString();
        amountFound = true;
        break;
      }
    }

    // Enhanced date extraction with multiple formats
    const datePatterns = [
      /(?:due date|payment due|pay by|due)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /(?:due date|payment due|pay by|due)[:\s]*(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4})/i,
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/
    ];
    
    for (const pattern of datePatterns) {
      const dateMatch = text.match(pattern);
      if (dateMatch) {
        try {
          let dateStr = dateMatch[1];
          
          // Handle month names
          if (dateStr.match(/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i)) {
            const monthMap = {
              jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
              jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
            };
            const parts = dateStr.split(/\s+/);
            const day = parts[0].padStart(2, '0');
            const month = monthMap[parts[1].toLowerCase().substr(0, 3)];
            const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
            parsed.due_date = `${year}-${month}-${day}`;
          } else {
            // Handle numeric dates
            const dateParts = dateStr.split(/[-/]/);
            if (dateParts.length === 3) {
              let day, month, year;
              
              // Try to determine format (MM/DD/YYYY or DD/MM/YYYY)
              if (parseInt(dateParts[0]) > 12) {
                // Must be DD/MM/YYYY
                [day, month, year] = dateParts;
              } else if (parseInt(dateParts[1]) > 12) {
                // Must be MM/DD/YYYY
                [month, day, year] = dateParts;
              } else {
                // Ambiguous - default to MM/DD/YYYY (US format)
                [month, day, year] = dateParts;
              }
              
              if (year.length === 2) {
                year = '20' + year;
              }
              parsed.due_date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
          }
          break;
        } catch (e) {
          console.error('Date parsing error:', e);
        }
      }
    }

    // Enhanced account number extraction
    const accountPatterns = [
      /(?:account\s*(?:number|no|#)|acct\s*(?:number|no|#)|customer\s*(?:number|no|#))[:\s]*([0-9]{6,20})/i,
      /(?:ref|reference)[:\s]*([0-9]{6,20})/i,
      /(?:a\/c|acc)[:\s]*([0-9]{6,20})/i
    ];
    
    for (const pattern of accountPatterns) {
      const accountMatch = text.match(pattern);
      if (accountMatch) {
        parsed.account_number = accountMatch[1];
        break;
      }
    }

    // Enhanced provider detection
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const providerKeywords = ['energy', 'power', 'electric', 'water', 'gas', 'telecom', 'internet', 'council', 'utility'];
    
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      // Look for company names (should have some letters, not all numbers)
      if (line.length > 3 && line.length < 60 && line.match(/[a-zA-Z]/) && !line.match(/^\d+$/)) {
        // Check if line contains provider keywords or is likely a company name
        const lineWords = line.toLowerCase().split(/\s+/);
        if (lineWords.some(word => providerKeywords.includes(word)) || 
            (line.match(/^[A-Z]/) && line.split(/\s+/).length >= 2 && line.split(/\s+/).length <= 5)) {
          parsed.provider = line;
          break;
        }
      }
    }

    // Enhanced category detection with more keywords
    const categoryDetection = {
      'Electricity': ['electric', 'power', 'energy supply', 'electricity'],
      'Water': ['water', 'aqua', 'h2o', 'water supply'],
      'Gas': ['gas', 'natural gas', 'lpg'],
      'Internet': ['internet', 'broadband', 'wifi', 'nbn', 'fibre', 'fiber'],
      'Mobile': ['mobile', 'phone', 'cellular', 'telstra', 'vodafone', 'optus'],
      'Council': ['council', 'rates', 'municipal'],
      'Insurance': ['insurance', 'policy', 'premium'],
      'School Fees': ['school', 'tuition', 'education', 'university', 'college'],
    };
    
    for (const [category, keywords] of Object.entries(categoryDetection)) {
      if (keywords.some(keyword => textLower.includes(keyword))) {
        parsed.category = category;
        break;
      }
    }

    // Extract BPAY reference if available
    const bpayMatch = text.match(/(?:bpay|biller code)[:\s]*([0-9]{4,6})/i);
    if (bpayMatch) {
      parsed.bpay_code = bpayMatch[1];
    }

    const bpayRefMatch = text.match(/(?:ref|reference)[:\s]*([0-9]{6,20})/i);
    if (bpayRefMatch && !parsed.account_number) {
      parsed.account_number = bpayRefMatch[1];
    }

    console.log('Parsed bill data:', parsed);
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
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleFileChange}
                className="hidden"
                data-testid="file-input"
              />
              <label htmlFor="bill-file" className="cursor-pointer">
                {preview ? (
                  <div className="space-y-4">
                    <img src={preview} alt="Bill preview" className="max-h-48 mx-auto rounded" />
                    <p className="text-sm text-gray-600">{file?.name}</p>
                    <p className="text-xs text-gray-500">Click to change image</p>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto mb-4 text-gray-400" size={48} />
                    <p className="text-gray-600 mb-2">Click to upload or drag and drop</p>
                    <p className="text-sm text-gray-500">JPG or PNG only (max 10MB)</p>
                    <p className="text-xs text-emerald-600 mt-2">📸 For best results, take a clear photo of your bill</p>
                  </>
                )}
              </label>
            </div>

            {file && !extracted && (
              <div className="space-y-4">
                <Button 
                  onClick={extractBillData} 
                  disabled={processing}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  data-testid="extract-btn"
                >
                  {processing ? (
                    <>
                      <Loader2 className="mr-2 animate-spin" size={20} />
                      Extracting Information... (This may take 10-20 seconds)
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2" size={20} />
                      Extract Bill Information with AI
                    </>
                  )}
                </Button>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900 font-semibold mb-2">💡 Tips for best results:</p>
                  <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                    <li>Use a clear, well-lit photo</li>
                    <li>Make sure text is readable and not blurry</li>
                    <li>Include the full bill in the image</li>
                    <li>Extraction takes 10-20 seconds - please wait</li>
                  </ul>
                </div>
              </div>
            )}

            {extracted && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle size={20} />
                  <span className="font-semibold">Information Extracted!</span>
                </div>
                <p className="text-sm text-green-600 mt-1">Review the details below and make any necessary corrections.</p>
                <div className="mt-3 space-y-1 text-xs text-green-700">
                  {formData.category && <p>✓ Category: {formData.category}</p>}
                  {formData.provider && <p>✓ Provider: {formData.provider}</p>}
                  {formData.amount && <p>✓ Amount: ${formData.amount}</p>}
                  {formData.account_number && <p>✓ Account: {formData.account_number}</p>}
                  {formData.due_date && <p>✓ Due Date: {formData.due_date}</p>}
                </div>
              </div>
            )}

            {processing && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-yellow-700">
                  <Loader2 className="animate-spin" size={20} />
                  <span className="font-semibold">Processing Image...</span>
                </div>
                <p className="text-sm text-yellow-600 mt-1">
                  Our AI is reading your bill. This usually takes 10-20 seconds. Please wait...
                </p>
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
