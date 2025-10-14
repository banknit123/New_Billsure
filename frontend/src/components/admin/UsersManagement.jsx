import React, { useState, useEffect } from 'react';
import { axiosInstance, API } from '../../App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { User, Mail, Phone, Receipt, DollarSign } from 'lucide-react';

const UsersManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axiosInstance.get(`${API}/admin/users`);
      setUsers(response.data);
    } catch (error) {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="users-management">
      {/* Search */}
      <Card className="shadow-md">
        <CardContent className="p-6">
          <Input
            placeholder="Search users by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="user-search-input"
          />
        </CardContent>
      </Card>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map((user) => (
          <Card key={user.id} className="shadow-md hover:shadow-lg transition-shadow" data-testid={`user-card-${user.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg">
                    {user.full_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <CardTitle className="text-lg">{user.full_name}</CardTitle>
                  {user.is_admin && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-semibold">
                      Admin
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail size={16} className="text-gray-500" />
                  <span className="text-gray-700">{user.email}</span>
                </div>
                {user.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone size={16} className="text-gray-500" />
                    <span className="text-gray-700">{user.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Receipt size={16} className="text-gray-500" />
                  <span className="text-gray-700">{user.bill_count} bills</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign size={16} className="text-gray-500" />
                  <span className="text-gray-700">Wallet: ${user.wallet_balance.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <User size={16} className="text-gray-500" />
                  <span className="text-gray-700">Joined: {new Date(user.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                    user.subscription_active 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {user.subscription_active ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-sm text-gray-600">
                    ${user.subscription_fee.toFixed(2)}/month
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <Card className="shadow-md">
          <CardContent className="p-12 text-center">
            <User className="mx-auto mb-4 text-gray-400" size={64} />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Users Found</h3>
            <p className="text-gray-600">No users match your search criteria</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default UsersManagement;
