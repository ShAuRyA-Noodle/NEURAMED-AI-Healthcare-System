import client from './client'
import type { ScanAnalysisResult, DiagnosisSession, SecondOpinionResult } from '../types'

export const analyzeImage = ({
  file, scanType, patientId, bodyRegion, clinicalIndication, patientAge, patientGender
}: {
  file: File
  scanType: string
  patientId?: number
  bodyRegion?: string
  clinicalIndication?: string
  patientAge?: number
  patientGender?: string
}) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('scan_type', scanType)
  if (patientId) formData.append('patient_id', String(patientId))
  if (bodyRegion) formData.append('body_region', bodyRegion)
  if (clinicalIndication) formData.append('clinical_indication', clinicalIndication)
  if (patientAge) formData.append('patient_age', String(patientAge))
  if (patientGender) formData.append('patient_gender', patientGender)

  return client.post<ScanAnalysisResult>('/api/imaging/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  }).then(r => r.data)
}

export const getScans = (limit = 20) =>
  client.get<DiagnosisSession[]>(`/api/imaging/scans?limit=${limit}`).then(r => r.data)

export const getSecondOpinion = (sessionId: number) =>
  client.post<SecondOpinionResult>(`/api/sessions/${sessionId}/second-opinion`).then(r => r.data)
