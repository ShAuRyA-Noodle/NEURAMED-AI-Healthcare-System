from sqlalchemy.orm import Session
from db.models import Appointment
from datetime import datetime, timedelta


class SchedulingConflictError(Exception):
    """Raised when a new/rescheduled appointment overlaps an existing one
    for the same doctor. Routers should turn this into HTTP 409."""
    pass


def has_conflict(db: Session, doctor_name: str, start: datetime, duration_minutes: int, exclude_id: int = None):
    """True if `doctor_name` has a non-cancelled appointment overlapping
    [start, start+duration). Two intervals overlap iff a.start < b.end and b.start < a.end."""
    end = start + timedelta(minutes=duration_minutes or 30)
    q = db.query(Appointment).filter(
        Appointment.doctor_name == doctor_name,
        Appointment.status != "cancelled",
    )
    if exclude_id is not None:
        q = q.filter(Appointment.id != exclude_id)
    for appt in q.all():
        a_start = appt.appointment_datetime
        if a_start is None:
            continue
        a_end = a_start + timedelta(minutes=(appt.duration_minutes or 30))
        if start < a_end and a_start < end:   # overlap
            return True
    return False


def create_appointment(db: Session, patient_id: int, doctor_name: str, specialty: str, appointment_datetime: datetime, reason: str, appointment_type: str = "initial", duration_minutes: int = 30, location: str = None):
    if has_conflict(db, doctor_name, appointment_datetime, duration_minutes):
        raise SchedulingConflictError(
            f"{doctor_name} already has an appointment overlapping this time window."
        )
    new_app = Appointment(
        patient_id=patient_id,
        doctor_name=doctor_name,
        specialty=specialty,
        appointment_datetime=appointment_datetime,
        reason=reason,
        status="scheduled",
        appointment_type=appointment_type,
        duration_minutes=duration_minutes,
        location=location,
    )
    db.add(new_app)
    db.commit()
    db.refresh(new_app)
    return new_app

def get_appointments(db: Session, patient_id: int = None, status: str = None):
    query = db.query(Appointment)
    if patient_id:
        query = query.filter(Appointment.patient_id == patient_id)
    if status:
        query = query.filter(Appointment.status == status)
    return query.all()

def update_status(db: Session, appointment_id: int, status: str):
    app = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if app:
        app.status = status
        db.commit()
        db.refresh(app)
    return app
