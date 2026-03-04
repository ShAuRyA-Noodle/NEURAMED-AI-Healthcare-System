from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
from datetime import datetime

# --- Pydantic Schemas ---
# --- Return schemas from Agents ---
class DiagnosisResult(BaseModel):
    conditions: List[str]
    confidence: float
    urgency: str
    recommendations: List[str]
    transcript: str
    processing_time_ms: int
    session_id: int
    differential_diagnosis: str = ""

class ScanAnalysisResult(BaseModel):
    anomaly_detected: bool
    anomaly_regions: List[Dict[str, Any]]
    confidence: float
    findings: str
    scan_type: str
    original_image_b64: str
    annotated_image_b64: str
    session_id: int
    impression: str = ""
    recommendations: List[str] = []
    follow_up: str = ""

class ReportAnalysisResult(BaseModel):
    sections: Dict[str, str]
    key_findings: List[str]
    abnormal_flags: List[str]
    medications: List[str]
    summary: str
    extracted_text: str
    session_id: int
    conditions: List[str] = []
    urgency: str = "low"

# --- API Response Models ---

class PatientBase(BaseModel):
    age: int
    gender: str

class PatientCreate(PatientBase):
    pass

class PatientResponse(PatientBase):
    id: int
    patient_code: str
    created_at: datetime
    class Config:
        from_attributes = True

class DiagnosisSessionBase(BaseModel):
    agent_type: str
    input_summary: str
    result_json: Dict[str, Any]
    confidence_score: float
    urgency_level: str
    conditions_detected: List[str]
    processing_time_ms: int

class DiagnosisSessionCreate(DiagnosisSessionBase):
    patient_id: Optional[int] = None

class DiagnosisSessionResponse(DiagnosisSessionBase):
    id: int
    patient_id: Optional[int]
    created_at: datetime
    class Config:
        from_attributes = True

class ScanResultBase(BaseModel):
    scan_type: str
    original_file_path: str
    annotated_file_path: Optional[str] = None
    anomaly_detected: bool
    anomaly_regions: List[Dict[str, Any]]
    confidence_score: float
    model_findings: str

class ScanResultCreate(ScanResultBase):
    session_id: int

class ScanResultResponse(ScanResultBase):
    id: int
    session_id: int
    created_at: datetime
    class Config:
        from_attributes = True

class ReportBase(BaseModel):
    extracted_text: str
    sections: Dict[str, str]
    key_findings: List[str]
    abnormal_flags: List[str]
    medications: List[str]
    summary: str

class ReportCreate(ReportBase):
    session_id: int

class ReportResponse(ReportBase):
    id: int
    session_id: int
    created_at: datetime
    class Config:
        from_attributes = True

class AppointmentBase(BaseModel):
    doctor_name: str
    specialty: str
    appointment_datetime: datetime
    reason: str
    status: Optional[str] = "scheduled"

class AppointmentCreate(AppointmentBase):
    patient_id: int

class AppointmentResponse(AppointmentBase):
    id: int
    patient_id: int
    created_at: datetime
    class Config:
        from_attributes = True


class DashboardStats(BaseModel):
    total_diagnoses: int
    active_sessions_today: int
    avg_confidence: float
    reports_today: int
    diagnoses_last_30_days: List[Dict[str, Any]]
    agent_performance: List[Dict[str, Any]]
    condition_distribution: List[Dict[str, Any]]
    urgency_breakdown: Dict[str, int]
    system_health: Dict[str, Any]

class ActivityFeedItem(BaseModel):
    patient_code: str
    agent_type: str
    condition: str
    confidence: float
    urgency: str
    timestamp: datetime
