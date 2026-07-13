import client from './client'
import type { TimelineData } from '../types'

export const getPatientTimeline = (patientId: number) =>
  client.get<TimelineData>(`/api/patients/${patientId}/timeline`).then(r => r.data)
