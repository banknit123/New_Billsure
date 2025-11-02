import React, { useState, useEffect } from 'react';
import { axiosInstance, API } from '../App';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Trash2, RefreshCw, Zap, Droplet, Flame, Wifi, Phone, Shield, CheckCircle } from 'lucide-react';

const PROVIDER_TYPES = {
  'Electricity': { icon: Zap, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  'Water': { icon: Droplet, color: 'text-blue-600', bg: 'bg-blue-50' },
  'Gas': { icon: Flame, color: 'text-orange-600', bg: 'bg-orange-50' },
  'Internet': { icon: Wifi, color: 'text-purple-600', bg: 'bg-purple-50' },
  'Mobile': { icon: Phone, color: 'text-green-600', bg: 'bg-green-50' },
  'Insurance': { icon: Shield, color: 'text-indigo-600', bg: 'bg-indigo-50' }
};

const ProviderConnectionManager = ({ user, refreshUser }) => {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    provider_name: '',
    provider_type: '',
    account_number: '',
    customer_id: '',
    api_key: ''
  });

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      const response = await axiosInstance.get(`${API}/provider/connections`);
      setConnections(response.data);
    } catch (error) {
      console.error('Error fetching connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (name, value) => {
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axiosInstance.post(`${API}/provider/connect`, formData);
      toast.success('Provider connected successfully!');
      setDialogOpen(false);
      resetForm();
      fetchConnections();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to connect provider');
    }
  };

  const handleSync = async (connectionId, providerName) => {
    setSyncing(connectionId);
    try {
      const response = await axiosInstance.post(`${API}/provider/sync/${connectionId}`);
      toast.success(response.data.message);
      fetchConnections();
      if (refreshUser) refreshUser();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Sync failed');
    } finally {
      setSyncing(null);
    }
  };

  const handleDisconnect = async (connectionId, providerName) => {
    if (!window.confirm(`Are you sure you want to disconnect from ${providerName}?`)) {
      return;
    }

    try {
      await axiosInstance.delete(`${API}/provider/disconnect/${connectionId}`);
      toast.success('Provider disconnected');
      fetchConnections();
    } catch (error) {
      toast.error('Failed to disconnect provider');
    }
  };

  const resetForm = () => {
    setFormData({
      provider_name: '',
      provider_type: '',
      account_number: '',
      customer_id: '',
      api_key: ''
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="provider-connection-manager">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Provider Connections</h3>
          <p className="text-gray-600 text-sm mt-1">Connect your utility providers to auto-fetch bills</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="connect-provider-btn">
              <Plus className="mr-2" size={16} />
              Connect Provider
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect Utility Provider</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Provider Type</Label>
                <Select value={formData.provider_type} onValueChange={(v) => handleChange('provider_type', v)} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(PROVIDER_TYPES).map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Provider Name</Label>
                <Input
                  value={formData.provider_name}
                  onChange={(e) => handleChange('provider_name', e.target.value)}
                  placeholder="e.g., ABC Energy"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Your Account Number</Label>
                <Input
                  value={formData.account_number}
                  onChange={(e) => handleChange('account_number', e.target.value)}
                  placeholder="Provider account number"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Customer ID (Optional)</Label>
                <Input
                  value={formData.customer_id}
                  onChange={(e) => handleChange('customer_id', e.target.value)}
                  placeholder="If provider uses customer ID"
                />
              </div>

              <div className="space-y-2">
                <Label>API Key (Optional)</Label>
                <Input
                  value={formData.api_key}
                  onChange={(e) => handleChange('api_key', e.target.value)}
                  placeholder="Provider API key if available"
                  type="password"
                />
                <p className="text-xs text-gray-600">
                  Some providers offer API access. Leave blank if not applicable.
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                  Connect
                </Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {connections.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {connections.map((conn) => {
            const typeInfo = PROVIDER_TYPES[conn.provider_type] || PROVIDER_TYPES['Electricity'];
            const Icon = typeInfo.icon;
            
            return (
              <Card key={conn.id} className="shadow-md hover:shadow-lg transition-shadow" data-testid={`provider-card-${conn.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 ${typeInfo.bg} rounded-lg flex items-center justify-center`}>
                        <Icon className={typeInfo.color} size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900">{conn.provider_name}</h4>
                        <p className="text-sm text-gray-600">{conn.provider_type}</p>
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center gap-1">
                      <CheckCircle size={12} />
                      Connected
                    </span>
                  </div>

                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Account:</span>
                      <span className="font-medium">{conn.account_number}</span>
                    </div>
                    {conn.customer_id && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Customer ID:</span>
                        <span className="font-medium">{conn.customer_id}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Last Sync:</span>
                      <span className="font-medium">{new Date(conn.last_sync).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleSync(conn.id, conn.provider_name)}
                      disabled={syncing === conn.id}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      size="sm"
                    >
                      {syncing === conn.id ? (
                        <>
                          <RefreshCw className="mr-2 animate-spin" size={14} />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2" size={14} />
                          Sync Bills
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleDisconnect(conn.id, conn.provider_name)}
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="shadow-md bg-gradient-to-br from-blue-50 to-emerald-50">
          <CardContent className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full mb-4">
              <Zap className="text-emerald-600" size={32} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Providers Connected</h3>
            <p className="text-gray-600 text-sm mb-6">
              Connect your utility providers to automatically fetch and manage your bills
            </p>
            <Button 
              onClick={() => setDialogOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="mr-2" size={16} />
              Connect Your First Provider
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>How it works:</strong> Connect your utility providers to automatically fetch your latest bills. Once connected, click "Sync Bills" to import your current bills into BillEasyPay.
        </p>
      </div>
    </div>
  );
};

export default ProviderConnectionManager;
