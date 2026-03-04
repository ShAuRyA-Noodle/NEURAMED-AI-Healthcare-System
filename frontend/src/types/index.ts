export type AgentType = 'voice' | 'imaging' | 'ocr'
export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical'
export type ScanType = 'CT Scan' | 'MRI' | 'X-Ray' | 'Ultrasound'
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled'

export interface DiagnosisResult {
    session_id: number
    conditions: string[]
    confidence: number
    urgency: UrgencyLevel
    recommendations: string[]
    transcript: string
    processing_time_ms: number
    differential_diagnosis?: string
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
    recommendations?: string[]
    follow_up?: string
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
}

export interface ReportAnalysisResult {
    session_id: number
    sections: Record<string, string>
    key_findings: string[]
    abnormal_flags: string[]
    medications: string[]
    summary: string
    extracted_text: string
    conditions?: string[]
    urgency?: string
}

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

export interface ActivityFeedItem {
    id: number
    patient_code: string
    agent_type: AgentType
    condition: string
    confidence: number
    urgency: UrgencyLevel
    timestamp: string
}

export interface Patient {
    id: number
    patient_code: string
    age: number
    gender: string
    created_at: string
    session_count?: number
    last_session?: DiagnosisSession
}

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

export interface Appointment {
    id: number
    patient_id: number
    patient_code: string
    doctor_name: string
    specialty: string
    appointment_datetime: string
    reason: string
    status: AppointmentStatus
    created_at: string
}
