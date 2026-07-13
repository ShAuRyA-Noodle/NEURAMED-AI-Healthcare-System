import client from './client'
import type { DiagnosisResult } from '../types'

export const diagnoseSpeech = (data: { transcript?: string; audio_base64?: string; patient_id?: number; language?: string }) =>
  client.post<DiagnosisResult>('/api/voice/diagnose', data).then(r => r.data)
