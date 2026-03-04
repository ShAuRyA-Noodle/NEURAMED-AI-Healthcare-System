from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel
from backend.db.database import get_db
from backend.agents import appointment_agent
from backend.db.models import Appointment, Patient
from backend.db.schemas import AppointmentCreate, AppointmentResponse

router = APIRouter(prefix="/api/appointments", tags=["Appointments"])


class StatusUpdate(BaseModel):
    status: str


@router.post("", response_model=AppointmentResponse)
def create_appointment(app_req: AppointmentCreate, db: Session = Depends(get_db)):
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
            reason=app_req.reason
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
def get_appointments(patient_id: Optional[int] = None, status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Appointment)
    if patient_id:
        query = query.filter(Appointment.patient_id == patient_id)
    if status:
        query = query.filter(Appointment.status == status)
    appointments = query.order_by(Appointment.appointment_datetime.asc()).all()

    result = []
    for a in appointments:
        p_code = a.patient.patient_code if a.patient else f"PT-{a.patient_id}"
        result.append({
            "id": a.id,
            "patient_id": a.patient_id,
            "patient_code": p_code,
            "doctor_name": a.doctor_name,
            "specialty": a.specialty,
            "appointment_datetime": a.appointment_datetime.isoformat() if a.appointment_datetime else None,
            "reason": a.reason,
            "status": a.status,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })
    return result


@router.patch("/{appointment_id}/status")
def update_status(appointment_id: int, body: StatusUpdate, db: Session = Depends(get_db)):
    valid_statuses = ["scheduled", "completed", "cancelled"]
    if body.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    app = appointment_agent.update_status(db=db, appointment_id=appointment_id, status=body.status)
    if not app:
        raise HTTPException(status_code=404, detail="Appointment not found")

    p_code = app.patient.patient_code if app.patient else f"PT-{app.patient_id}"
    return {
        "id": app.id,
        "patient_id": app.patient_id,
        "patient_code": p_code,
        "doctor_name": app.doctor_name,
        "specialty": app.specialty,
        "appointment_datetime": app.appointment_datetime.isoformat() if app.appointment_datetime else None,
        "reason": app.reason,
        "status": app.status,
        "created_at": app.created_at.isoformat() if app.created_at else None,
    }
