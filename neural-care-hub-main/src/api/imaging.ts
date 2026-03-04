import client from './client'
import type { ScanAnalysisResult, DiagnosisSession } from '../types'

export const analyzeImage = (file: File, scanType: string, patientId?: number) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('scan_type', scanType)
  if (patientId) formData.append('patient_id', String(patientId))

  return client.post<ScanAnalysisResult>('/api/imaging/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data)
}

export const getScans = (limit = 20) =>
  client.get<DiagnosisSession[]>(`/api/imaging/scans?limit=${limit}`).then(r => r.data)
