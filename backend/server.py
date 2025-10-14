from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
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
            bill_due_date = datetime.fromisoformat(bill["due_date"].replace('Z', '+00:00'))
            if bill_due_date <= seven_days_later:
                bills_due_soon.append(bill)
    
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
    report_type: str = "daily",  # daily, weekly, monthly
    admin_user: dict = Depends(get_admin_user)
):
    """
    Get bulk payment report for bills due within date range
    Groups by provider for bulk payment processing
    """
    # Calculate date range based on report type
    today = datetime.now(timezone.utc)
    
    if report_type == "daily":
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
    
    # Query bills due within date range
    query = {
        "status": "pending",
        "due_date": {
            "$gte": start.isoformat(),
            "$lte": end.isoformat()
        }
    }
    
    if provider:
        query["provider"] = {"$regex": provider, "$options": "i"}
    
    bills = await db.bills.find(query, {"_id": 0}).to_list(10000)
    
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