import client from './client'
import type { Patient, PatientDetail } from '../types'

export interface PatientFilterParams {
  search?: string
  gender?: string
  age_min?: number
  age_max?: number
  condition?: string
  urgency?: string
  agent_type?: string
  sort_by?: string
  limit?: number
  offset?: number
}

export const getPatients = (params?: PatientFilterParams) =>
  client.get<Patient[]>('/api/patients', { params }).then(r => r.data)

export const getPatient = (id: number) =>
  client.get<PatientDetail>(`/api/patients/${id}`).then(r => r.data)

export const createPatient = (data: { age: number; gender: string }) =>
  client.post<Patient>('/api/patients', data).then(r => r.data)
