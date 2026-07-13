import os
import hashlib
import hmac
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import User

SECRET_KEY = os.getenv("SECRET_KEY", "neuramed-secret-key-change-in-production-2026")
if os.getenv("ENVIRONMENT") == "production" and SECRET_KEY == "neuramed-secret-key-change-in-production-2026":
    import warnings
    warnings.warn("CRITICAL: SECRET_KEY is using the default value in production! Set the SECRET_KEY environment variable.", stacklevel=2)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30
DOCTOR_INVITE_CODE = os.getenv("DOCTOR_INVITE_CODE", "NEURAMED-DOCTOR-2026")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

# Use PBKDF2 instead of bcrypt to avoid passlib compatibility issues
_HASH_ALGO = "sha256"
_HASH_ITERATIONS = 260000


def get_password_hash(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac(_HASH_ALGO, password.encode(), salt, _HASH_ITERATIONS)
    return salt.hex() + ":" + dk.hex()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        salt_hex, dk_hex = hashed.split(":", 1)
        salt = bytes.fromhex(salt_hex)
        dk = hashlib.pbkdf2_hmac(_HASH_ALGO, plain.encode(), salt, _HASH_ITERATIONS)
        return hmac.compare_digest(dk.hex(), dk_hex)
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def require_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if token is None:
        raise credentials_exception
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user


async def require_doctor(current_user: User = Depends(require_user)) -> User:
    if current_user.role != "doctor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to doctors only"
        )
    return current_user
