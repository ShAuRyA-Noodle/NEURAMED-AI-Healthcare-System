import os
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Set
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import User

# ── Secret key: fail-fast if missing or too short ────────────────────────────
_raw_secret = os.getenv("SECRET_KEY", "")
if not _raw_secret or len(_raw_secret) < 32:
    raise RuntimeError(
        "SECRET_KEY env var is missing or shorter than 32 chars. "
        "Generate one: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
    )
SECRET_KEY = _raw_secret

# ── Doctor invite code: fail-fast if missing ─────────────────────────────────
_raw_invite = os.getenv("DOCTOR_INVITE_CODE", "")
if not _raw_invite:
    raise RuntimeError(
        "DOCTOR_INVITE_CODE env var is not set. "
        "Set a strong random value distributed out-of-band to doctors."
    )
DOCTOR_INVITE_CODE = _raw_invite

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15    # short-lived; refresh rotates
REFRESH_TOKEN_EXPIRE_DAYS = 7

# ── In-memory JTI blacklist (swap for Redis in production) ───────────────────
_revoked_jtis: Set[str] = set()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

# ── Password hashing: PBKDF2-SHA256 @ 600k iterations (OWASP 2024) ───────────
_HASH_ALGO = "sha256"
_HASH_ITERATIONS = 600_000


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


# ── Token creation ────────────────────────────────────────────────────────────
def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    jti = secrets.token_urlsafe(16)
    to_encode.update({"exp": expire, "jti": jti, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    jti = secrets.token_urlsafe(16)
    to_encode.update({"exp": expire, "jti": jti, "type": "refresh"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def revoke_token(token: str) -> None:
    """Blacklist a token's JTI so it can never be reused."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        jti = payload.get("jti")
        if jti:
            _revoked_jtis.add(jti)
    except JWTError:
        pass


def _decode_and_validate(token: str, expected_type: str = "access") -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != expected_type:
            return None
        jti = payload.get("jti")
        if jti and jti in _revoked_jtis:
            return None
        return payload
    except JWTError:
        return None


def decode_refresh_token(token: str) -> Optional[dict]:
    return _decode_and_validate(token, "refresh")


# ── Token extraction: Authorization header OR httpOnly cookie ────────────────
def _extract_token(request: Request, bearer_token: Optional[str]) -> Optional[str]:
    if bearer_token:
        return bearer_token
    return request.cookies.get("neuramed_session")


# ── FastAPI dependency functions ──────────────────────────────────────────────
async def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Optional[User]:
    raw = _extract_token(request, token)
    if not raw:
        return None
    payload = _decode_and_validate(raw, "access")
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    return db.query(User).filter(User.id == int(user_id)).first()


async def require_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    raw = _extract_token(request, token)
    _exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not raw:
        raise _exc
    payload = _decode_and_validate(raw, "access")
    if not payload:
        raise _exc
    user_id = payload.get("sub")
    if not user_id:
        raise _exc
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise _exc
    return user


async def require_doctor(current_user: User = Depends(require_user)) -> User:
    if current_user.role != "doctor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to doctors only",
        )
    return current_user
