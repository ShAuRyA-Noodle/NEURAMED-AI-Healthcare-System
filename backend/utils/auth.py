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

_DEFAULT_SECRET_KEY = "neuramed-secret-key-change-in-production-2026"
_DEFAULT_DOCTOR_INVITE_CODE = "NEURAMED-DOCTOR-2026"

SECRET_KEY = os.getenv("SECRET_KEY", _DEFAULT_SECRET_KEY)
if os.getenv("ENVIRONMENT") == "production" and SECRET_KEY == _DEFAULT_SECRET_KEY:
    import warnings
    warnings.warn("CRITICAL: SECRET_KEY is using the default value in production! Set the SECRET_KEY environment variable.", stacklevel=2)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30
DOCTOR_INVITE_CODE = os.getenv("DOCTOR_INVITE_CODE", _DEFAULT_DOCTOR_INVITE_CODE)


def assert_production_secrets() -> None:
    """C4/C5 — fail-closed in production.

    In production, refuse to start with unset or default secrets. Outside
    production (dev/test), the module-level warnings above keep the app booting.
    Reads env live so it can be called from a startup event.
    """
    if os.getenv("ENVIRONMENT") != "production":
        return
    secret = os.getenv("SECRET_KEY")
    if not secret or secret == _DEFAULT_SECRET_KEY:
        raise RuntimeError(
            "SECRET_KEY must be set to a non-default value in production."
        )
    invite = os.getenv("DOCTOR_INVITE_CODE")
    if not invite or invite == _DEFAULT_DOCTOR_INVITE_CODE:
        raise RuntimeError(
            "DOCTOR_INVITE_CODE must be set to a non-default value in production."
        )

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


def decode_token(token: Optional[str]) -> Optional[dict]:
    """Validate a JWT and return its payload, or None if missing/invalid.

    Shared decode logic used by both the HTTP dependency (require_user) and
    the WebSocket handshake (which passes the token as a query param).
    """
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
    if payload.get("sub") is None:
        return None
    return payload


async def require_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(token)
    if payload is None:
        raise credentials_exception
    user_id = payload.get("sub")
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
