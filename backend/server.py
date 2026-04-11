from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
import requests
import base64
import re
import io
import httpx
import pytesseract
from PIL import Image
from pdf2image import convert_from_bytes

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
SECRET_KEY = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Helper functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: timedelta = timedelta(days=7)):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_token(token)
    user_id = payload.get("user_id")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# Models
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    wallet_balance: float = 0.0
    subscription_active: bool = True
    subscription_fee: float = 5.0
    is_admin: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class Bill(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    category: str  # Electricity, Water, Council, Mobile, Internet, School Fees, Tuition Fees
    provider: str
    account_number: str
    bpay_code: Optional[str] = None
    amount: float
    due_date: str  # ISO date string
    frequency: str  # monthly, quarterly, yearly
    status: str = "pending"  # pending, paid, overdue
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class BillCreate(BaseModel):
    category: str
    provider: str
    account_number: str
    bpay_code: Optional[str] = None
    amount: float
    due_date: str
    frequency: str = "monthly"

class BankDetails(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    account_holder_name: str
    bank_name: str
    account_number: str  # Encrypted in production
    routing_number: str
    account_type: str  # checking, savings
    is_primary: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class BankDetailsCreate(BaseModel):
    account_holder_name: str
    bank_name: str
    account_number: str
    routing_number: str
    account_type: str = "checking"

class PaymentStructure(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    payment_frequency: str  # weekly, fortnightly, monthly
    total_yearly_bills: float
    total_monthly_bills: float
    contribution_amount: float
    next_deduction_date: str
    auto_deduct_enabled: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PaymentStructureCreate(BaseModel):
    payment_frequency: str
    auto_deduct_enabled: bool = True

class BillUpload(BaseModel):
    file_data: str  # Base64 encoded file
    file_name: str
    file_type: str  # image/jpeg, image/png, application/pdf

class ParsedBillData(BaseModel):
    category: Optional[str] = None
    provider: Optional[str] = None
    account_number: Optional[str] = None
    amount: Optional[float] = None
    due_date: Optional[str] = None
    extracted_text: str

class DirectDebitRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    mandate_reference: str  # Unique DDR reference
    bank_name: str
    bsb: str  # Australian Bank State Branch code
    account_number: str
    account_holder_name: str
    account_type: str  # savings, cheque
    provider: str  # Utility provider name
    provider_type: str  # Electricity, Water, Gas, etc.
    provider_account_number: str
    payment_frequency: str  # weekly, fortnightly, monthly
    max_payment_amount: float
    start_date: str
    status: str = "active"  # active, cancelled, suspended
    authorization_date: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    signature: str  # Digital signature (user's name as consent)
    terms_accepted: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class DirectDebitRequestCreate(BaseModel):
    bank_name: str
    bsb: str
    account_number: str
    account_holder_name: str
    account_type: str
    provider: str
    provider_type: str
    provider_account_number: str
    payment_frequency: str
    max_payment_amount: float
    start_date: str
    signature: str

class ProviderConnection(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    provider_name: str
    provider_type: str  # Electricity, Water, Gas, Internet, Mobile
    api_endpoint: Optional[str] = None
    account_number: str
    customer_id: Optional[str] = None
    api_key: Optional[str] = None  # User's provider API key
    status: str = "connected"  # connected, disconnected, error
    last_sync: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ProviderConnectionCreate(BaseModel):
    provider_name: str
    provider_type: str
    account_number: str
    customer_id: Optional[str] = None
    api_key: Optional[str] = None

class Transaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    type: str  # deposit, bill_payment, subscription_fee
    amount: float
    description: str
    status: str = "completed"  # completed, pending, failed
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class MockPayment(BaseModel):
    amount: float
    payment_method: str = "card"

class PaymentMethod(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    type: str  # bank_account, credit_card, debit_card
    label: str  # "Commonwealth Bank Savings", "Visa ending 4242"
    bank_name: Optional[str] = None
    bsb: Optional[str] = None
    account_number_masked: Optional[str] = None
    card_last4: Optional[str] = None
    card_brand: Optional[str] = None
    is_primary: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PaymentMethodCreate(BaseModel):
    type: str
    label: str
    bank_name: Optional[str] = None
    bsb: Optional[str] = None
    account_number: Optional[str] = None
    card_number: Optional[str] = None
    card_brand: Optional[str] = None
    is_primary: bool = False

# Routes
@api_router.get("/")
async def root():
    return {"message": "BillEasyPay API is running"}

# Auth routes
@api_router.post("/auth/register")
async def register(user_data: UserRegister):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    hashed_password = hash_password(user_data.password)
    user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        phone=user_data.phone
    )
    user_dict = user.model_dump()
    user_dict["password"] = hashed_password
    
    await db.users.insert_one(user_dict)
    
    # Create token
    token = create_access_token({"user_id": user.id, "email": user.email})
    
    return {"token": token, "user": user}

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user.get("password", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_access_token({"user_id": user["id"], "email": user["email"]})
    user.pop("password", None)
    
    return {"token": token, "user": user}

@api_router.get("/auth/me", response_model=User)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    return current_user

# Bill routes
@api_router.post("/bills", response_model=Bill)
async def create_bill(bill_data: BillCreate, current_user: dict = Depends(get_current_user)):
    bill = Bill(
        user_id=current_user["id"],
        **bill_data.model_dump()
    )
    bill_dict = bill.model_dump()
    await db.bills.insert_one(bill_dict)
    return bill

@api_router.get("/bills", response_model=List[Bill])
async def get_bills(current_user: dict = Depends(get_current_user)):
    bills = await db.bills.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    return bills

@api_router.get("/bills/{bill_id}", response_model=Bill)
async def get_bill(bill_id: str, current_user: dict = Depends(get_current_user)):
    bill = await db.bills.find_one({"id": bill_id, "user_id": current_user["id"]}, {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return bill

@api_router.put("/bills/{bill_id}", response_model=Bill)
async def update_bill(bill_id: str, bill_data: BillCreate, current_user: dict = Depends(get_current_user)):
    result = await db.bills.update_one(
        {"id": bill_id, "user_id": current_user["id"]},
        {"$set": bill_data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    updated_bill = await db.bills.find_one({"id": bill_id}, {"_id": 0})
    return updated_bill

@api_router.delete("/bills/{bill_id}")
async def delete_bill(bill_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.bills.delete_one({"id": bill_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bill not found")
    return {"message": "Bill deleted successfully"}

# Payment structure routes
@api_router.post("/payment-structure", response_model=PaymentStructure)
async def create_payment_structure(data: PaymentStructureCreate, current_user: dict = Depends(get_current_user)):
    # Get all bills for the user
    bills = await db.bills.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    
    # Calculate total yearly bills based on frequency
    total_yearly = 0
    for bill in bills:
        if bill["frequency"] == "monthly":
            total_yearly += bill["amount"] * 12
        elif bill["frequency"] == "quarterly":
            total_yearly += bill["amount"] * 4
        elif bill["frequency"] == "yearly":
            total_yearly += bill["amount"]
    
    total_monthly = total_yearly / 12
    
    # Calculate contribution amount based on payment frequency
    if data.payment_frequency == "weekly":
        contribution = total_yearly / 52  # 52 weeks in a year
        days_until_next = 7
    elif data.payment_frequency == "fortnightly":
        contribution = total_yearly / 26  # 26 fortnights in a year
        days_until_next = 14
    else:  # monthly
        contribution = total_yearly / 12  # 12 months
        days_until_next = 30
    
    next_deduction = (datetime.now(timezone.utc) + timedelta(days=days_until_next)).isoformat()
    
    payment_structure = PaymentStructure(
        user_id=current_user["id"],
        payment_frequency=data.payment_frequency,
        total_yearly_bills=total_yearly,
        total_monthly_bills=total_monthly,
        contribution_amount=contribution,
        next_deduction_date=next_deduction,
        auto_deduct_enabled=data.auto_deduct_enabled
    )
    
    # Delete existing structure
    await db.payment_structures.delete_many({"user_id": current_user["id"]})
    
    # Create new structure
    await db.payment_structures.insert_one(payment_structure.model_dump())
    
    return payment_structure

@api_router.get("/payment-structure", response_model=PaymentStructure)
async def get_payment_structure(current_user: dict = Depends(get_current_user)):
    structure = await db.payment_structures.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not structure:
        raise HTTPException(status_code=404, detail="Payment structure not set up")
    return structure

@api_router.put("/payment-structure/toggle-auto-deduct")
async def toggle_auto_deduct(current_user: dict = Depends(get_current_user)):
    structure = await db.payment_structures.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not structure:
        raise HTTPException(status_code=404, detail="Payment structure not set up")
    
    new_status = not structure.get("auto_deduct_enabled", True)
    await db.payment_structures.update_one(
        {"user_id": current_user["id"]},
        {"$set": {"auto_deduct_enabled": new_status}}
    )
    
    return {"auto_deduct_enabled": new_status, "message": f"Auto-deduction {'enabled' if new_status else 'disabled'}"}

# Bank Details routes
@api_router.post("/bank-details", response_model=BankDetails)
async def add_bank_details(bank_data: BankDetailsCreate, current_user: dict = Depends(get_current_user)):
    # In production, encrypt account_number and routing_number
    bank_details = BankDetails(
        user_id=current_user["id"],
        **bank_data.model_dump()
    )
    
    # Set other bank accounts as non-primary if this is primary
    if bank_details.is_primary:
        await db.bank_details.update_many(
            {"user_id": current_user["id"]},
            {"$set": {"is_primary": False}}
        )
    
    await db.bank_details.insert_one(bank_details.model_dump())
    return bank_details

@api_router.get("/bank-details", response_model=List[BankDetails])
async def get_bank_details(current_user: dict = Depends(get_current_user)):
    bank_accounts = await db.bank_details.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    # Mask account numbers for security (show only last 4 digits)
    for account in bank_accounts:
        account["account_number"] = "****" + account["account_number"][-4:]
        account["routing_number"] = "****" + account["routing_number"][-4:]
    return bank_accounts

@api_router.delete("/bank-details/{bank_id}")
async def delete_bank_details(bank_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.bank_details.delete_one({"id": bank_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bank account not found")
    return {"message": "Bank account deleted successfully"}

# Bill Upload and Parsing route
@api_router.post("/bills/upload-and-parse")
async def upload_and_parse_bill(current_user: dict = Depends(get_current_user)):
    # This endpoint will receive the parsed data from frontend (Tesseract runs client-side)
    # Frontend will send extracted text and we'll parse it here
    return {"message": "Bill parsing handled on client-side with Tesseract.js"}

@api_router.post("/bills/save-parsed")
async def save_parsed_bill(bill_data: BillCreate, current_user: dict = Depends(get_current_user)):
    # Save bill from parsed data
    bill = Bill(
        user_id=current_user["id"],
        **bill_data.model_dump()
    )
    bill_dict = bill.model_dump()
    await db.bills.insert_one(bill_dict)
    return bill

# Automatic bill payment scheduler (simulated)
@api_router.post("/bills/process-auto-payments")
async def process_auto_payments(current_user: dict = Depends(get_current_user)):
    """
    Process automatic bill payments for bills due within next 3 days
    In production, this would be a scheduled job (cron/celery)
    """
    # Get pending bills due within next 3 days
    today = datetime.now(timezone.utc)
    three_days_later = today + timedelta(days=3)
    
    bills = await db.bills.find({"user_id": current_user["id"], "status": "pending"}, {"_id": 0}).to_list(1000)
    
    paid_bills = []
    failed_bills = []
    
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    
    for bill in bills:
        bill_due_date = datetime.fromisoformat(bill["due_date"].replace('Z', '+00:00'))
        
        if bill_due_date <= three_days_later:
            # Check wallet balance
            if user["wallet_balance"] >= bill["amount"]:
                # Create transaction
                transaction = Transaction(
                    user_id=current_user["id"],
                    type="bill_payment",
                    amount=bill["amount"],
                    description=f"Auto-payment for {bill['category']} - {bill['provider']}"
                )
                await db.transactions.insert_one(transaction.model_dump())
                
                # Update wallet balance
                await db.users.update_one(
                    {"id": current_user["id"]},
                    {"$inc": {"wallet_balance": -bill["amount"]}}
                )
                
                # Update bill status
                await db.bills.update_one(
                    {"id": bill["id"]},
                    {"$set": {"status": "paid"}}
                )
                
                paid_bills.append(bill)
                user["wallet_balance"] -= bill["amount"]
            else:
                failed_bills.append(bill)
    
    return {
        "paid_count": len(paid_bills),
        "failed_count": len(failed_bills),
        "paid_bills": paid_bills,
        "failed_bills": failed_bills,
        "message": f"Processed {len(paid_bills)} bills successfully, {len(failed_bills)} failed due to insufficient balance"
    }

# Transaction routes
@api_router.post("/transactions/deposit")
async def deposit_to_wallet(payment: MockPayment, current_user: dict = Depends(get_current_user)):
    # Mock payment - in production, integrate with Stripe/PayPal
    transaction = Transaction(
        user_id=current_user["id"],
        type="deposit",
        amount=payment.amount,
        description=f"Deposit via {payment.payment_method}"
    )
    await db.transactions.insert_one(transaction.model_dump())
    
    # Update wallet balance
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$inc": {"wallet_balance": payment.amount}}
    )
    
    return {"message": "Deposit successful", "transaction": transaction}

@api_router.post("/transactions/pay-bill/{bill_id}")
async def pay_bill(bill_id: str, current_user: dict = Depends(get_current_user)):
    # Get bill
    bill = await db.bills.find_one({"id": bill_id, "user_id": current_user["id"]}, {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    if bill["status"] == "paid":
        raise HTTPException(status_code=400, detail="Bill already paid")
    
    # Check wallet balance
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    if user["wallet_balance"] < bill["amount"]:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance")
    
    # Create transaction
    transaction = Transaction(
        user_id=current_user["id"],
        type="bill_payment",
        amount=bill["amount"],
        description=f"Payment for {bill['category']} - {bill['provider']}"
    )
    await db.transactions.insert_one(transaction.model_dump())
    
    # Update wallet balance
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$inc": {"wallet_balance": -bill["amount"]}}
    )
    
    # Update bill status
    await db.bills.update_one(
        {"id": bill_id},
        {"$set": {"status": "paid"}}
    )
    
    return {"message": "Bill paid successfully", "transaction": transaction}

@api_router.get("/transactions", response_model=List[Transaction])
async def get_transactions(current_user: dict = Depends(get_current_user)):
    transactions = await db.transactions.find({"user_id": current_user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return transactions

# Dashboard stats
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    bills = await db.bills.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    transactions = await db.transactions.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    
    total_bills = len(bills)
    pending_bills = len([b for b in bills if b["status"] == "pending"])
    paid_bills = len([b for b in bills if b["status"] == "paid"])
    total_bill_amount = sum(b["amount"] for b in bills if b["status"] == "pending")
    
    # Calculate yearly prediction
    total_yearly_prediction = 0
    for bill in bills:
        if bill["frequency"] == "monthly":
            total_yearly_prediction += bill["amount"] * 12
        elif bill["frequency"] == "quarterly":
            total_yearly_prediction += bill["amount"] * 4
        elif bill["frequency"] == "yearly":
            total_yearly_prediction += bill["amount"]
    
    # Get bills due soon (next 7 days)
    today = datetime.now(timezone.utc)
    seven_days_later = today + timedelta(days=7)
    bills_due_soon = []
    
    for bill in bills:
        if bill["status"] == "pending":
            try:
                bill_due_date = datetime.fromisoformat(bill["due_date"].replace('Z', '+00:00'))
                if bill_due_date.tzinfo is None:
                    bill_due_date = bill_due_date.replace(tzinfo=timezone.utc)
                if bill_due_date <= seven_days_later:
                    bills_due_soon.append(bill)
            except Exception as e:
                print(f"Error parsing date for bill {bill.get('id')}: {e}")
    
    return {
        "wallet_balance": current_user["wallet_balance"],
        "total_bills": total_bills,
        "pending_bills": pending_bills,
        "paid_bills": paid_bills,
        "total_bill_amount": total_bill_amount,
        "total_yearly_prediction": total_yearly_prediction,
        "bills_due_soon": len(bills_due_soon),
        "bills_due_soon_list": bills_due_soon,
        "recent_transactions": transactions[:5]
    }

# Accurassi API Integration
ACCURASSI_CLIENT_CODE = os.environ.get('ACCURASSI_CLIENT_CODE', '')
ACCURASSI_CLIENT_ID = os.environ.get('ACCURASSI_CLIENT_ID', '')
ACCURASSI_BASE_URL = "https://api.accurassi.com/v4"


def parse_bill_text_server(text: str) -> dict:
    """Advanced server-side bill text parsing with improved regex patterns"""
    parsed = {}
    text_lower = text.lower()
    lines = text.split('\n')

    # --- Amount extraction (priority order) ---
    amount_patterns = [
        r'(?:total\s*(?:amount\s*)?due|amount\s*due|balance\s*due|total\s*payable|amount\s*payable|pay\s*this\s*amount)[:\s]*\$?\s*([\d,]+\.?\d{0,2})',
        r'(?:total\s*charges?|total\s*new\s*charges?|new\s*charges?)[:\s]*\$?\s*([\d,]+\.?\d{0,2})',
        r'(?:please\s*pay)[:\s]*\$?\s*([\d,]+\.?\d{0,2})',
        r'(?:amount\s*owing|owing)[:\s]*\$?\s*([\d,]+\.?\d{0,2})',
    ]
    for pattern in amount_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            val = float(match.group(1).replace(',', ''))
            if 1 < val < 50000:
                parsed['amount'] = val
                break

    if 'amount' not in parsed:
        dollar_matches = re.findall(r'\$\s*([\d,]+\.\d{2})', text)
        amounts = [float(m.replace(',', '')) for m in dollar_matches if 5 < float(m.replace(',', '')) < 50000]
        if amounts:
            parsed['amount'] = max(amounts)

    # --- Due date extraction ---
    date_patterns = [
        r'(?:due\s*(?:date|by)?|pay\s*(?:by|before|on)|payment\s*due)[:\s]*(\d{1,2}[\s/\-\.]+\w{3,9}[\s/\-\.]+\d{2,4})',
        r'(?:due\s*(?:date|by)?|pay\s*(?:by|before|on)|payment\s*due)[:\s]*(\d{1,2}[\s/\-\.]+\d{1,2}[\s/\-\.]+\d{2,4})',
        r'(?:due\s*(?:date|by)?|pay\s*(?:by|before|on))[:\s]*(\w{3,9}\s+\d{1,2},?\s*\d{4})',
    ]
    for pattern in date_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            raw_date = match.group(1).strip()
            parsed_date = _try_parse_date(raw_date)
            if parsed_date:
                parsed['due_date'] = parsed_date
                break

    # --- Account number extraction ---
    account_patterns = [
        r'(?:account\s*(?:no\.?|number|#|num))[:\s]*([A-Z0-9\-]{5,20})',
        r'(?:acct\.?\s*(?:no\.?|#)?)[:\s]*([A-Z0-9\-]{5,20})',
        r'(?:customer\s*(?:no\.?|number|ref|reference|#))[:\s]*([A-Z0-9\-]{5,20})',
        r'(?:reference\s*(?:no\.?|number|#)?)[:\s]*([A-Z0-9\-]{5,20})',
    ]
    for pattern in account_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            parsed['account_number'] = match.group(1).strip()
            break

    # --- Provider detection ---
    known_providers = {
        'agl': 'AGL', 'origin': 'Origin Energy', 'energyaustralia': 'EnergyAustralia',
        'synergy': 'Synergy', 'alinta': 'Alinta Energy', 'simply energy': 'Simply Energy',
        'momentum': 'Momentum Energy', 'powershop': 'Powershop', 'red energy': 'Red Energy',
        'lumo': 'Lumo Energy', 'ergon': 'Ergon Energy', 'ausgrid': 'Ausgrid',
        'sydney water': 'Sydney Water', 'sa water': 'SA Water', 'yarra valley': 'Yarra Valley Water',
        'south east water': 'South East Water', 'telstra': 'Telstra', 'optus': 'Optus',
        'vodafone': 'Vodafone', 'tpg': 'TPG', 'nbn': 'NBN Co', 'dodo': 'Dodo',
        'iinet': 'iiNet', 'belong': 'Belong', 'aussie broadband': 'Aussie Broadband',
    }
    for key, name in known_providers.items():
        if key in text_lower:
            parsed['provider'] = name
            break

    if 'provider' not in parsed:
        for line in lines[:8]:
            clean = line.strip()
            if len(clean) > 3 and re.match(r'^[A-Za-z]', clean) and not re.match(r'^\d+$', clean):
                if not re.search(r'(tax\s*invoice|bill|statement|page|date|account)', clean, re.IGNORECASE):
                    parsed['provider'] = clean[:60]
                    break

    # --- Category detection ---
    category_keywords = {
        'Electricity': ['electric', 'power', 'kwh', 'kilowatt', 'energy charge', 'supply charge', 'tariff'],
        'Water': ['water', 'sewerage', 'drainage', 'water usage', 'water supply'],
        'Gas': ['gas', 'natural gas', 'gas usage', 'gas supply', 'mj ', 'megajoule'],
        'Internet': ['internet', 'broadband', 'nbn', 'wifi', 'data plan', 'download'],
        'Mobile': ['mobile', 'phone', 'call', 'sms', 'data', 'handset', 'sim'],
        'Council': ['council', 'rates', 'municipal', 'shire', 'city of'],
        'Insurance': ['insurance', 'premium', 'policy', 'cover', 'insurer'],
    }
    for category, keywords in category_keywords.items():
        if any(kw in text_lower for kw in keywords):
            parsed['category'] = category
            break

    # --- BPAY code extraction ---
    bpay_match = re.search(r'(?:bpay|biller)\s*(?:code|ref)?[:\s]*(\d{4,8})', text, re.IGNORECASE)
    if bpay_match:
        parsed['bpay_code'] = bpay_match.group(1)

    # --- Frequency detection ---
    if any(w in text_lower for w in ['quarterly', 'quarter', '3 month', 'every 3']):
        parsed['frequency'] = 'quarterly'
    elif any(w in text_lower for w in ['annual', 'yearly', '12 month']):
        parsed['frequency'] = 'yearly'
    else:
        parsed['frequency'] = 'monthly'

    return parsed


def _try_parse_date(raw: str) -> Optional[str]:
    """Try to parse various date formats into YYYY-MM-DD"""
    from datetime import datetime as dt
    formats = [
        '%d/%m/%Y', '%d-%m-%Y', '%d.%m.%Y',
        '%d/%m/%y', '%d-%m-%y',
        '%d %B %Y', '%d %b %Y',
        '%B %d, %Y', '%b %d, %Y',
        '%d %B, %Y', '%d %b, %Y',
        '%m/%d/%Y', '%m-%d-%Y',
    ]
    cleaned = re.sub(r'\s+', ' ', raw.strip())
    for fmt in formats:
        try:
            parsed = dt.strptime(cleaned, fmt)
            return parsed.strftime('%Y-%m-%d')
        except ValueError:
            continue
    return None


@api_router.post("/bills/extract")
async def extract_bill_data(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Extract bill data from an uploaded file (image or PDF).
    Uses Accurassi API for PDF electricity bills when credentials are available,
    falls back to server-side OCR for all other cases.
    """
    file_content = await file.read()
    file_type = file.content_type or ''

    extracted_text = ""
    extraction_method = "ocr"

    try:
        # For PDFs: try Accurassi API first if credentials exist
        if 'pdf' in file_type and ACCURASSI_CLIENT_CODE and ACCURASSI_CLIENT_ID:
            try:
                b64_content = base64.b64encode(file_content).decode('utf-8')
                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await client.post(
                        f"{ACCURASSI_BASE_URL}/extraction",
                        headers={
                            "clientCode": ACCURASSI_CLIENT_CODE,
                            "clientID": ACCURASSI_CLIENT_ID,
                            "Content-Type": "application/json"
                        },
                        json={"ebillBase64": b64_content}
                    )
                    if resp.status_code == 200:
                        accurassi_data = resp.json()
                        accurassi_used = True
                        extraction_method = "accurassi"
                        parsed = {
                            "category": "Electricity",
                            "provider": accurassi_data.get("retailer", ""),
                            "account_number": accurassi_data.get("accountNumber", ""),
                            "amount": accurassi_data.get("totalDue", accurassi_data.get("estimatedAnnualCost", 0)),
                            "due_date": accurassi_data.get("dueDate", ""),
                            "frequency": "quarterly",
                            "bpay_code": accurassi_data.get("bpayCode", ""),
                            "extracted_text": f"Accurassi extraction: annual consumption {accurassi_data.get('estimatedAnnualConsumption', 'N/A')} kWh",
                            "extraction_method": "accurassi"
                        }
                        return parsed
            except Exception as e:
                logger.warning(f"Accurassi API call failed, falling back to OCR: {e}")

        # OCR fallback for images and PDFs
        if 'pdf' in file_type:
            images = convert_from_bytes(file_content, dpi=300)
            texts = []
            for img in images:
                text = pytesseract.image_to_string(img, config='--oem 3 --psm 6')
                texts.append(text)
            extracted_text = '\n'.join(texts)
        else:
            img = Image.open(io.BytesIO(file_content))
            img = img.convert('L')  # Grayscale for better OCR
            extracted_text = pytesseract.image_to_string(img, config='--oem 3 --psm 6')

        if not extracted_text or len(extracted_text.strip()) < 10:
            raise HTTPException(status_code=400, detail="Could not extract text from the file. Please try a clearer image.")

        parsed = parse_bill_text_server(extracted_text)
        parsed['extracted_text'] = extracted_text[:2000]
        parsed['extraction_method'] = extraction_method

        return parsed

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bill extraction error: {e}")
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@api_router.get("/accurassi/status")
async def get_accurassi_status(current_user: dict = Depends(get_current_user)):
    """Check Accurassi API integration status"""
    has_credentials = bool(ACCURASSI_CLIENT_CODE and ACCURASSI_CLIENT_ID)
    return {
        "configured": has_credentials,
        "ocr_available": True,
        "message": "Accurassi API connected" if has_credentials else "Using OCR extraction (configure Accurassi credentials for enhanced PDF extraction)"
    }

# Direct Debit Request (DDR) Routes
@api_router.post("/direct-debit/create", response_model=DirectDebitRequest)
async def create_direct_debit_request(ddr_data: DirectDebitRequestCreate, current_user: dict = Depends(get_current_user)):
    """Create a new Direct Debit Request mandate"""
    
    # Validate BSB (Australian format: XXX-XXX)
    bsb_clean = ddr_data.bsb.replace("-", "").replace(" ", "")
    if len(bsb_clean) != 6 or not bsb_clean.isdigit():
        raise HTTPException(status_code=400, detail="Invalid BSB format. Must be 6 digits (XXX-XXX)")
    
    # Generate unique mandate reference
    mandate_ref = f"DDR-{uuid.uuid4().hex[:8].upper()}"
    
    # Create DDR data with formatted BSB
    ddr_dict = ddr_data.model_dump()
    ddr_dict["bsb"] = bsb_clean[:3] + "-" + bsb_clean[3:]  # Format as XXX-XXX
    
    ddr = DirectDebitRequest(
        user_id=current_user["id"],
        mandate_reference=mandate_ref,
        **ddr_dict
    )
    
    await db.direct_debit_requests.insert_one(ddr.model_dump())
    
    return ddr

@api_router.get("/direct-debit/mandates", response_model=List[DirectDebitRequest])
async def get_direct_debit_mandates(current_user: dict = Depends(get_current_user)):
    """Get all DDR mandates for the current user"""
    mandates = await db.direct_debit_requests.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    return mandates

@api_router.get("/direct-debit/mandate/{mandate_id}", response_model=DirectDebitRequest)
async def get_direct_debit_mandate(mandate_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific DDR mandate"""
    mandate = await db.direct_debit_requests.find_one({"id": mandate_id, "user_id": current_user["id"]}, {"_id": 0})
    if not mandate:
        raise HTTPException(status_code=404, detail="Mandate not found")
    return mandate

@api_router.put("/direct-debit/mandate/{mandate_id}/cancel")
async def cancel_direct_debit_mandate(mandate_id: str, current_user: dict = Depends(get_current_user)):
    """Cancel a DDR mandate"""
    result = await db.direct_debit_requests.update_one(
        {"id": mandate_id, "user_id": current_user["id"]},
        {"$set": {"status": "cancelled"}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Mandate not found")
    
    return {"message": "Direct Debit mandate cancelled successfully", "mandate_id": mandate_id}

@api_router.post("/direct-debit/validate-bsb")
async def validate_bsb(bsb: str):
    """Validate Australian BSB number"""
    bsb_clean = bsb.replace("-", "").replace(" ", "")
    
    if len(bsb_clean) != 6 or not bsb_clean.isdigit():
        return {"valid": False, "message": "BSB must be 6 digits"}
    
    # Basic BSB validation (in production, use a BSB lookup service)
    # First 2 digits indicate bank: 01-12 = major banks
    bank_code = int(bsb_clean[:2])
    
    bank_names = {
        "01": "ANZ",
        "06": "Commonwealth Bank",
        "08": "NAB",
        "11": "Westpac",
        "03": "Bendigo Bank",
        "09": "Reserve Bank",
        "73": "Bank of Queensland"
    }
    
    bank_name = bank_names.get(bsb_clean[:2], "Other Bank")
    
    return {
        "valid": True,
        "formatted": bsb_clean[:3] + "-" + bsb_clean[3:],
        "bank_name": bank_name,
        "message": "Valid BSB"
    }

# Provider Connection Routes
@api_router.post("/provider/connect", response_model=ProviderConnection)
async def connect_provider(provider_data: ProviderConnectionCreate, current_user: dict = Depends(get_current_user)):
    """Connect to a utility provider"""
    
    provider = ProviderConnection(
        user_id=current_user["id"],
        **provider_data.model_dump()
    )
    
    # Check if connection already exists
    existing = await db.provider_connections.find_one({
        "user_id": current_user["id"],
        "provider_name": provider_data.provider_name,
        "account_number": provider_data.account_number
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Provider already connected")
    
    await db.provider_connections.insert_one(provider.model_dump())
    
    return provider

@api_router.get("/provider/connections", response_model=List[ProviderConnection])
async def get_provider_connections(current_user: dict = Depends(get_current_user)):
    """Get all provider connections for the user"""
    connections = await db.provider_connections.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    return connections

@api_router.post("/provider/sync/{connection_id}")
async def sync_provider_bills(connection_id: str, current_user: dict = Depends(get_current_user)):
    """Sync bills from a connected provider"""
    
    connection = await db.provider_connections.find_one({"id": connection_id, "user_id": current_user["id"]}, {"_id": 0})
    
    if not connection:
        raise HTTPException(status_code=404, detail="Provider connection not found")
    
    # Fetch bills from provider API
    # This is a generic implementation - specific providers need specific API calls
    
    try:
        bills_fetched = []
        
        # Example: If provider has API endpoint
        if connection.get("api_endpoint") and connection.get("api_key"):
            headers = {"Authorization": f"Bearer {connection['api_key']}"}
            response = requests.get(connection["api_endpoint"], headers=headers, timeout=10)
            
            if response.status_code == 200:
                # Parse provider response and create bills
                # This is provider-specific and would need customization
                provider_data = response.json()
                
                # Create bill from provider data
                bill = Bill(
                    user_id=current_user["id"],
                    category=connection["provider_type"],
                    provider=connection["provider_name"],
                    account_number=connection["account_number"],
                    amount=provider_data.get("amount", 0),
                    due_date=provider_data.get("due_date", (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()),
                    frequency="monthly",
                    status="pending"
                )
                
                await db.bills.insert_one(bill.model_dump())
                bills_fetched.append(bill)
        
        # Update last sync time
        await db.provider_connections.update_one(
            {"id": connection_id},
            {"$set": {"last_sync": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {
            "success": True,
            "message": f"Synced {len(bills_fetched)} bills from {connection['provider_name']}",
            "bills_fetched": len(bills_fetched)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")

@api_router.delete("/provider/disconnect/{connection_id}")
async def disconnect_provider(connection_id: str, current_user: dict = Depends(get_current_user)):
    """Disconnect from a provider"""
    result = await db.provider_connections.delete_one({"id": connection_id, "user_id": current_user["id"]})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Provider connection not found")
    
    return {"message": "Provider disconnected successfully"}

# Admin routes
async def get_admin_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Admin authentication middleware"""
    token = credentials.credentials
    payload = decode_token(token)
    user_id = payload.get("user_id")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user is None or not user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

@api_router.get("/admin/stats")
async def get_admin_stats(admin_user: dict = Depends(get_admin_user)):
    """Get overall platform statistics"""
    total_users = await db.users.count_documents({})
    total_bills = await db.bills.count_documents({})
    total_transactions = await db.transactions.count_documents({})
    pending_bills = await db.bills.count_documents({"status": "pending"})
    
    # Calculate total revenue (subscription fees)
    users = await db.users.find({}, {"_id": 0, "subscription_fee": 1}).to_list(10000)
    total_monthly_revenue = sum(u.get("subscription_fee", 5.0) for u in users)
    
    return {
        "total_users": total_users,
        "total_bills": total_bills,
        "total_transactions": total_transactions,
        "pending_bills": pending_bills,
        "monthly_revenue": total_monthly_revenue
    }

@api_router.get("/admin/users")
async def get_all_users(admin_user: dict = Depends(get_admin_user)):
    """Get all users with their bill counts"""
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(10000)
    
    for user in users:
        bill_count = await db.bills.count_documents({"user_id": user["id"]})
        user["bill_count"] = bill_count
    
    return users

@api_router.get("/admin/bulk-payment-report")
async def get_bulk_payment_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    provider: Optional[str] = None,
    report_type: str = "daily",  # daily, weekly, monthly, all
    admin_user: dict = Depends(get_admin_user)
):
    """
    Get bulk payment report for bills due within date range
    Groups by provider for bulk payment processing
    """
    # Calculate date range based on report type
    today = datetime.now(timezone.utc)
    
    if report_type == "all":
        start = datetime(2020, 1, 1, tzinfo=timezone.utc)
        end = datetime(2030, 12, 31, tzinfo=timezone.utc)
    elif report_type == "daily":
        start = today.replace(hour=0, minute=0, second=0, microsecond=0)
        end = today.replace(hour=23, minute=59, second=59, microsecond=999999)
    elif report_type == "weekly":
        start = today - timedelta(days=today.weekday())
        end = start + timedelta(days=6, hours=23, minutes=59, seconds=59)
    elif report_type == "monthly":
        start = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        next_month = start.replace(day=28) + timedelta(days=4)
        end = next_month - timedelta(days=next_month.day)
    
    # Use custom dates if provided
    if start_date:
        start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
    if end_date:
        end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
    
    # Query all pending bills and filter by date in Python
    # (due_date may be stored as plain date "YYYY-MM-DD" or ISO datetime)
    query = {"status": "pending"}
    if provider:
        query["provider"] = {"$regex": provider, "$options": "i"}

    all_pending = await db.bills.find(query, {"_id": 0}).to_list(10000)

    start_str = start.strftime('%Y-%m-%d')
    end_str = end.strftime('%Y-%m-%d')

    bills = []
    for bill in all_pending:
        due = bill.get("due_date", "")
        # Normalize: take only the date portion
        due_date_str = due[:10] if due else ""
        if due_date_str and start_str <= due_date_str <= end_str:
            bills.append(bill)
    
    # Get user details for each bill
    bill_reports = []
    for bill in bills:
        user = await db.users.find_one({"id": bill["user_id"]}, {"_id": 0, "password": 0})
        if user:
            bill_reports.append({
                "bill_id": bill["id"],
                "user_name": user["full_name"],
                "user_email": user["email"],
                "provider": bill["provider"],
                "category": bill["category"],
                "account_number": bill["account_number"],
                "bpay_code": bill.get("bpay_code"),
                "amount": bill["amount"],
                "due_date": bill["due_date"],
                "frequency": bill["frequency"]
            })
    
    # Group by provider for bulk payment
    providers_summary = {}
    for bill in bill_reports:
        provider_name = bill["provider"]
        if provider_name not in providers_summary:
            providers_summary[provider_name] = {
                "provider": provider_name,
                "total_amount": 0,
                "bill_count": 0,
                "bills": []
            }
        providers_summary[provider_name]["total_amount"] += bill["amount"]
        providers_summary[provider_name]["bill_count"] += 1
        providers_summary[provider_name]["bills"].append(bill)
    
    return {
        "report_type": report_type,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "total_bills": len(bill_reports),
        "total_amount": sum(b["amount"] for b in bill_reports),
        "providers_summary": list(providers_summary.values()),
        "detailed_bills": bill_reports
    }

@api_router.post("/admin/process-bulk-payment")
async def process_bulk_payment(
    provider: str,
    bill_ids: List[str],
    admin_user: dict = Depends(get_admin_user)
):
    """
    Mark bills as paid in bulk (after admin processes payment to provider)
    """
    result = await db.bills.update_many(
        {"id": {"$in": bill_ids}, "provider": provider, "status": "pending"},
        {"$set": {"status": "paid"}}
    )
    
    return {
        "message": f"Bulk payment processed for {provider}",
        "bills_updated": result.modified_count
    }

# ===================== PAYMENT METHODS =====================
@api_router.post("/payment-methods")
async def add_payment_method(data: PaymentMethodCreate, current_user: dict = Depends(get_current_user)):
    masked_account = None
    card_last4 = None
    if data.type == "bank_account" and data.account_number:
        masked_account = "****" + data.account_number[-4:]
    if data.type in ("credit_card", "debit_card") and data.card_number:
        card_last4 = data.card_number[-4:]

    if data.is_primary:
        await db.payment_methods.update_many(
            {"user_id": current_user["id"]}, {"$set": {"is_primary": False}}
        )

    pm = PaymentMethod(
        user_id=current_user["id"],
        type=data.type,
        label=data.label,
        bank_name=data.bank_name,
        bsb=data.bsb,
        account_number_masked=masked_account,
        card_last4=card_last4,
        card_brand=data.card_brand,
        is_primary=data.is_primary,
    )
    await db.payment_methods.insert_one(pm.model_dump())
    return pm.model_dump()

@api_router.get("/payment-methods")
async def get_payment_methods(current_user: dict = Depends(get_current_user)):
    methods = await db.payment_methods.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    return methods

@api_router.delete("/payment-methods/{method_id}")
async def delete_payment_method(method_id: str, current_user: dict = Depends(get_current_user)):
    r = await db.payment_methods.delete_one({"id": method_id, "user_id": current_user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Payment method not found")
    return {"message": "Payment method removed"}

@api_router.put("/payment-methods/{method_id}/set-primary")
async def set_primary_payment_method(method_id: str, current_user: dict = Depends(get_current_user)):
    await db.payment_methods.update_many(
        {"user_id": current_user["id"]}, {"$set": {"is_primary": False}}
    )
    r = await db.payment_methods.update_one(
        {"id": method_id, "user_id": current_user["id"]}, {"$set": {"is_primary": True}}
    )
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Payment method not found")
    return {"message": "Primary payment method updated"}


# ===================== SMART PAYMENT PLAN =====================
SAFETY_BUFFER = 0.08  # 8% buffer

def _calc_annual_total(bills: list) -> float:
    total = 0
    for b in bills:
        amt = b.get("amount", 0)
        freq = b.get("frequency", "monthly")
        if freq == "monthly":
            total += amt * 12
        elif freq == "quarterly":
            total += amt * 4
        elif freq == "yearly":
            total += amt
        elif freq == "fortnightly":
            total += amt * 26
        elif freq == "weekly":
            total += amt * 52
    return total


@api_router.get("/payment-plan/calculate")
async def calculate_payment_plan(current_user: dict = Depends(get_current_user)):
    """Calculate 3 deduction options based on all user bills with safety buffer."""
    bills = await db.bills.find({"user_id": current_user["id"], "status": "pending"}, {"_id": 0}).to_list(1000)
    annual_total = _calc_annual_total(bills)
    buffered_annual = annual_total * (1 + SAFETY_BUFFER)

    weekly = round(buffered_annual / 52, 2)
    fortnightly = round(buffered_annual / 26, 2)
    monthly = round(buffered_annual / 12, 2)

    return {
        "annual_bill_total": round(annual_total, 2),
        "safety_buffer_pct": SAFETY_BUFFER * 100,
        "buffered_annual": round(buffered_annual, 2),
        "total_pending_bills": len(bills),
        "options": [
            {"frequency": "weekly", "amount": weekly, "deductions_per_year": 52, "label": "Weekly"},
            {"frequency": "fortnightly", "amount": fortnightly, "deductions_per_year": 26, "label": "Fortnightly"},
            {"frequency": "monthly", "amount": monthly, "deductions_per_year": 12, "label": "Monthly"},
        ]
    }


@api_router.post("/payment-plan/select")
async def select_payment_plan(frequency: str, current_user: dict = Depends(get_current_user)):
    if frequency not in ("weekly", "fortnightly", "monthly"):
        raise HTTPException(status_code=400, detail="Invalid frequency")

    bills = await db.bills.find({"user_id": current_user["id"], "status": "pending"}, {"_id": 0}).to_list(1000)
    annual_total = _calc_annual_total(bills)
    buffered = annual_total * (1 + SAFETY_BUFFER)

    divisors = {"weekly": 52, "fortnightly": 26, "monthly": 12}
    days_map = {"weekly": 7, "fortnightly": 14, "monthly": 30}
    amount = round(buffered / divisors[frequency], 2)

    plan = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "frequency": frequency,
        "deduction_amount": amount,
        "annual_total": round(annual_total, 2),
        "buffered_annual": round(buffered, 2),
        "safety_buffer_pct": SAFETY_BUFFER * 100,
        "next_deduction_date": (datetime.now(timezone.utc) + timedelta(days=days_map[frequency])).isoformat(),
        "status": "active",
        "total_collected": 0,
        "total_paid_out": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.payment_plans.delete_many({"user_id": current_user["id"]})
    await db.payment_plans.insert_one(plan)
    plan.pop("_id", None)
    return plan


@api_router.get("/payment-plan/current")
async def get_current_plan(current_user: dict = Depends(get_current_user)):
    plan = await db.payment_plans.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not plan:
        return {"status": "none", "message": "No payment plan selected"}
    return plan


@api_router.post("/payment-plan/simulate-deduction")
async def simulate_deduction(current_user: dict = Depends(get_current_user)):
    """Simulate a scheduled deduction from customer's payment method."""
    plan = await db.payment_plans.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not plan or plan.get("status") != "active":
        raise HTTPException(status_code=400, detail="No active payment plan")

    amount = plan["deduction_amount"]
    # Record transaction
    tx = Transaction(
        user_id=current_user["id"],
        type="plan_deduction",
        amount=amount,
        description=f"Scheduled {plan['frequency']} deduction"
    )
    await db.transactions.insert_one(tx.model_dump())
    # Update wallet and plan
    await db.users.update_one({"id": current_user["id"]}, {"$inc": {"wallet_balance": amount}})
    await db.payment_plans.update_one(
        {"user_id": current_user["id"]},
        {"$inc": {"total_collected": amount}}
    )
    return {"message": f"Deduction of ${amount:.2f} processed", "amount": amount}


# ===================== ENHANCED ADMIN ANALYTICS =====================
@api_router.get("/admin/financial-overview")
async def admin_financial_overview(admin_user: dict = Depends(get_admin_user)):
    """Company financial dashboard: collected vs owed, cash flow."""
    all_plans = await db.payment_plans.find({}, {"_id": 0}).to_list(10000)
    all_pending = await db.bills.find({"status": "pending"}, {"_id": 0}).to_list(10000)
    all_paid = await db.bills.find({"status": "paid"}, {"_id": 0}).to_list(10000)
    all_users = await db.users.count_documents({})
    active_plans = [p for p in all_plans if p.get("status") == "active"]

    total_collected = sum(p.get("total_collected", 0) for p in all_plans)
    total_paid_out = sum(p.get("total_paid_out", 0) for p in all_plans)
    total_wallet = sum(
        (await db.users.find({}, {"_id": 0, "wallet_balance": 1}).to_list(10000))
        and [u.get("wallet_balance", 0) for u in await db.users.find({}, {"_id": 0, "wallet_balance": 1}).to_list(10000)]
    )
    total_pending_amount = sum(b.get("amount", 0) for b in all_pending)
    total_paid_amount = sum(b.get("amount", 0) for b in all_paid)

    # Monthly collection forecast
    monthly_forecast = sum(p.get("deduction_amount", 0) * (12 if p.get("frequency") == "monthly" else 26 if p.get("frequency") == "fortnightly" else 52) / 12 for p in active_plans)

    return {
        "total_users": all_users,
        "active_plans": len(active_plans),
        "total_collected": round(total_collected, 2),
        "total_paid_out": round(total_paid_out, 2),
        "company_float": round(total_collected - total_paid_out, 2),
        "total_pending_bills": len(all_pending),
        "total_pending_amount": round(total_pending_amount, 2),
        "total_paid_bills": len(all_paid),
        "total_paid_amount": round(total_paid_amount, 2),
        "monthly_collection_forecast": round(monthly_forecast, 2),
    }


@api_router.get("/admin/outstanding-by-period")
async def admin_outstanding_by_period(admin_user: dict = Depends(get_admin_user)):
    """Outstanding bills grouped by time period for finance management."""
    all_pending = await db.bills.find({"status": "pending"}, {"_id": 0}).to_list(10000)
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')

    overdue, this_month, next_30, next_60, next_90, beyond = [], [], [], [], [], []
    today_dt = datetime.now(timezone.utc)

    for b in all_pending:
        due_str = b.get("due_date", "")[:10]
        if not due_str:
            continue
        try:
            due_dt = datetime.strptime(due_str, '%Y-%m-%d').replace(tzinfo=timezone.utc)
        except ValueError:
            continue
        days_away = (due_dt - today_dt).days
        entry = {
            "bill_id": b["id"], "user_id": b.get("user_id"), "provider": b.get("provider"),
            "category": b.get("category"), "amount": b.get("amount", 0),
            "due_date": due_str, "days_until_due": days_away
        }
        if days_away < 0:
            overdue.append(entry)
        elif days_away <= 30:
            this_month.append(entry)
        elif days_away <= 60:
            next_60.append(entry)
        elif days_away <= 90:
            next_90.append(entry)
        else:
            beyond.append(entry)

    def _summarize(lst):
        return {"count": len(lst), "total": round(sum(x["amount"] for x in lst), 2), "bills": lst}

    return {
        "overdue": _summarize(overdue),
        "next_30_days": _summarize(this_month),
        "30_to_60_days": _summarize(next_60),
        "60_to_90_days": _summarize(next_90),
        "beyond_90_days": _summarize(beyond),
    }


@api_router.get("/admin/customer-analytics")
async def admin_customer_analytics(admin_user: dict = Depends(get_admin_user)):
    """Customer-level analytics for risk and compliance."""
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(10000)
    analytics = []
    for u in users:
        uid = u["id"]
        bills = await db.bills.find({"user_id": uid}, {"_id": 0}).to_list(1000)
        plan = await db.payment_plans.find_one({"user_id": uid}, {"_id": 0})
        pending = [b for b in bills if b.get("status") == "pending"]
        paid = [b for b in bills if b.get("status") == "paid"]
        total_pending = sum(b.get("amount", 0) for b in pending)
        total_paid = sum(b.get("amount", 0) for b in paid)

        risk = "low"
        if total_pending > u.get("wallet_balance", 0) * 2:
            risk = "high"
        elif total_pending > u.get("wallet_balance", 0):
            risk = "medium"

        analytics.append({
            "user_id": uid,
            "name": u.get("full_name", ""),
            "email": u.get("email", ""),
            "total_bills": len(bills),
            "pending_bills": len(pending),
            "paid_bills": len(paid),
            "total_pending_amount": round(total_pending, 2),
            "total_paid_amount": round(total_paid, 2),
            "wallet_balance": round(u.get("wallet_balance", 0), 2),
            "has_plan": plan is not None and plan.get("status") == "active",
            "plan_frequency": plan.get("frequency") if plan else None,
            "risk_level": risk,
        })
    return {"customers": analytics, "total": len(analytics)}


# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()