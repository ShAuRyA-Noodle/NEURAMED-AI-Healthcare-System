from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class Patient(Base):
    __tablename__ = "patients"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_code = Column(String, unique=True, index=True) # PT-XXXX
    age = Column(Integer)
    gender = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    sessions = relationship("DiagnosisSession", back_populates="patient")
    appointments = relationship("Appointment", back_populates="patient")

class DiagnosisSession(Base):
    __tablename__ = "diagnosis_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    agent_type = Column(String) # 'voice', 'imaging', 'ocr'
    input_summary = Column(String)
    result_json = Column(JSON)
    confidence_score = Column(Float)
    urgency_level = Column(String)
    conditions_detected = Column(JSON)
    processing_time_ms = Column(Integer)
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

class Appointment(Base):
    __tablename__ = "appointments"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    doctor_name = Column(String)
    specialty = Column(String)
    appointment_datetime = Column(DateTime)
    reason = Column(String)
    status = Column(String, default="scheduled")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    patient = relationship("Patient", back_populates="appointments")
