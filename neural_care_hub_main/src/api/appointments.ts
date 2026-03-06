import client from './client'
import type { Appointment, AppointmentStatus, AppointmentStats } from '../types'

export const getAppointments = (params?: { patient_id?: number; status?: string; specialty?: string; date_from?: string; date_to?: string }) =>
    client.get<Appointment[]>('/api/appointments', { params }).then(r => r.data)

export const createAppointment = (data: Omit<Appointment, 'id' | 'created_at' | 'patient_code' | 'time_until_minutes'>) =>
    client.post<Appointment>('/api/appointments', data).then(r => r.data)

export const updateAppointmentStatus = (id: number, status: AppointmentStatus) =>
    client.patch<Appointment>(`/api/appointments/${id}/status`, { status }).then(r => r.data)

export const getAppointmentStats = () =>
    client.get<AppointmentStats>('/api/appointments/stats').then(r => r.data)

export const getUpcomingAppointments = () =>
    client.get<Appointment[]>('/api/appointments/upcoming').then(r => r.data)

export const getTodayAppointments = () =>
    client.get<Appointment[]>('/api/appointments/today').then(r => r.data)

export const addAppointmentNotes = (id: number, notes: string) =>
    client.patch<Appointment>(`/api/appointments/${id}/notes`, { notes }).then(r => r.data)
