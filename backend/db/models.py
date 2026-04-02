from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    patient_code = Column(String, unique=True, index=True)  # PT-XXXX
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    age = Column(Integer)
    gender = Column(String)
    date_of_birth = Column(String, nullable=True)
    blood_type = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    address = Column(String, nullable=True)
    emergency_contact = Column(String, nullable=True)
    allergies = Column(String, nullable=True)
    chronic_conditions = Column(String, nullable=True)
    insurance_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    sessions = relationship("DiagnosisSession", back_populates="patient")
    appointments = relationship("Appointment", back_populates="patient")

class DiagnosisSession(Base):
    __tablename__ = "diagnosis_sessions"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=True)
    agent_type = Column(String) # 'voice', 'imaging', 'ocr'
    input_summary = Column(String)
    result_json = Column(JSON)
    confidence_score = Column(Float)
    urgency_level = Column(String)
    conditions_detected = Column(JSON)
    processing_time_ms = Column(Integer)
    is_deleted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="sessions")
    scan_results = relationship("ScanResult", back_populates="session")
    reports = relationship("Report", back_populates="session")

class ScanResult(Base):
    __tablename__ = "scan_results"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("diagnosis_sessions.id"))
    scan_type = Column(String)
    original_file_path = Column(String)
    annotated_file_path = Column(String)
    anomaly_detected = Column(Boolean)
    anomaly_regions = Column(JSON)
    confidence_score = Column(Float)
    model_findings = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    session = relationship("DiagnosisSession", back_populates="scan_results")

class Report(Base):
    __tablename__ = "reports"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("diagnosis_sessions.id"))
    extracted_text = Column(String)
    sections = Column(JSON)
    key_findings = Column(JSON)
    abnormal_flags = Column(JSON)
    medications = Column(JSON)
    summary = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    session = relationship("DiagnosisSession", back_populates="reports")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="patient")  # "doctor" or "patient"
    patient_code = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    avatar_emoji = Column(String, default="👤")
    # Doctor profile fields
    medical_license_number = Column(String, nullable=True)
    specialization = Column(String, nullable=True)
    hospital_name = Column(String, nullable=True)
    years_of_practice = Column(Integer, nullable=True)
    is_verified = Column(Boolean, default=False)
    onboarding_completed = Column(Boolean, default=False)
    # Patient profile fields
    date_of_birth = Column(String, nullable=True)
    blood_type = Column(String, nullable=True)
    height_cm = Column(Float, nullable=True)
    weight_kg = Column(Float, nullable=True)
    emergency_contact_name = Column(String, nullable=True)
    emergency_contact_phone = Column(String, nullable=True)
    existing_conditions = Column(JSON, nullable=True)
    current_medications = Column(String, nullable=True)
    known_allergies = Column(String, nullable=True)
    previous_surgeries = Column(String, nullable=True)
    language_preference = Column(String, default="en")

class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=True)
    doctor_name = Column(String)
    specialty = Column(String)
    appointment_datetime = Column(DateTime)
    reason = Column(String)
    status = Column(String, default="scheduled")
    appointment_type = Column(String, default="initial")  # initial|follow_up|emergency|teleconsult
    notes = Column(String, nullable=True)
    reminder_sent = Column(Boolean, default=False)
    duration_minutes = Column(Integer, default=30)
    location = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="appointments")
