import type { DashboardStats } from '../types'

export const fallbackStats: DashboardStats = {
    total_diagnoses: 125,
    active_sessions_today: 4,
    avg_confidence: 0.88,
    reports_today: 12,
    diagnoses_last_30_days: [
        { date: '2023-10-01', voice: 15, imaging: 8, ocr: 5 },
        { date: '2023-10-02', voice: 18, imaging: 12, ocr: 7 },
        { date: '2023-10-03', voice: 12, imaging: 9, ocr: 4 },
    ],
    agent_performance: [
        { agent: 'voice', accuracy: 0.94, speed_score: 98, volume: 450, confidence: 0.89 },
        { agent: 'imaging', accuracy: 0.91, speed_score: 85, volume: 210, confidence: 0.82 },
        { agent: 'ocr', accuracy: 0.96, speed_score: 95, volume: 180, confidence: 0.93 },
    ],
    condition_distribution: [
        { condition: 'Hypertension', count: 45 },
        { condition: 'Pneumonia', count: 32 },
        { condition: 'Diabetes Type 2', count: 28 },
        { condition: 'Bronchitis', count: 18 },
        { condition: 'Arrhythmia', count: 15 },
    ],
    urgency_breakdown: {
        low: 45,
        medium: 30,
        high: 15,
        critical: 5
    },
    system_health: {
        api_latency_ms: 42,
        model_uptime_pct: 99.98,
        queue_depth: 3,
        gpu_utilization_pct: 68,
        memory_pct: 71
    }
}
