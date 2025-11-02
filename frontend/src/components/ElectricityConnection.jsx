import React, { useState, useEffect } from 'react';
import { axiosInstance, API } from '../App';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Zap, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

const ElectricityConnection = ({ user, refreshUser }) => {
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const response = await axiosInstance.get(`${API}/electricity/connection-status`);
      setConnection(response.data);
    } catch (error) {
      console.error('Error checking connection:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setSyncing(true);
    try {
      const response = await axiosInstance.get(`${API}/electricity/connect-test`);
      
      if (response.data.connected) {
        toast.success('Successfully connected to OpenElectricity API!');
      } else {
        toast.error('Connection failed: ' + response.data.message);
      }
    } catch (error) {
      toast.error('Connection test failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSyncing(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await axiosInstance.post(`${API}/electricity/sync-account`);
      toast.success('Electricity account synced successfully!');
      await checkConnection();
    } catch (error) {
      toast.error('Sync failed: ' + (error.response?.data?.detail || 'Please try again'));
    } finally {
      setSyncing(false);
    }
  };

  const handleFetchBills = async () => {
    setSyncing(true);
    try {
      const response = await axiosInstance.get(`${API}/electricity/fetch-bills`);
      toast.success(`Fetched electricity bills successfully! Created ${response.data.bills_created} bills.`);
      if (refreshUser) refreshUser();
    } catch (error) {
      toast.error('Failed to fetch bills: ' + (error.response?.data?.detail || 'Please try again'));
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <Card className="shadow-md" data-testid="electricity-connection">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center">
            <Zap className="text-yellow-600" size={24} />
          </div>
          <div>
            <CardTitle>Electricity Provider Connection</CardTitle>
            <CardDescription>Connect to OpenElectricity to auto-fetch bills</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {connection && connection.connected ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="text-green-600" size={20} />
                <span className="font-semibold text-green-900">Connected to {connection.provider}</span>
              </div>
              <div className="text-sm text-green-700 space-y-1">
                <p>• Connected: {new Date(connection.connected_at).toLocaleDateString()}</p>
                <p>• Last sync: {new Date(connection.last_sync).toLocaleString()}</p>
                <p>• Status: {connection.status}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleFetchBills}
                disabled={syncing}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                data-testid="fetch-bills-btn"
              >
                {syncing ? (
                  <>
                    <RefreshCw className="mr-2 animate-spin" size={16} />
                    Fetching...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2" size={16} />
                    Fetch Latest Bills
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="text-blue-600 mt-0.5" size={20} />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-2">Connect Your Electricity Account</p>
                  <p>Automatically fetch your electricity bills from OpenElectricity API.</p>
                  <ul className="mt-2 space-y-1 list-disc list-inside text-blue-800">
                    <li>No manual entry required</li>
                    <li>Always up-to-date bill information</li>
                    <li>Secure API connection</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleTestConnection}
                disabled={syncing}
                variant="outline"
                className="flex-1"
                data-testid="test-connection-btn"
              >
                {syncing ? 'Testing...' : 'Test Connection'}
              </Button>
              <Button 
                onClick={handleSync}
                disabled={syncing}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                data-testid="sync-account-btn"
              >
                {syncing ? (
                  <>
                    <RefreshCw className="mr-2 animate-spin" size={16} />
                    Syncing...
                  </>
                ) : (
                  'Connect Account'
                )}
              </Button>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-900">
                <strong>Note:</strong> The API key is pre-configured. Click "Connect Account" to sync your electricity provider.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ElectricityConnection;
