from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import User, Patient
from db.schemas import UserCreate, UserLogin, UserOut, Token, UserProfileUpdate
from utils.auth import (
    verify_password, get_password_hash,
    create_access_token, create_refresh_token,
    decode_refresh_token, revoke_token,
    DOCTOR_INVITE_CODE, require_user,
    ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS,
)
from pydantic import BaseModel
import random
import string
import os

router = APIRouter(prefix="/api/auth", tags=["Auth"])
limiter = Limiter(key_func=get_remote_address)

_IS_PROD = os.getenv("ENVIRONMENT") == "production"
_COOKIE_KWARGS = dict(
    httponly=True,
    secure=_IS_PROD,
    samesite="strict",
    path="/",
)


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    response.set_cookie(
        "neuramed_session", access_token,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        **_COOKIE_KWARGS,
    )
    response.set_cookie(
        "neuramed_refresh", refresh_token,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        **_COOKIE_KWARGS,
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("neuramed_session", path="/")
    response.delete_cookie("neuramed_refresh", path="/")


class RefreshRequest(BaseModel):
    refresh_token: str | None = None  # fallback if not using cookies


@router.post("/register", response_model=Token)
@limiter.limit("5/minute")
def register(request: Request, user_data: UserCreate, response: Response, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    if user_data.role not in ["doctor", "patient"]:
        raise HTTPException(status_code=400, detail="Role must be doctor or patient")

    if user_data.role == "doctor":
        if user_data.invite_code != DOCTOR_INVITE_CODE:
            raise HTTPException(status_code=403, detail="Invalid invite code for doctor registration")

    if len(user_data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    hashed = get_password_hash(user_data.password)
    db_user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=hashed,
        role=user_data.role,
        avatar_emoji="👨‍⚕️" if user_data.role == "doctor" else "🧑‍🦽",
    )
    db.add(db_user)
    db.flush()

    if user_data.role == "patient":
        patient_code = "PT-" + "".join(random.choices(string.digits, k=4))
        while db.query(Patient).filter(Patient.patient_code == patient_code).first():
            patient_code = "PT-" + "".join(random.choices(string.digits, k=4))
        patient = Patient(patient_code=patient_code, age=0, gender="unknown")
        db.add(patient)
        db.flush()
        db_user.patient_code = patient_code

    db.commit()
    db.refresh(db_user)

    payload = {"sub": str(db_user.id), "role": db_user.role}
    access = create_access_token(payload)
    refresh = create_refresh_token(payload)
    _set_auth_cookies(response, access, refresh)

    return Token(access_token=access, token_type="bearer", user=UserOut.model_validate(db_user))


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
def login(request: Request, credentials: UserLogin, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    payload = {"sub": str(user.id), "role": user.role}
    access = create_access_token(payload)
    refresh = create_refresh_token(payload)
    _set_auth_cookies(response, access, refresh)

    return Token(access_token=access, token_type="bearer", user=UserOut.model_validate(user))


@router.post("/refresh", response_model=Token)
@limiter.limit("20/minute")
def refresh_token(request: Request, body: RefreshRequest, response: Response, db: Session = Depends(get_db)):
    raw = body.refresh_token or request.cookies.get("neuramed_refresh")
    if not raw:
        raise HTTPException(status_code=401, detail="Refresh token required")

    payload = decode_refresh_token(raw)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    # Revoke old refresh token and issue new pair
    revoke_token(raw)

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    new_payload = {"sub": str(user.id), "role": user.role}
    new_access = create_access_token(new_payload)
    new_refresh = create_refresh_token(new_payload)
    _set_auth_cookies(response, new_access, new_refresh)

    return Token(access_token=new_access, token_type="bearer", user=UserOut.model_validate(user))


@router.post("/logout")
def logout(request: Request, response: Response, _auth: User = Depends(require_user)):
    # Revoke both tokens if present
    for cookie_name in ("neuramed_session", "neuramed_refresh"):
        token = request.cookies.get(cookie_name)
        if token:
            revoke_token(token)

    _clear_auth_cookies(response)
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(require_user)):
    return current_user


@router.patch("/profile", response_model=UserOut)
def update_profile(
    profile: UserProfileUpdate,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    update_data = profile.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)
    if "onboarding_completed" not in update_data:
        current_user.onboarding_completed = True
    db.commit()
    db.refresh(current_user)
    return current_user
