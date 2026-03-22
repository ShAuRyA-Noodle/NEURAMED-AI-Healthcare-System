import client from './client'
import type { DiagnosisResult, DiagnosisSession } from '../types'

export const diagnoseSpeech = (data: { transcript?: string; audio_base64?: string; patient_id?: number; language?: string }) =>
  client.post<DiagnosisResult>('/api/voice/diagnose', data).then(r => r.data)

export const getVoiceSessions = (limit = 20, offset = 0) =>
  client.get<DiagnosisSession[]>(`/api/voice/sessions?limit=${limit}&offset=${offset}`).then(r => r.data)
