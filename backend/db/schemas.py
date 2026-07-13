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
    primary_finding: str = ""
    acr_category: str = ""
    acr_description: str = ""
    measurements: str = ""
    distribution: str = ""
    differential_diagnoses: List[str] = []
    clinical_correlation: str = ""
    follow_up_imaging: str = ""
    anomaly_type: str = ""
    urgency: str = "routine"
    # Rich vision analysis fields
    clinical_impression: str = ""
    overall_assessment: str = ""
    confidence_reasoning: str = ""
    systematic_findings: Dict[str, Any] = {}
    primary_finding_detail: Dict[str, Any] = {}
    secondary_findings: List[Dict[str, Any]] = []
    differential_diagnoses_detail: List[Dict[str, Any]] = []
    red_flags: List[Dict[str, Any]] = []
    comparison_note: str = ""
    icd10_codes: List[Dict[str, str]] = []
    report_text: str = ""
    body_region: str = ""
    # Honesty / provenance fields
    pathology_scores: Dict[str, Any] = {}
    measurements_enabled: bool = False
    classifier_available: bool = False
    provenance: Dict[str, Any] = {}
    disclaimer: str = ""

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
    # Core fields
    report_type: str = ""
    patient_info: Dict[str, Any] = {}
    abnormal_values: List[Dict[str, Any]] = []
    normal_values: List[Dict[str, Any]] = []
    diagnoses: List[str] = []
    procedures: List[str] = []
    allergies: List[str] = []
    critical_alerts: List[Any] = []
    overall_health_score: str = ""
    patient_action_items: List[str] = []
    follow_up_instructions: List[str] = []
    doctor_info: str = ""
    facility: str = ""
    report_date: str = ""
    # Rich analysis fields
    extraction_method: str = ""
    executive_summary: str = ""
    overall_health_score_numeric: int = 0
    overall_status: str = ""
    patient_plain_language_summary: str = ""
    clinician_summary: str = ""
    action_items: List[Dict[str, Any]] = []
    specialist_referrals: List[Dict[str, Any]] = []
    lifestyle_recommendations: List[str] = []
    follow_up_tests: List[Dict[str, Any]] = []
    icd10_codes: List[Dict[str, str]] = []
    drug_lab_interactions: List[Dict[str, Any]] = []
    medications_mentioned: List[Dict[str, Any]] = []

# --- API Response Models ---

class PatientBase(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    age: int
    gender: str
    date_of_birth: Optional[str] = None
    blood_type: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    allergies: Optional[str] = None
    chronic_conditions: Optional[str] = None
    insurance_id: Optional[str] = None

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

class UserProfileUpdate(BaseModel):
    medical_license_number: Optional[str] = None
    specialization: Optional[str] = None
    hospital_name: Optional[str] = None
    years_of_practice: Optional[int] = None
    date_of_birth: Optional[str] = None
    blood_type: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    existing_conditions: Optional[List[str]] = None
    current_medications: Optional[str] = None
    known_allergies: Optional[str] = None
    previous_surgeries: Optional[str] = None
    language_preference: Optional[str] = None
    onboarding_completed: Optional[bool] = None

class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    patient_code: Optional[str] = None
    avatar_emoji: str = "👤"
    created_at: datetime
    medical_license_number: Optional[str] = None
    specialization: Optional[str] = None
    hospital_name: Optional[str] = None
    years_of_practice: Optional[int] = None
    is_verified: bool = False
    onboarding_completed: bool = False
    date_of_birth: Optional[str] = None
    blood_type: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    existing_conditions: Optional[List[str]] = None
    current_medications: Optional[str] = None
    known_allergies: Optional[str] = None
    previous_surgeries: Optional[str] = None
    language_preference: str = "en"
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut

# --- Drug Interaction Schemas ---
class DrugInteractionRequest(BaseModel):
    drugs: List[str]

class DrugInteractionResult(BaseModel):
    overall_risk: str = "safe"
    interaction_count: Dict[str, int] = {}
    interactions: List[Dict[str, Any]] = []
    safe_pairs: List[Dict[str, Any]] = []
    overall_recommendations: List[str] = []

# --- Second Opinion Schemas ---
class SecondOpinionResult(BaseModel):
    session_id: int
    opinions: Dict[str, Any] = {}
    synthesis: Dict[str, Any] = {}
