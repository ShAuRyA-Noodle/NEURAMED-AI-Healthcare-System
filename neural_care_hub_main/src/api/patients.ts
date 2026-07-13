import client from './client'
import type { Patient, PatientDetail, EnrichedPatient } from '../types'

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
  client.get<EnrichedPatient[]>('/api/patients', { params }).then(r => r.data)

export const getPatient = (id: number) =>
  client.get<PatientDetail>(`/api/patients/${id}`).then(r => r.data)

export interface CreatePatientData {
  first_name: string
  last_name: string
  age: number
  gender: string
  phone?: string
  email?: string
  blood_type?: string
  emergency_contact?: string
  allergies?: string
  chronic_conditions?: string
}

export const createPatient = (data: CreatePatientData) =>
  client.post<Patient>('/api/patients', data).then(r => r.data)
