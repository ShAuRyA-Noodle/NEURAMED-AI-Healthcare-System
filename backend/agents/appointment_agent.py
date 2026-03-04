from sqlalchemy.orm import Session
from backend.db.models import Appointment
from datetime import datetime

def create_appointment(db: Session, patient_id: int, doctor_name: str, specialty: str, appointment_datetime: datetime, reason: str):
    new_app = Appointment(
        patient_id=patient_id,
        doctor_name=doctor_name,
        specialty=specialty,
        appointment_datetime=appointment_datetime,
        reason=reason,
        status="scheduled"
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
