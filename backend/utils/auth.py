"""EasyBillsPay — Utility functions: auth, encryption, email
Now using Supabase Auth for authentication with custom JWT fallback.
"""
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
from supabase import create_client

logger = logging.getLogger(__name__)

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
SECRET_KEY = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = int(os.environ.get('TOKEN_EXPIRE_HOURS', '4'))

# Supabase Auth
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')
SUPABASE_JWT_SECRET = os.environ.get('SUPABASE_JWT_SECRET', '')

_supabase_admin = None

def get_supabase_admin():
    global _supabase_admin
    if _supabase_admin is None and SUPABASE_URL and SUPABASE_SERVICE_KEY:
        _supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _supabase_admin

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
    """Decode either a custom JWT or a Supabase JWT token."""
    # Try custom JWT first
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        pass

    # Try Supabase JWT (signed with Supabase JWT secret)
    if SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )
            return payload
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            pass

    # Try Supabase JWT without audience verification (fallback)
    if SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
            return payload
        except Exception:
            pass

    raise HTTPException(status_code=401, detail="Token has expired or is invalid")


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials

    # Try custom JWT first (backwards compatibility)
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if user_id:
            user = await sdb.find_one("users", {"id": user_id})
            if user:
                return user
    except Exception:
        pass

    # Try Supabase token verification via admin API
    sb = get_supabase_admin()
    if sb:
        try:
            auth_response = sb.auth.admin.get_user(token)
            if auth_response and auth_response.user:
                sb_user = auth_response.user
                # Find by supabase_uid or email
                user = await sdb.find_one("users", {"supabase_uid": sb_user.id})
                if not user and sb_user.email:
                    user = await sdb.find_one("users", {"email": sb_user.email})
                if user:
                    return user
        except Exception as e:
            logger.debug(f"Supabase token verification failed: {e}")

    raise HTTPException(status_code=401, detail="Invalid or expired token")


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
