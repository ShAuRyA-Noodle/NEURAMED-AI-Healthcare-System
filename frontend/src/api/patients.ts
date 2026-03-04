import client from './client'
import type { Patient } from '../types'

export const getPatients = (params?: { search?: string; limit?: number; offset?: number }) =>
  client.get<Patient[]>('/api/patients', { params }).then(r => r.data)

export const getPatient = (id: number) =>
  client.get<Patient>(`/api/patients/${id}`).then(r => r.data)

export const createPatient = (data: { age: number; gender: string }) =>
  client.post<Patient>('/api/patients', data).then(r => r.data)
