from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, cast, String
from db.database import get_db
from db.models import Patient, DiagnosisSession, Appointment

router = APIRouter(prefix="/api", tags=["Search"])


@router.get("/search")
def global_search(q: str = Query("", min_length=1), db: Session = Depends(get_db)):
    search_term = f"%{q}%"

    # Search patients
    patients_query = db.query(Patient).filter(
        or_(
            Patient.patient_code.ilike(search_term),
            Patient.gender.ilike(search_term)
        )
    ).limit(10).all()

    patients = [{
        "id": p.id,
        "patient_code": p.patient_code,
        "age": p.age,
        "gender": p.gender,
    } for p in patients_query]

    # Search sessions by conditions_detected (stored as JSON list)
    sessions_query = db.query(DiagnosisSession).filter(
        or_(
            cast(DiagnosisSession.conditions_detected, String).ilike(search_term),
            DiagnosisSession.input_summary.ilike(search_term)
        )
    ).limit(10).all()

    sessions = [{
        "id": s.id,
        "patient_code": s.patient.patient_code if s.patient else "UNK",
        "agent_type": s.agent_type,
        "conditions_detected": s.conditions_detected or [],
        "urgency_level": s.urgency_level,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    } for s in sessions_query]

    # Search appointments
    appointments_query = db.query(Appointment).filter(
        or_(
            Appointment.doctor_name.ilike(search_term),
            Appointment.reason.ilike(search_term),
            Appointment.specialty.ilike(search_term)
        )
    ).limit(10).all()

    appointments = [{
        "id": a.id,
        "patient_code": a.patient.patient_code if a.patient else "WALK-IN",
        "doctor_name": a.doctor_name,
        "specialty": a.specialty,
        "appointment_datetime": a.appointment_datetime.isoformat() if a.appointment_datetime else None,
        "status": a.status,
    } for a in appointments_query]

    return {
        "patients": patients,
        "sessions": sessions,
        "appointments": appointments
    }
