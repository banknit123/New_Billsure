"""
Test suite for BillsEasyPay Notifications and Export features (Iteration 4)
- Notification CRUD endpoints
- Admin CSV/PDF export endpoints
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "test@billseasypay.com"
TEST_USER_PASSWORD = "Test123!"
ADMIN_EMAIL = "admin@billseasypay.com"
ADMIN_PASSWORD = "Admin123!"


class TestAuth:
    """Authentication tests"""
    
    def test_user_login(self):
        """Test regular user login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        assert response.status_code == 200, f"User login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        print(f"✓ User login successful: {data['user']['email']}")
        return data["token"]
    
    def test_admin_login(self):
        """Test admin user login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"].get("is_admin") == True, "User is not admin"
        print(f"✓ Admin login successful: {data['user']['email']}")
        return data["token"]


class TestNotifications:
    """Notification system tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get user token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("User login failed")
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_notifications(self):
        """GET /api/notifications - returns user notifications with unread count"""
        response = requests.get(f"{BASE_URL}/api/notifications", headers=self.headers)
        assert response.status_code == 200, f"Get notifications failed: {response.text}"
        data = response.json()
        assert "notifications" in data, "Response missing 'notifications' key"
        assert "unread_count" in data, "Response missing 'unread_count' key"
        assert isinstance(data["notifications"], list)
        assert isinstance(data["unread_count"], int)
        print(f"✓ GET /api/notifications: {len(data['notifications'])} notifications, {data['unread_count']} unread")
        return data
    
    def test_mark_notification_read(self):
        """PUT /api/notifications/{id}/read - marks notification as read"""
        # First get notifications
        notifs_response = requests.get(f"{BASE_URL}/api/notifications", headers=self.headers)
        notifs = notifs_response.json().get("notifications", [])
        
        if not notifs:
            print("⚠ No notifications to mark as read - skipping")
            pytest.skip("No notifications available")
        
        # Find an unread notification or use first one
        notif_id = notifs[0]["id"]
        
        response = requests.put(f"{BASE_URL}/api/notifications/{notif_id}/read", headers=self.headers)
        assert response.status_code == 200, f"Mark read failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✓ PUT /api/notifications/{notif_id}/read: {data['message']}")
    
    def test_mark_all_notifications_read(self):
        """PUT /api/notifications/read-all - marks all as read"""
        response = requests.put(f"{BASE_URL}/api/notifications/read-all", headers=self.headers)
        assert response.status_code == 200, f"Mark all read failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✓ PUT /api/notifications/read-all: {data['message']}")
        
        # Verify all are read
        verify_response = requests.get(f"{BASE_URL}/api/notifications", headers=self.headers)
        verify_data = verify_response.json()
        assert verify_data["unread_count"] == 0, f"Expected 0 unread, got {verify_data['unread_count']}"
        print(f"✓ Verified: unread_count is now 0")
    
    def test_delete_notification(self):
        """DELETE /api/notifications/{id} - deletes notification"""
        # First get notifications
        notifs_response = requests.get(f"{BASE_URL}/api/notifications", headers=self.headers)
        notifs = notifs_response.json().get("notifications", [])
        
        if not notifs:
            print("⚠ No notifications to delete - skipping")
            pytest.skip("No notifications available")
        
        notif_id = notifs[0]["id"]
        initial_count = len(notifs)
        
        response = requests.delete(f"{BASE_URL}/api/notifications/{notif_id}", headers=self.headers)
        assert response.status_code == 200, f"Delete failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✓ DELETE /api/notifications/{notif_id}: {data['message']}")
        
        # Verify deletion
        verify_response = requests.get(f"{BASE_URL}/api/notifications", headers=self.headers)
        new_count = len(verify_response.json().get("notifications", []))
        assert new_count == initial_count - 1, f"Expected {initial_count - 1} notifications, got {new_count}"
        print(f"✓ Verified: notification count reduced from {initial_count} to {new_count}")


class TestAdminExports:
    """Admin export endpoints tests (CSV/PDF)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_export_outstanding_csv(self):
        """GET /api/admin/export/outstanding-csv - returns CSV file download"""
        response = requests.get(f"{BASE_URL}/api/admin/export/outstanding-csv", headers=self.headers)
        assert response.status_code == 200, f"Export outstanding CSV failed: {response.text}"
        
        # Check content type
        content_type = response.headers.get("content-type", "")
        assert "text/csv" in content_type, f"Expected text/csv, got {content_type}"
        
        # Check content disposition header
        content_disp = response.headers.get("content-disposition", "")
        assert "attachment" in content_disp, f"Expected attachment header, got {content_disp}"
        assert "outstanding_bills" in content_disp, f"Expected filename with 'outstanding_bills'"
        
        # Verify CSV content has headers
        content = response.text
        assert "Provider" in content, "CSV missing Provider column"
        assert "Category" in content, "CSV missing Category column"
        assert "Amount" in content, "CSV missing Amount column"
        print(f"✓ GET /api/admin/export/outstanding-csv: {len(content)} bytes, valid CSV")
    
    def test_export_customers_csv(self):
        """GET /api/admin/export/customers-csv - returns CSV file download"""
        response = requests.get(f"{BASE_URL}/api/admin/export/customers-csv", headers=self.headers)
        assert response.status_code == 200, f"Export customers CSV failed: {response.text}"
        
        content_type = response.headers.get("content-type", "")
        assert "text/csv" in content_type, f"Expected text/csv, got {content_type}"
        
        content_disp = response.headers.get("content-disposition", "")
        assert "attachment" in content_disp
        assert "customer_analytics" in content_disp
        
        content = response.text
        assert "Name" in content, "CSV missing Name column"
        assert "Email" in content, "CSV missing Email column"
        assert "Risk" in content, "CSV missing Risk column"
        print(f"✓ GET /api/admin/export/customers-csv: {len(content)} bytes, valid CSV")
    
    def test_export_outstanding_pdf(self):
        """GET /api/admin/export/outstanding-pdf - returns PDF file download"""
        response = requests.get(f"{BASE_URL}/api/admin/export/outstanding-pdf", headers=self.headers)
        assert response.status_code == 200, f"Export outstanding PDF failed: {response.text}"
        
        content_type = response.headers.get("content-type", "")
        assert "application/pdf" in content_type, f"Expected application/pdf, got {content_type}"
        
        content_disp = response.headers.get("content-disposition", "")
        assert "attachment" in content_disp
        assert "outstanding_bills" in content_disp
        assert ".pdf" in content_disp
        
        # Verify PDF magic bytes
        content = response.content
        assert content[:4] == b'%PDF', "Response is not a valid PDF file"
        print(f"✓ GET /api/admin/export/outstanding-pdf: {len(content)} bytes, valid PDF")
    
    def test_export_financial_pdf(self):
        """GET /api/admin/export/financial-pdf - returns PDF file download"""
        response = requests.get(f"{BASE_URL}/api/admin/export/financial-pdf", headers=self.headers)
        assert response.status_code == 200, f"Export financial PDF failed: {response.text}"
        
        content_type = response.headers.get("content-type", "")
        assert "application/pdf" in content_type, f"Expected application/pdf, got {content_type}"
        
        content_disp = response.headers.get("content-disposition", "")
        assert "attachment" in content_disp
        assert "financial_overview" in content_disp
        assert ".pdf" in content_disp
        
        content = response.content
        assert content[:4] == b'%PDF', "Response is not a valid PDF file"
        print(f"✓ GET /api/admin/export/financial-pdf: {len(content)} bytes, valid PDF")
    
    def test_export_requires_admin(self):
        """Verify export endpoints require admin access"""
        # Get regular user token
        user_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        user_token = user_response.json()["token"]
        user_headers = {"Authorization": f"Bearer {user_token}"}
        
        # Try to access admin export endpoints
        endpoints = [
            "/api/admin/export/outstanding-csv",
            "/api/admin/export/customers-csv",
            "/api/admin/export/outstanding-pdf",
            "/api/admin/export/financial-pdf"
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}", headers=user_headers)
            assert response.status_code == 403, f"Expected 403 for {endpoint}, got {response.status_code}"
        
        print(f"✓ All export endpoints correctly require admin access (403 for regular user)")


class TestExistingFeatures:
    """Verify existing features still work"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get tokens for authenticated requests"""
        # User token
        user_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if user_response.status_code != 200:
            pytest.skip("User login failed")
        self.user_token = user_response.json()["token"]
        self.user_headers = {"Authorization": f"Bearer {self.user_token}"}
        
        # Admin token
        admin_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if admin_response.status_code != 200:
            pytest.skip("Admin login failed")
        self.admin_token = admin_response.json()["token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_bills_crud(self):
        """Verify bills CRUD still works"""
        # GET bills
        response = requests.get(f"{BASE_URL}/api/bills", headers=self.user_headers)
        assert response.status_code == 200
        print(f"✓ GET /api/bills: {len(response.json())} bills")
    
    def test_payment_plan(self):
        """Verify payment plan endpoints work"""
        # GET current plan
        response = requests.get(f"{BASE_URL}/api/payment-plan/current", headers=self.user_headers)
        assert response.status_code == 200
        print(f"✓ GET /api/payment-plan/current: {response.json().get('status', 'active')}")
        
        # GET calculate
        response = requests.get(f"{BASE_URL}/api/payment-plan/calculate", headers=self.user_headers)
        assert response.status_code == 200
        data = response.json()
        assert "options" in data
        print(f"✓ GET /api/payment-plan/calculate: {len(data['options'])} options")
    
    def test_payment_methods(self):
        """Verify payment methods endpoints work"""
        response = requests.get(f"{BASE_URL}/api/payment-methods", headers=self.user_headers)
        assert response.status_code == 200
        print(f"✓ GET /api/payment-methods: {len(response.json())} methods")
    
    def test_dashboard_stats(self):
        """Verify dashboard stats endpoint works"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=self.user_headers)
        assert response.status_code == 200
        data = response.json()
        assert "wallet_balance" in data
        assert "total_bills" in data
        print(f"✓ GET /api/dashboard/stats: wallet=${data['wallet_balance']}, bills={data['total_bills']}")
    
    def test_admin_stats(self):
        """Verify admin stats endpoints work"""
        # Financial overview
        response = requests.get(f"{BASE_URL}/api/admin/financial-overview", headers=self.admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_users" in data
        print(f"✓ GET /api/admin/financial-overview: {data['total_users']} users")
        
        # Outstanding by period
        response = requests.get(f"{BASE_URL}/api/admin/outstanding-by-period", headers=self.admin_headers)
        assert response.status_code == 200
        print(f"✓ GET /api/admin/outstanding-by-period: OK")
        
        # Customer analytics
        response = requests.get(f"{BASE_URL}/api/admin/customer-analytics", headers=self.admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert "customers" in data
        print(f"✓ GET /api/admin/customer-analytics: {len(data['customers'])} customers")
    
    def test_transactions(self):
        """Verify transactions endpoint works"""
        response = requests.get(f"{BASE_URL}/api/transactions", headers=self.user_headers)
        assert response.status_code == 200
        print(f"✓ GET /api/transactions: {len(response.json())} transactions")
    
    def test_stripe_checkout_create(self):
        """Verify Stripe checkout creation works"""
        response = requests.post(f"{BASE_URL}/api/payments/create-checkout", 
            headers=self.user_headers,
            json={
                "package_id": "small",
                "origin_url": "https://pay-manager-stage.preview.emergentagent.com"
            })
        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        assert "stripe.com" in data["url"]
        print(f"✓ POST /api/payments/create-checkout: Stripe URL generated")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
