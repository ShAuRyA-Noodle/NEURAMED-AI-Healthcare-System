import client from './client'
import type { TimelineData, SecondOpinionResult } from '../types'

export const getPatientTimeline = (patientId: number) =>
  client.get<TimelineData>(`/api/patients/${patientId}/timeline`).then(r => r.data)

export const getSecondOpinion = (sessionId: number) =>
  client.post<SecondOpinionResult>(`/api/sessions/${sessionId}/second-opinion`).then(r => r.data)
