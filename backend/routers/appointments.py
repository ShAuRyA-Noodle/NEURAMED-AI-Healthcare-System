import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime, timedelta
from pydantic import BaseModel
from db.database import get_db
from agents import appointment_agent
from db.models import Appointment, Patient, User
from db.schemas import AppointmentCreate, AppointmentResponse
from utils.auth import require_user, require_doctor

logger = logging.getLogger("neuramed.appointments")

router = APIRouter(prefix="/api/appointments", tags=["Appointments"])


class StatusUpdate(BaseModel):
    status: str


class NotesUpdate(BaseModel):
    notes: str


@router.post("", response_model=AppointmentResponse)
def create_appointment(app_req: AppointmentCreate, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    # Validate patient exists
    patient = db.query(Patient).filter(Patient.id == app_req.patient_id).first()
    if not patient:
        raise HTTPException(status_code=400, detail=f"Patient {app_req.patient_id} not found")
    try:
        return appointment_agent.create_appointment(
            db=db,
            patient_id=app_req.patient_id,
            doctor_name=app_req.doctor_name,
            specialty=app_req.specialty,
            appointment_datetime=app_req.appointment_datetime,
            reason=app_req.reason,
            appointment_type=app_req.appointment_type or "initial",
            duration_minutes=app_req.duration_minutes or 30,
            location=app_req.location,
        )
    except appointment_agent.SchedulingConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except HTTPException:
        raise
    except Exception:
        logger.exception("Appointment creation failed")
        raise HTTPException(status_code=500, detail="Internal error processing request")


def _format_appointment(a):
    p = a.patient
    p_code = p.patient_code if p else "WALK-IN"
    p_name = ""
    if p:
        first = getattr(p, "first_name", "") or ""
        last = getattr(p, "last_name", "") or ""
        p_name = f"{first} {last}".strip()
    now = datetime.utcnow()
    time_until = None
    if a.appointment_datetime and a.appointment_datetime > now:
        time_until = int((a.appointment_datetime - now).total_seconds() / 60)
    return {
        "id": a.id,
        "patient_id": a.patient_id,
        "patient_code": p_code,
        "patient_name": p_name,
        "doctor_name": a.doctor_name,
        "specialty": a.specialty,
        "appointment_datetime": a.appointment_datetime.isoformat() if a.appointment_datetime else None,
        "reason": a.reason,
        "status": a.status,
        "appointment_type": getattr(a, "appointment_type", "initial") or "initial",
        "notes": getattr(a, "notes", None),
        "duration_minutes": getattr(a, "duration_minutes", 30) or 30,
        "location": getattr(a, "location", None),
        "time_until_minutes": time_until,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


@router.get("/stats")
def get_appointment_stats(db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    total = db.query(Appointment).count()
    scheduled = db.query(Appointment).filter(Appointment.status == "scheduled").count()
    completed = db.query(Appointment).filter(Appointment.status == "completed").count()
    cancelled = db.query(Appointment).filter(Appointment.status == "cancelled").count()

    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    today_end = today_start + timedelta(days=1)
    week_start = today_start - timedelta(days=now.weekday())

    today_count = db.query(Appointment).filter(
        Appointment.appointment_datetime >= today_start,
        Appointment.appointment_datetime < today_end
    ).count()

    this_week_count = db.query(Appointment).filter(
        Appointment.appointment_datetime >= week_start,
        Appointment.appointment_datetime < today_end
    ).count()

    completion_rate = round(completed / total * 100, 1) if total > 0 else 0

    return {
        "total": total,
        "scheduled": scheduled,
        "completed": completed,
        "cancelled": cancelled,
        "today_count": today_count,
        "this_week_count": this_week_count,
        "completion_rate": completion_rate
    }


@router.get("/upcoming")
def get_upcoming(db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    now = datetime.utcnow()
    week_ahead = now + timedelta(days=7)
    appointments = db.query(Appointment).filter(
        Appointment.appointment_datetime >= now,
        Appointment.appointment_datetime <= week_ahead,
        Appointment.status == "scheduled"
    ).order_by(Appointment.appointment_datetime.asc()).all()
    return [_format_appointment(a) for a in appointments]


@router.get("/today")
def get_today_appointments(db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    today_end = today_start + timedelta(days=1)
    appointments = db.query(Appointment).filter(
        Appointment.appointment_datetime >= today_start,
        Appointment.appointment_datetime < today_end
    ).order_by(Appointment.appointment_datetime.asc()).all()
    return [_format_appointment(a) for a in appointments]


@router.get("")
def get_appointments(
    patient_id: Optional[int] = None,
    status: Optional[str] = None,
    specialty: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor)
):
    query = db.query(Appointment)
    if patient_id:
        query = query.filter(Appointment.patient_id == patient_id)
    if status:
        query = query.filter(Appointment.status == status)
    if specialty:
        query = query.filter(Appointment.specialty.ilike(f"%{specialty}%"))
    if date_from:
        query = query.filter(Appointment.appointment_datetime >= date_from)
    if date_to:
        query = query.filter(Appointment.appointment_datetime <= date_to)
    appointments = query.order_by(Appointment.appointment_datetime.asc()).all()
    return [_format_appointment(a) for a in appointments]


@router.patch("/{appointment_id}/status")
def update_status(appointment_id: int, body: StatusUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_doctor)):
    valid_statuses = ["scheduled", "completed", "cancelled"]
    if body.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    app = appointment_agent.update_status(db=db, appointment_id=appointment_id, status=body.status)
    if not app:
        raise HTTPException(status_code=404, detail="Appointment not found")

    return _format_appointment(app)


@router.patch("/{appointment_id}/notes")
def add_notes(appointment_id: int, body: NotesUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_doctor)):
    app = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Appointment not found")
    app.notes = body.notes
    db.commit()
    db.refresh(app)
    return _format_appointment(app)
