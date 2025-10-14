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
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class Bill(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    category: str  # Electricity, Water, Council, Mobile, Internet, School Fees, Tuition Fees
    provider: str
    account_number: str
    amount: float
    due_date: str  # ISO date string
    frequency: str  # monthly, quarterly, yearly
    status: str = "pending"  # pending, paid, overdue
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class BillCreate(BaseModel):
    category: str
    provider: str
    account_number: str
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
    # Calculate total monthly bills
    bills = await db.bills.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    total_monthly = sum(bill["amount"] for bill in bills if bill["frequency"] == "monthly")
    
    # Calculate contribution amount based on frequency
    if data.payment_frequency == "weekly":
        contribution = total_monthly / 4
        days_until_next = 7
    elif data.payment_frequency == "fortnightly":
        contribution = total_monthly / 2
        days_until_next = 14
    else:  # monthly
        contribution = total_monthly
        days_until_next = 30
    
    next_payment = (datetime.now(timezone.utc) + timedelta(days=days_until_next)).isoformat()
    
    payment_structure = PaymentStructure(
        user_id=current_user["id"],
        payment_frequency=data.payment_frequency,
        total_monthly_bills=total_monthly,
        contribution_amount=contribution,
        next_payment_date=next_payment
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
    
    return {
        "wallet_balance": current_user["wallet_balance"],
        "total_bills": total_bills,
        "pending_bills": pending_bills,
        "paid_bills": paid_bills,
        "total_bill_amount": total_bill_amount,
        "recent_transactions": transactions[:5]
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