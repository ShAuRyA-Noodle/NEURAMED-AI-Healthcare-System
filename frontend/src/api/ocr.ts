import client from './client'
import type { ReportAnalysisResult, DiagnosisSession } from '../types'

export const analyzeReport = (file: File, patientId?: number) => {
  const formData = new FormData()
  formData.append('file', file)
  if (patientId) formData.append('patient_id', String(patientId))
  return client.post<ReportAnalysisResult>('/api/ocr/analyze-report', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data)
}

export const getReports = (limit = 20) =>
  client.get<DiagnosisSession[]>(`/api/ocr/reports?limit=${limit}`).then(r => r.data)
