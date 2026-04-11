import React, { useState } from 'react';
import { axiosInstance, API } from '../../App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { FileText, Download, DollarSign, Users, CheckCircle } from 'lucide-react';

const BulkPaymentReports = () => {
  const [reportType, setReportType] = useState('daily');
  const [provider, setProvider] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        report_type: reportType
      });
      
      if (provider) params.append('provider', provider);
      if (startDate) params.append('start_date', startDate + 'T00:00:00Z');
      if (endDate) params.append('end_date', endDate + 'T23:59:59Z');

      const response = await axiosInstance.get(`${API}/admin/bulk-payment-report?${params}`);
      setReport(response.data);
      toast.success('Report generated successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!report || !report.detailed_bills) return;

    const headers = ['User Name', 'User Email', 'Provider', 'Category', 'Account Number', 'BPAY Code', 'Amount', 'Due Date'];
    const rows = report.detailed_bills.map(bill => [
      bill.user_name,
      bill.user_email,
      bill.provider,
      bill.category,
      bill.account_number,
      bill.bpay_code || 'N/A',
      bill.amount,
      new Date(bill.due_date).toLocaleDateString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk-payment-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Report exported to CSV');
  };

  const handleBulkPayment = async (providerName, billIds) => {
    if (!window.confirm(`Mark ${billIds.length} bills from ${providerName} as paid?`)) return;

    try {
      await axiosInstance.post(`${API}/admin/process-bulk-payment`, {
        provider: providerName,
        bill_ids: billIds
      });
      toast.success(`Bulk payment processed for ${providerName}`);
      fetchReport(); // Refresh report
    } catch (error) {
      toast.error('Failed to process bulk payment');
    }
  };

  return (
    <div className="space-y-6" data-testid="bulk-payment-reports">
      {/* Filters */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Generate Bulk Payment Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="report_type">Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger data-testid="report-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pending</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider">Provider (Optional)</Label>
              <Input
                id="provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="Filter by provider"
                data-testid="provider-filter-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date (Optional)</Label>
              <Input
                id="start_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="start-date-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">End Date (Optional)</Label>
              <Input
                id="end_date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="end-date-input"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <Button 
              onClick={fetchReport} 
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="generate-report-btn"
            >
              {loading ? 'Generating...' : 'Generate Report'}
            </Button>
            {report && (
              <Button 
                onClick={exportToCSV}
                variant="outline"
                data-testid="export-csv-btn"
              >
                <Download className="mr-2" size={16} />
                Export CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Report Summary */}
      {report && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Bills</p>
                    <p className="text-3xl font-bold text-gray-900">{report.total_bills}</p>
                  </div>
                  <div className="bg-blue-50 text-blue-600 p-3 rounded-xl">
                    <FileText size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Amount</p>
                    <p className="text-3xl font-bold text-emerald-600">${report.total_amount.toFixed(2)}</p>
                  </div>
                  <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl">
                    <DollarSign size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Providers</p>
                    <p className="text-3xl font-bold text-gray-900">{report.providers_summary.length}</p>
                  </div>
                  <div className="bg-purple-50 text-purple-600 p-3 rounded-xl">
                    <Users size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Provider Summary */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Bills by Provider (For Bulk Payment)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {report.providers_summary.map((providerData, index) => (
                  <Card key={index} className="border-2" data-testid={`provider-summary-${index}`}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">{providerData.provider}</h3>
                          <p className="text-sm text-gray-600">
                            {providerData.bill_count} bills • Total: ${providerData.total_amount.toFixed(2)}
                          </p>
                        </div>
                        <Button
                          onClick={() => handleBulkPayment(providerData.provider, providerData.bills.map(b => b.bill_id))}
                          className="bg-emerald-600 hover:bg-emerald-700"
                          data-testid={`bulk-pay-btn-${index}`}
                        >
                          <CheckCircle className="mr-2" size={16} />
                          Mark All as Paid
                        </Button>
                      </div>

                      {/* Bills Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left font-semibold text-gray-700">User</th>
                              <th className="px-4 py-3 text-left font-semibold text-gray-700">Account Number</th>
                              <th className="px-4 py-3 text-left font-semibold text-gray-700">BPAY Code</th>
                              <th className="px-4 py-3 text-left font-semibold text-gray-700">Amount</th>
                              <th className="px-4 py-3 text-left font-semibold text-gray-700">Due Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {providerData.bills.map((bill, billIndex) => (
                              <tr key={billIndex} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                  <div>
                                    <p className="font-medium text-gray-900">{bill.user_name}</p>
                                    <p className="text-xs text-gray-500">{bill.user_email}</p>
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-mono text-gray-700">{bill.account_number}</td>
                                <td className="px-4 py-3 font-mono text-gray-700">{bill.bpay_code || 'N/A'}</td>
                                <td className="px-4 py-3 font-bold text-emerald-600">${bill.amount.toFixed(2)}</td>
                                <td className="px-4 py-3 text-gray-700">{new Date(bill.due_date).toLocaleDateString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty State */}
      {!report && !loading && (
        <Card className="shadow-md">
          <CardContent className="p-12 text-center">
            <FileText className="mx-auto mb-4 text-gray-400" size={64} />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Report Generated</h3>
            <p className="text-gray-600">Select filters and click "Generate Report" to view bulk payment data</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BulkPaymentReports;
