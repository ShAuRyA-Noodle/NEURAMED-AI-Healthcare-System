from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import Optional, List
from db.database import get_db
from db.models import Patient, DiagnosisSession, User
from db.schemas import PatientCreate, PatientResponse
from utils.auth import require_doctor

router = APIRouter(prefix="/api/patients", tags=["Patients"])


def generate_patient_code(db: Session) -> str:
    count = db.query(Patient).count()
    return f"PT-{count + 1:04d}"


@router.post("", response_model=PatientResponse)
def create_patient(patient: PatientCreate, db: Session = Depends(get_db), current_user: User = Depends(require_doctor)):
    code = generate_patient_code(db)
    db_patient = Patient(
        patient_code=code,
        first_name=patient.first_name,
        last_name=patient.last_name,
        age=patient.age,
        gender=patient.gender,
        date_of_birth=patient.date_of_birth,
        blood_type=patient.blood_type,
        phone=patient.phone,
        email=patient.email,
        address=patient.address,
        emergency_contact=patient.emergency_contact,
        allergies=patient.allergies,
        chronic_conditions=patient.chronic_conditions,
        insurance_id=patient.insurance_id,
    )
    db.add(db_patient)
    db.commit()
    db.refresh(db_patient)
    return db_patient


@router.get("")
def get_patients(
    search: Optional[str] = "",
    gender: Optional[str] = None,
    age_min: Optional[int] = None,
    age_max: Optional[int] = None,
    condition: Optional[str] = None,
    urgency: Optional[str] = None,
    agent_type: Optional[str] = None,
    sort_by: Optional[str] = "created_at",
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor)
):
    query = db.query(Patient)
    if search:
        query = query.filter(
            or_(
                Patient.patient_code.ilike(f"%{search}%"),
                Patient.first_name.ilike(f"%{search}%"),
                Patient.last_name.ilike(f"%{search}%"),
                Patient.gender.ilike(f"%{search}%"),
                Patient.phone.ilike(f"%{search}%"),
            )
        )
    if gender:
        query = query.filter(Patient.gender.ilike(gender))
    if age_min is not None:
        query = query.filter(Patient.age >= age_min)
    if age_max is not None:
        query = query.filter(Patient.age <= age_max)

    patients = query.offset(offset).limit(limit).all()

    result = []
    for p in patients:
        sessions = p.sessions or []
        total_sessions = len(sessions)

        # Apply post-query filters on sessions
        filtered_sessions = sessions
        if agent_type:
            filtered_sessions = [s for s in sessions if s.agent_type == agent_type]
        if condition:
            filtered_sessions = [s for s in filtered_sessions if s.conditions_detected and any(condition.lower() in c.lower() for c in s.conditions_detected)]
        if urgency:
            filtered_sessions = [s for s in filtered_sessions if s.urgency_level and s.urgency_level.lower() == urgency.lower()]

        # Skip patients with no matching sessions if filters are active
        if (agent_type or condition or urgency) and not filtered_sessions:
            continue

        # Find last session
        last_session = max(sessions, key=lambda s: s.created_at, default=None) if sessions else None
        last_session_agent = last_session.agent_type.upper() if last_session else None
        last_session_urgency = (last_session.urgency_level.upper() if last_session and last_session.urgency_level else "LOW")
        last_session_date = last_session.created_at.isoformat() if last_session and last_session.created_at else None

        # All conditions detected
        condition_counts = {}
        for s in sessions:
            if s.conditions_detected:
                for c in s.conditions_detected:
                    condition_counts[c] = condition_counts.get(c, 0) + 1
        most_common_condition = max(condition_counts, key=condition_counts.get) if condition_counts else None
        all_conditions = list(condition_counts.keys())

        # Risk score
        urgency_weights = {"critical": 1.0, "high": 0.75, "medium": 0.5, "low": 0.25}
        if sessions:
            avg_conf = sum(s.confidence_score or 0 for s in sessions) / len(sessions)
            last_urg = (last_session.urgency_level or "low").lower() if last_session else "low"
            risk_score = round(avg_conf * urgency_weights.get(last_urg, 0.25), 3)
        else:
            risk_score = 0.0

        result.append({
            "id": p.id,
            "patient_code": p.patient_code,
            "first_name": getattr(p, "first_name", None),
            "last_name": getattr(p, "last_name", None),
            "full_name": f"{getattr(p, 'first_name', '') or ''} {getattr(p, 'last_name', '') or ''}".strip() or p.patient_code,
            "age": p.age,
            "gender": p.gender,
            "phone": getattr(p, "phone", None),
            "email": getattr(p, "email", None),
            "address": getattr(p, "address", None),
            "emergency_contact": getattr(p, "emergency_contact", None),
            "allergies": getattr(p, "allergies", None),
            "chronic_conditions": getattr(p, "chronic_conditions", None),
            "insurance_id": getattr(p, "insurance_id", None),
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "demographics": {
                "age": p.age,
                "gender": p.gender,
                "blood_type": getattr(p, "blood_type", None) or "N/A",
                "date_of_birth": getattr(p, "date_of_birth", None),
            },
            "total_sessions": total_sessions,
            "session_count": total_sessions,
            "last_session_agent": last_session_agent,
            "last_session_urgency": last_session_urgency,
            "last_session_date": last_session_date,
            "most_common_condition": most_common_condition,
            "total_conditions_detected": all_conditions,
            "risk_score": risk_score,
        })

    # Sort
    if sort_by == "session_count":
        result.sort(key=lambda x: x["session_count"], reverse=True)
    elif sort_by == "last_session":
        result.sort(key=lambda x: x["last_session_date"] or "", reverse=True)
    elif sort_by == "urgency":
        urg_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
        result.sort(key=lambda x: urg_order.get(x["last_session_urgency"], 4))
    elif sort_by == "risk_score":
        result.sort(key=lambda x: x["risk_score"], reverse=True)

    return result


@router.get("/{patient_id}")
def get_patient(patient_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_doctor)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    sessions = sorted(patient.sessions, key=lambda s: s.created_at, reverse=True)

    # Condition frequency map
    condition_freq = {}
    agent_usage = {"voice": 0, "imaging": 0, "ocr": 0}
    for s in sessions:
        if s.agent_type in agent_usage:
            agent_usage[s.agent_type] += 1
        if s.conditions_detected:
            for c in s.conditions_detected:
                condition_freq[c] = condition_freq.get(c, 0) + 1

    return {
        "id": patient.id,
        "patient_code": patient.patient_code,
        "age": patient.age,
        "gender": patient.gender,
        "created_at": patient.created_at.isoformat() if patient.created_at else None,
        "sessions": [
            {
                "id": s.id,
                "agent_type": s.agent_type,
                "urgency_level": s.urgency_level,
                "confidence_score": s.confidence_score,
                "conditions_detected": s.conditions_detected or [],
                "input_summary": s.input_summary,
                "processing_time_ms": s.processing_time_ms,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "result_json": s.result_json or {}
            } for s in sessions
        ],
        "condition_frequency": condition_freq,
        "agent_usage": agent_usage,
        "total_sessions": len(sessions),
    }
