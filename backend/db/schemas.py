from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any, Union
from datetime import datetime

# --- Pydantic Schemas ---

# --- Voice Agent sub-models ---
class ConditionDetail(BaseModel):
    name: str
    probability: float
    icd_code: str = ""
    description: str = ""
    matching_symptoms: list[str] = []
    red_flags: list[str] = []

class RecommendedTest(BaseModel):
    test: str
    reason: str

# --- Return schemas from Agents ---
class DiagnosisResult(BaseModel):
    session_id: int
    conditions: list[ConditionDetail] = []
    overall_confidence: float = 0.0
    urgency: str = "medium"
    urgency_reasoning: str = ""
    immediate_actions: list[str] = []
    recommended_tests: list[RecommendedTest] = []
    medications_to_avoid: list[str] = []
    lifestyle_advice: list[str] = []
    follow_up: str = ""
    differential_summary: str = ""
    when_to_go_to_er: str = ""
    transcript: str = ""
    processing_time_ms: int = 0
    # Backward compat — old simple fields
    confidence: float = 0.0
    recommendations: list[str] = []
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
    recommendations: List[Any] = []
    follow_up: str = ""
    # New fields
    primary_finding: str = ""
    acr_category: str = ""
    acr_description: str = ""
    measurements: str = ""
    distribution: str = ""
    differential_diagnoses: list[str] = []
    clinical_correlation: str = ""
    follow_up_imaging: str = ""
    anomaly_type: str = ""
    urgency: str = "routine"

class ReportAnalysisResult(BaseModel):
    sections: Dict[str, str]
    key_findings: List[str]
    abnormal_flags: List[str]
    medications: List[Any] = []
    summary: str
    extracted_text: str
    session_id: int
    conditions: List[str] = []
    urgency: str = "low"
    # New fields
    report_type: str = ""
    patient_info: Dict[str, Any] = {}
    abnormal_values: list[Dict[str, Any]] = []
    normal_values: list[Dict[str, Any]] = []
    diagnoses: list[str] = []
    procedures: list[str] = []
    allergies: list[str] = []
    critical_alerts: list[str] = []
    overall_health_score: str = ""
    patient_action_items: list[str] = []
    follow_up_instructions: list[str] = []
    doctor_info: str = ""
    facility: str = ""
    report_date: str = ""

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
    medications: List[Any]
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
    appointment_type: Optional[str] = "initial"
    notes: Optional[str] = None
    duration_minutes: Optional[int] = 30
    location: Optional[str] = None

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

# --- Auth Schemas ---

class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: str
    invite_code: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    patient_code: Optional[str] = None
    avatar_emoji: str = "👤"
    created_at: datetime
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut

class TokenData(BaseModel):
    user_id: Optional[int] = None
    role: Optional[str] = None
