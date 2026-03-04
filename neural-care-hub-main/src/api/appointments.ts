import client from './client'
import type { Appointment, AppointmentStatus } from '../types'

export const getAppointments = (params?: { patient_id?: number; status?: string }) =>
    client.get<Appointment[]>('/api/appointments', { params }).then(r => r.data)

export const createAppointment = (data: Omit<Appointment, 'id' | 'created_at' | 'patient_code'>) =>
    client.post<Appointment>('/api/appointments', data).then(r => r.data)

export const updateAppointmentStatus = (id: number, status: AppointmentStatus) =>
    client.patch<Appointment>(`/api/appointments/${id}/status`, { status }).then(r => r.data)
