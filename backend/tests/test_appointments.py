from datetime import datetime, timedelta
from agents import appointment_agent


def test_no_conflict_when_no_appointments(db_session):
    start = datetime(2026, 8, 1, 10, 0)
    assert appointment_agent.has_conflict(db_session, "Dr. Smith", start, 30) is False


def test_detects_overlapping_appointment(db_session):
    from db.models import Appointment
    existing = Appointment(
        doctor_name="Dr. Smith",
        appointment_datetime=datetime(2026, 8, 1, 10, 0),
        duration_minutes=30, status="scheduled", specialty="Cardiology", reason="x",
    )
    db_session.add(existing); db_session.commit()
    # starts 15 min into the existing 30-min slot => overlap
    assert appointment_agent.has_conflict(db_session, "Dr. Smith", datetime(2026, 8, 1, 10, 15), 30) is True


def test_adjacent_appointments_do_not_conflict(db_session):
    from db.models import Appointment
    existing = Appointment(
        doctor_name="Dr. Smith",
        appointment_datetime=datetime(2026, 8, 1, 10, 0),
        duration_minutes=30, status="scheduled", specialty="Cardiology", reason="x",
    )
    db_session.add(existing); db_session.commit()
    # starts exactly when the first ends => no overlap
    assert appointment_agent.has_conflict(db_session, "Dr. Smith", datetime(2026, 8, 1, 10, 30), 30) is False


def test_cancelled_appointments_ignored(db_session):
    from db.models import Appointment
    existing = Appointment(
        doctor_name="Dr. Smith",
        appointment_datetime=datetime(2026, 8, 1, 10, 0),
        duration_minutes=30, status="cancelled", specialty="Cardiology", reason="x",
    )
    db_session.add(existing); db_session.commit()
    assert appointment_agent.has_conflict(db_session, "Dr. Smith", datetime(2026, 8, 1, 10, 15), 30) is False


def test_different_doctor_no_conflict(db_session):
    from db.models import Appointment
    existing = Appointment(
        doctor_name="Dr. Smith",
        appointment_datetime=datetime(2026, 8, 1, 10, 0),
        duration_minutes=30, status="scheduled", specialty="Cardiology", reason="x",
    )
    db_session.add(existing); db_session.commit()
    assert appointment_agent.has_conflict(db_session, "Dr. Jones", datetime(2026, 8, 1, 10, 15), 30) is False


def test_exclude_id_ignores_the_appointment_itself(db_session):
    from db.models import Appointment
    existing = Appointment(
        doctor_name="Dr. Smith",
        appointment_datetime=datetime(2026, 8, 1, 10, 0),
        duration_minutes=30, status="scheduled", specialty="Cardiology", reason="x",
    )
    db_session.add(existing); db_session.commit()
    # Rescheduling the same appointment to an overlapping slot must not conflict with itself
    assert appointment_agent.has_conflict(
        db_session, "Dr. Smith", datetime(2026, 8, 1, 10, 10), 30, exclude_id=existing.id
    ) is False


def test_create_appointment_raises_on_conflict(db_session):
    from db.models import Appointment, Patient
    patient = Patient(patient_code="PT-0001", first_name="A", last_name="B", age=30, gender="F")
    db_session.add(patient); db_session.commit()
    appointment_agent.create_appointment(
        db=db_session, patient_id=patient.id, doctor_name="Dr. Smith",
        specialty="Cardiology", appointment_datetime=datetime(2026, 8, 1, 10, 0),
        reason="checkup", duration_minutes=30,
    )
    import pytest
    with pytest.raises(appointment_agent.SchedulingConflictError):
        appointment_agent.create_appointment(
            db=db_session, patient_id=patient.id, doctor_name="Dr. Smith",
            specialty="Cardiology", appointment_datetime=datetime(2026, 8, 1, 10, 15),
            reason="checkup2", duration_minutes=30,
        )


def test_http_post_conflicting_appointment_returns_409(auth_client, db_session):
    from db.models import Patient
    patient = Patient(patient_code="PT-0009", first_name="C", last_name="D", age=40, gender="M")
    db_session.add(patient); db_session.commit()

    payload = {
        "patient_id": patient.id,
        "doctor_name": "Dr. House",
        "specialty": "Diagnostics",
        "appointment_datetime": "2026-08-01T10:00:00",
        "reason": "eval",
        "duration_minutes": 30,
        "location": "Room 5",
    }
    first = auth_client.post("/api/appointments", json=payload)
    assert first.status_code == 200, first.text
    assert first.json()["location"] == "Room 5"

    payload2 = dict(payload, appointment_datetime="2026-08-01T10:15:00", reason="eval2")
    second = auth_client.post("/api/appointments", json=payload2)
    assert second.status_code == 409, second.text
    assert "overlap" in second.json()["detail"].lower()
