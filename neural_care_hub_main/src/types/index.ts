export type AgentType = 'voice' | 'imaging' | 'ocr'
export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical'
export type ScanType = 'CT Scan' | 'MRI' | 'X-Ray' | 'Ultrasound'
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled'
export type AppointmentType = 'initial' | 'follow_up' | 'emergency' | 'teleconsult'

// --- Voice Agent Types ---
export interface ConditionDetail {
    name: string
    probability: number
    icd_code: string
    description: string
    matching_symptoms: string[]
    red_flags: string[]
}

export interface RecommendedTest {
    test: string
    reason: string
}

export interface DiagnosisResult {
    session_id: number
    conditions: ConditionDetail[]
    overall_confidence: number
    urgency: UrgencyLevel | string
    urgency_reasoning: string
    immediate_actions: string[]
    recommended_tests: RecommendedTest[]
    medications_to_avoid: string[]
    lifestyle_advice: string[]
    follow_up: string
    differential_summary: string
    when_to_go_to_er: string
    transcript: string
    processing_time_ms: number
    // Backward compat
    confidence: number
    recommendations: string[]
    differential_diagnosis?: string
}

// --- Imaging Agent Types ---
export interface RecommendationItem {
    priority: 'immediate' | 'routine' | 'optional'
    action: string
}

export interface AnomalyRegion {
    id: number
    location: string
    area: number
    circularity: number
    mean_intensity: number
    confidence: number
    is_anomaly?: boolean
    bounding_box?: { x: number; y: number; w: number; h: number }
    size_mm?: string
}

export interface ScanAnalysisResult {
    session_id: number
    anomaly_detected: boolean
    anomaly_regions: AnomalyRegion[]
    confidence: number
    findings: string
    scan_type: string
    original_image_b64: string
    annotated_image_b64: string
    impression?: string
    recommendations?: (string | RecommendationItem | RichRecommendation)[]
    follow_up?: string
    primary_finding?: string
    acr_category?: string
    acr_description?: string
    measurements?: string
    distribution?: string
    differential_diagnoses?: string[]
    clinical_correlation?: string
    follow_up_imaging?: string
    anomaly_type?: string
    urgency?: string
    // Rich vision analysis fields
    clinical_impression?: string
    overall_assessment?: string
    confidence_reasoning?: string
    systematic_findings?: Record<string, SystematicFinding>
    primary_finding_detail?: PrimaryFindingDetail
    secondary_findings?: SecondaryFinding[]
    differential_diagnoses_detail?: DifferentialDiagnosis[]
    red_flags?: RedFlag[]
    comparison_note?: string
    icd10_codes?: { code: string; description: string }[]
    report_text?: string
    body_region?: string
}

export interface RichRecommendation {
    priority: number | string
    action: string
    timeframe?: string
    rationale?: string
    guideline_reference?: string
}

export interface SystematicFinding {
    name: string
    status: 'normal' | 'abnormal'
    finding: string
    significance?: string
    measurement?: string
}

export interface PrimaryFindingDetail {
    description?: string
    location?: string
    size_mm?: number[]
    characteristics?: string[]
    acr_lung_rads?: string
}

export interface SecondaryFinding {
    description: string
    clinical_significance: string
    action_required?: string
}

export interface DifferentialDiagnosis {
    diagnosis: string
    probability: number
    icd10?: string
    supporting_features?: string[]
    against_features?: string[]
    next_step?: string
}

export interface RedFlag {
    finding: string
    urgency: string
    action: string
    guideline?: string
}

// --- OCR Agent Types ---
export interface AbnormalValue {
    test: string
    value: string
    normal_range: string
    interpretation: string
    severity: 'critical' | 'high' | 'medium' | 'low'
}

export interface NormalValue {
    test: string
    value: string
    normal_range: string
}

export interface MedicationDetail {
    name: string
    dose: string
    frequency: string
    purpose: string
}

export interface ReportAnalysisResult {
    session_id: number
    sections: Record<string, string>
    key_findings: string[]
    abnormal_flags: string[]
    medications: (string | MedicationDetail)[]
    summary: string
    extracted_text: string
    conditions?: string[]
    urgency?: string
    report_type?: string
    patient_info?: { name_redacted?: boolean; age_mentioned?: string | null; gender_mentioned?: string | null }
    abnormal_values?: RichAbnormalValue[]
    normal_values?: NormalValue[]
    diagnoses?: string[]
    procedures?: string[]
    allergies?: string[]
    critical_alerts?: (string | CriticalAlert)[]
    overall_health_score?: string
    patient_action_items?: string[]
    follow_up_instructions?: string[]
    doctor_info?: string
    facility?: string
    report_date?: string
    // Rich analysis fields
    extraction_method?: string
    executive_summary?: string
    overall_health_score_numeric?: number
    overall_status?: string
    patient_plain_language_summary?: string
    clinician_summary?: string
    action_items?: ActionItem[]
    specialist_referrals?: SpecialistReferral[]
    lifestyle_recommendations?: string[]
    follow_up_tests?: FollowUpTest[]
    icd10_codes?: { code: string; description: string }[]
    drug_lab_interactions?: DrugLabInteraction[]
    medications_mentioned?: RichMedication[]
}

export interface RichAbnormalValue {
    parameter?: string
    test?: string
    value: string
    unit?: string
    reference_range?: string
    normal_range?: string
    deviation_percent?: number
    deviation_direction?: string
    severity: string
    clinical_meaning?: string
    interpretation?: string
    contributing_factors?: string[]
    what_to_do?: string
}

export interface CriticalAlert {
    parameter: string
    value: string
    reason: string
    immediate_action: string
    severity: string
}

export interface ActionItem {
    priority: number
    urgency: string
    action: string
    timeframe: string
}

export interface SpecialistReferral {
    specialty: string
    reason: string
    urgency: string
}

export interface FollowUpTest {
    test: string
    reason: string
    timeframe: string
}

export interface DrugLabInteraction {
    drug: string
    lab_finding: string
    interaction: string
    action: string
}

export interface RichMedication {
    name: string
    dose?: string
    frequency?: string
    purpose?: string
    drug_lab_flags?: string[]
}

// --- Dashboard Types ---
export interface DashboardStats {
    total_diagnoses: number
    active_sessions_today: number
    avg_confidence: number
    reports_today: number
    diagnoses_last_30_days: DailyDiagnosisData[]
    agent_performance: AgentPerformance[]
    condition_distribution: ConditionCount[]
    urgency_breakdown: { low: number; medium: number; high: number; critical: number }
    system_health: SystemHealth
}

export interface DailyDiagnosisData {
    date: string
    voice: number
    imaging: number
    ocr: number
}

export interface AgentPerformance {
    agent: AgentType
    accuracy: number
    speed_score: number
    volume: number
    confidence: number
}

export interface ConditionCount {
    condition: string
    count: number
}

export interface SystemHealth {
    api_latency_ms: number
    model_uptime_pct: number
    queue_depth: number
    gpu_utilization_pct: number
    memory_pct: number
}

export interface QuickStats {
    total_voice: number
    total_imaging: number
    total_ocr: number
    upcoming_appointments: number
    total_patients: number
    critical_today: number
    avg_processing_time_ms: number
}

export interface AIInsight {
    title: string
    description: string
    icon_emoji: string
    severity: 'high' | 'medium' | 'low'
}

export interface UrgencyHeatmapCell {
    day: string
    urgency: string
    count: number
}

export interface UrgencyHeatmapData {
    heatmap: UrgencyHeatmapCell[]
    days: string[]
    urgencies: string[]
}

export interface ActivityFeedItem {
    id: number
    patient_code: string
    agent_type: AgentType
    condition: string
    confidence: number
    urgency: UrgencyLevel
    timestamp: string
}

// --- System Types ---
export interface SystemInfo {
    server_start_time: string
    uptime_seconds: number
    total_sessions: number
    groq_key_present: boolean
    elevenlabs_key_present: boolean
    tesseract_available: boolean
    database_size_mb: number
    python_version: string
    environment: string
}

// --- Search Types ---
export interface SearchResults {
    patients: { id: number; patient_code: string; age: number; gender: string }[]
    sessions: { id: number; patient_code: string; agent_type: AgentType; conditions_detected: string[]; urgency_level: string; created_at: string }[]
    appointments: { id: number; patient_code: string; doctor_name: string; specialty: string; appointment_datetime: string; status: string }[]
}

// --- Patient Types ---
export interface Patient {
    id: number
    patient_code: string
    age: number
    gender: string
    created_at: string
    session_count?: number
    total_sessions?: number
    last_session?: DiagnosisSession
    last_session_agent?: string
    last_session_urgency?: string
    last_session_date?: string
    most_common_condition?: string
    total_conditions_detected?: string[]
    risk_score?: number
    demographics?: { age: number; gender: string; blood_type: string }
}

export interface PatientDetail extends Patient {
    sessions: SessionListItem[]
    condition_frequency: Record<string, number>
    agent_usage: Record<string, number>
}

// --- Session Types ---
export interface DiagnosisSession {
    id: number
    patient_id: number
    patient_code: string
    agent_type: AgentType
    input_summary: string
    result_json: Record<string, unknown>
    confidence_score: number
    urgency_level: UrgencyLevel
    conditions_detected: string[]
    processing_time_ms: number
    created_at: string
}

export interface SessionListItem {
    id: number
    patient_code: string
    patient_id: number
    agent_type: AgentType
    confidence_score: number
    urgency_level: string
    conditions_detected: string[]
    input_summary: string
    processing_time_ms: number
    created_at: string
}

export interface SessionDetail extends SessionListItem {
    recommendations: string[]
    transcript_or_findings: string
    result_json: Record<string, unknown>
    related_sessions: SessionListItem[]
}

export interface SessionStats {
    total: number
    today: number
    this_week: number
    by_agent: Record<string, number>
    by_urgency: Record<string, number>
    avg_confidence: number
    avg_processing_time: number
}

// --- Appointment Types ---
export interface Appointment {
    id: number
    patient_id: number
    patient_code: string
    doctor_name: string
    specialty: string
    appointment_datetime: string
    reason: string
    status: AppointmentStatus
    appointment_type?: string
    notes?: string
    duration_minutes?: number
    location?: string
    time_until_minutes?: number | null
    created_at: string
}

export interface AppointmentStats {
    total: number
    scheduled: number
    completed: number
    cancelled: number
    today_count: number
    this_week_count: number
    completion_rate: number
}

// --- Auth Types ---
export interface User {
    id: number
    email: string
    full_name: string
    role: 'doctor' | 'patient'
    patient_code: string | null
    avatar_emoji: string
    created_at: string
    medical_license_number?: string
    specialization?: string
    hospital_name?: string
    years_of_practice?: number
    is_verified?: boolean
    onboarding_completed?: boolean
    date_of_birth?: string
    blood_type?: string
    height_cm?: number
    weight_kg?: number
    emergency_contact_name?: string
    emergency_contact_phone?: string
    existing_conditions?: string[]
    current_medications?: string
    known_allergies?: string
    previous_surgeries?: string
    language_preference?: string
}

// --- Drug Interaction Types ---
export interface DrugInteractionResult {
    overall_risk: string
    interaction_count: Record<string, number>
    interactions: DrugInteraction[]
    safe_pairs: SafePair[]
    overall_recommendations: string[]
}

export interface DrugInteraction {
    drug_a: string
    drug_b: string
    severity: string
    severity_score: number
    mechanism: string
    clinical_effect: string
    onset?: string
    documentation?: string
    management: string
    alternatives?: { replace: string; with: string; note: string }[]
    references?: string[]
}

export interface SafePair {
    drug_a: string
    drug_b: string
    note: string
}

// --- Timeline Types ---
export interface TimelineData {
    patient_id: number
    patient_code: string
    total_sessions: number
    date_range: { first: string | null; last: string | null }
    timeline: TimelineEntry[]
    health_score_series: { date: string; score: number }[]
    trend_analysis: TrendAnalysis | null
}

export interface TimelineEntry {
    id: number
    date: string
    agent_type: string
    urgency: string
    primary_conditions: string[]
    health_score: number | null
    summary: string
    confidence: number
}

export interface TrendAnalysis {
    overall_trajectory: string
    trajectory_confidence: number
    trajectory_summary: string
    improving_conditions: TrendCondition[]
    worsening_conditions: TrendCondition[]
    new_conditions: NewCondition[]
    recurring_conditions: RecurringCondition[]
    specialist_referral_recommended: SpecialistReferral[]
    risk_trend: { month: string; risk_score: number }[]
}

export interface TrendCondition {
    condition: string
    evidence: string
    timeline: string
}

export interface NewCondition {
    condition: string
    first_appeared: string
    current_status: string
    sessions_count: number
}

export interface RecurringCondition {
    condition: string
    occurrences: number
    pattern: string
    possible_cause: string
}

// --- Second Opinion Types ---
export interface SecondOpinionResult {
    session_id: number
    opinions: {
        conservative: PhysicianOpinion
        balanced: PhysicianOpinion
        differential: PhysicianOpinion
    }
    synthesis: OpinionSynthesis
}

export interface PhysicianOpinion {
    physician_id: string
    primary_diagnosis: string
    confidence: number
    reasoning: string
    agreed_findings: string[]
    disputed_findings: string[]
    additional_diagnoses: string[]
    recommended_tests: string[]
    urgency_assessment: string
    key_message: string
}

export interface OpinionSynthesis {
    consensus_level: string
    consensus_diagnosis: string | null
    majority_diagnosis: string | null
    agreement_areas: string[]
    dispute_areas: string[]
    synthesized_recommendation: string
    clinical_note: string
}

// --- Sarvam Types ---
export interface SarvamHealthStatus {
    ollama_running: boolean
    sarvam_available: boolean
    available_models: string[]
    model?: string
    note?: string
}

export interface SarvamDiagnoseResult {
    session_id?: number
    response_native: string
    response_english: string
    urgency: string
    primary_concern: string
    immediate_advice_native?: string
    see_doctor_urgency?: string
    medical_terms_explained?: { term: string; native_explanation: string }[]
}

export interface AuthToken {
    access_token: string
    token_type: string
    user: User
}

export interface LoginCredentials {
    email: string
    password: string
}

export interface RegisterData {
    email: string
    full_name: string
    password: string
    role: 'doctor' | 'patient'
    invite_code?: string
}
