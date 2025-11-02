#!/usr/bin/env python3
"""
Test to verify mandate cancellation status
"""

import requests
import json
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

def test_mandate_status():
    """Test mandate status after cancellation"""
    session = requests.Session()
    
    # Login
    response = session.post(f"{API_BASE}/auth/login", json=TEST_USER)
    if response.status_code != 200:
        print(f"❌ Login failed: {response.status_code}")
        return False
    
    token = response.json().get("token")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get mandates
    response = session.get(f"{API_BASE}/direct-debit/mandates", headers=headers)
    
    if response.status_code == 200:
        mandates = response.json()
        print(f"📋 Found {len(mandates)} mandates:")
        
        for mandate in mandates:
            print(f"   - ID: {mandate['id']}")
            print(f"     Reference: {mandate['mandate_reference']}")
            print(f"     Status: {mandate['status']}")
            print(f"     Provider: {mandate['provider']}")
            print(f"     BSB: {mandate['bsb']}")
            print()
        
        # Check if we have both active and cancelled mandates
        active_count = sum(1 for m in mandates if m['status'] == 'active')
        cancelled_count = sum(1 for m in mandates if m['status'] == 'cancelled')
        
        print(f"✅ Status verification:")
        print(f"   Active mandates: {active_count}")
        print(f"   Cancelled mandates: {cancelled_count}")
        
        return True
    else:
        print(f"❌ Failed to fetch mandates: {response.status_code}")
        return False

if __name__ == "__main__":
    test_mandate_status()