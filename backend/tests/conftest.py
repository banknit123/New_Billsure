"""Shared test configuration — loads credentials from environment."""
import os

API_URL = os.environ.get("TEST_API_URL", "http://localhost:8001/api")

TEST_USER_EMAIL = os.environ.get("TEST_USER_EMAIL", "test@billseasypay.com")
TEST_USER_PASSWORD = os.environ.get("TEST_USER_PASSWORD", "Test123!")

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@billseasypay.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin123!")

BASIC_USER_EMAIL = os.environ.get("BASIC_USER_EMAIL", "basicuser@test.com")
BASIC_USER_PASSWORD = os.environ.get("BASIC_USER_PASSWORD", "Test123!")

CUSTOMER = {"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
ADMIN = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
