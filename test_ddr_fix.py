#!/usr/bin/env python3
"""
Quick test for DDR creation fix
"""

import requests
import json
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Configuration
BASE_URL = os.getenv('REACT_APP_BACKEND_URL', 'https://billmanager-7.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

# Test credentials
TEST_USER = {
    "email": "testuser@example.com",
    "password": "password123"
}

def test_ddr_creation():
    """Test DDR creation after fix"""
    session = requests.Session()
    
    # Login
    response = session.post(f"{API_BASE}/auth/login", json=TEST_USER)
    if response.status_code != 200:
        print(f"❌ Login failed: {response.status_code}")
        return False
    
    token = response.json().get("token")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test DDR creation
    ddr_data = {
        "bank_name": "Commonwealth Bank",
        "bsb": "062000",
        "account_number": "12345678",
        "account_holder_name": "Test User",
        "account_type": "savings",
        "provider": "Origin Energy",
        "provider_type": "Electricity",
        "provider_account_number": "ELE123456789",
        "payment_frequency": "monthly",
        "max_payment_amount": 500.00,
        "start_date": (datetime.now() + timedelta(days=7)).isoformat(),
        "signature": "Test User"
    }
    
    response = session.post(f"{API_BASE}/direct-debit/create", json=ddr_data, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ DDR Creation successful!")
        print(f"   Mandate ID: {data.get('id')}")
        print(f"   Mandate Reference: {data.get('mandate_reference')}")
        print(f"   BSB: {data.get('bsb')}")
        return True
    else:
        print(f"❌ DDR Creation failed: {response.status_code}")
        print(f"   Response: {response.text}")
        return False

if __name__ == "__main__":
    test_ddr_creation()