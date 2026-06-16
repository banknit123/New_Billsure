"""EasyBillsPay — Utility functions: auth, encryption, email"""
import os
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from cryptography.fernet import Fernet
import jwt
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import supabase_db as sdb

logger = logging.getLogger(__name__)

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
SECRET_KEY = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = int(os.environ.get('TOKEN_EXPIRE_HOURS', '4'))

# Encryption
_enc_key = os.environ.get('ENCRYPTION_KEY', '')
_fernet = Fernet(_enc_key.encode()) if _enc_key else None


def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

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
    user = await sdb.find_one("users", {"id": user_id})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def get_admin_user(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

def encrypt_field(value: str) -> str:
    if not _fernet or not value:
        return value
    return _fernet.encrypt(value.encode()).decode()

def decrypt_field(value: str) -> str:
    if not _fernet or not value:
        return value
    try:
        return _fernet.decrypt(value.encode()).decode()
    except Exception:
        return value

# Email
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'noreply@easybillspay.com.au')

if RESEND_API_KEY:
    import resend
    resend.api_key = RESEND_API_KEY

async def send_email(to_email: str, subject: str, html_body: str):
    if not RESEND_API_KEY:
        logger.info(f"[EMAIL SIM] To: {to_email} | Subject: {subject}")
        return False
    try:
        params = {"from": SENDER_EMAIL, "to": [to_email], "subject": subject, "html": html_body}
        await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"[EMAIL SENT] To: {to_email} | Subject: {subject}")
        return True
    except Exception as e:
        logger.error(f"[EMAIL FAIL] To: {to_email} | Error: {e}")
        return False
