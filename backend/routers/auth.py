from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import User, Patient
from db.schemas import UserCreate, UserLogin, UserOut, Token, UserProfileUpdate
from utils.auth import (verify_password, get_password_hash,
                         create_access_token, DOCTOR_INVITE_CODE,
                         require_user)
import random
import string

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/register", response_model=Token)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    # Check email exists
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Validate role
    if user_data.role not in ["doctor", "patient"]:
        raise HTTPException(status_code=400, detail="Role must be doctor or patient")

    # Validate doctor invite code
    if user_data.role == "doctor":
        if user_data.invite_code != DOCTOR_INVITE_CODE:
            raise HTTPException(status_code=403,
                                detail="Invalid invite code for doctor registration")

    # Validate password length
    if len(user_data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    # Create user
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

    # If patient: auto-create patient record
    if user_data.role == "patient":
        patient_code = "PT-" + "".join(random.choices(string.digits, k=4))
        while db.query(Patient).filter(Patient.patient_code == patient_code).first():
            patient_code = "PT-" + "".join(random.choices(string.digits, k=4))
        patient = Patient(
            patient_code=patient_code,
            age=0,
            gender="unknown",
        )
        db.add(patient)
        db.flush()
        db_user.patient_code = patient_code

    db.commit()
    db.refresh(db_user)

    token = create_access_token({"sub": str(db_user.id), "role": db_user.role})
    return Token(access_token=token, token_type="bearer", user=UserOut.model_validate(db_user))


@router.post("/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return Token(access_token=token, token_type="bearer", user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(require_user)):
    return current_user


@router.patch("/profile", response_model=UserOut)
def update_profile(
    profile: UserProfileUpdate,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db)
):
    update_data = profile.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)
    if "onboarding_completed" not in update_data:
        current_user.onboarding_completed = True
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/logout")
def logout():
    return {"message": "Logged out successfully"}
