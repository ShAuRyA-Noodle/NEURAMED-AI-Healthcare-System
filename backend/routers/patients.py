from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import Optional, List
from backend.db.database import get_db
from backend.db.models import Patient, DiagnosisSession
from backend.db.schemas import PatientCreate, PatientResponse

router = APIRouter(prefix="/api/patients", tags=["Patients"])


def generate_patient_code(db: Session) -> str:
    count = db.query(Patient).count()
    return f"PT-{count + 1:04d}"


@router.post("", response_model=PatientResponse)
def create_patient(patient: PatientCreate, db: Session = Depends(get_db)):
    code = generate_patient_code(db)
    db_patient = Patient(
        patient_code=code,
        age=patient.age,
        gender=patient.gender
    )
    db.add(db_patient)
    db.commit()
    db.refresh(db_patient)
    return db_patient


@router.get("")
def get_patients(search: Optional[str] = "", limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    query = db.query(Patient)
    if search:
        query = query.filter(
            or_(
                Patient.patient_code.ilike(f"%{search}%"),
                Patient.gender.ilike(f"%{search}%")
            )
        )
    patients = query.offset(offset).limit(limit).all()

    result = []
    for p in patients:
        sessions = p.sessions or []
        total_sessions = len(sessions)

        # Find last session
        last_session = max(sessions, key=lambda s: s.created_at, default=None) if sessions else None
        last_session_agent = last_session.agent_type.upper() if last_session else None
        last_session_urgency = (last_session.urgency_level.upper() if last_session and last_session.urgency_level else "LOW")

        # Most common condition
        condition_counts = {}
        for s in sessions:
            if s.conditions_detected:
                for c in s.conditions_detected:
                    condition_counts[c] = condition_counts.get(c, 0) + 1
        most_common_condition = max(condition_counts, key=condition_counts.get) if condition_counts else None

        result.append({
            "id": p.id,
            "patient_code": p.patient_code,
            "age": p.age,
            "gender": p.gender,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "demographics": {
                "age": p.age,
                "gender": p.gender,
                "blood_type": "N/A"
            },
            "total_sessions": total_sessions,
            "last_session_agent": last_session_agent,
            "last_session_urgency": last_session_urgency,
            "most_common_condition": most_common_condition,
        })

    return result


@router.get("/{patient_id}")
def get_patient(patient_id: int, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

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
                "created_at": s.created_at.isoformat() if s.created_at else None
            } for s in sorted(patient.sessions, key=lambda s: s.created_at, reverse=True)
        ]
    }
