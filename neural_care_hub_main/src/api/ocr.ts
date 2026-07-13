import client from './client'
import type { ReportAnalysisResult } from '../types'

export const analyzeReport = (file: File, patientId?: number) => {
  const formData = new FormData()
  formData.append('file', file)
  if (patientId) formData.append('patient_id', String(patientId))
  return client.post<ReportAnalysisResult>('/api/ocr/analyze-report', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data)
}
