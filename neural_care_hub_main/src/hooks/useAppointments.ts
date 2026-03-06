import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAppointments, createAppointment, updateAppointmentStatus, getAppointmentStats, addAppointmentNotes } from '@/api/appointments';
import type { Appointment, AppointmentStatus } from '@/types';

export const useAppointments = (params?: { patient_id?: number; status?: string; specialty?: string }) => {
    return useQuery({
        queryKey: ['appointments', params],
        queryFn: () => getAppointments(params)
    });
};

export const useAppointmentStats = () => {
    return useQuery({
        queryKey: ['appointment-stats'],
        queryFn: getAppointmentStats,
        refetchInterval: 30000
    });
};

export const useCreateAppointment = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: Omit<Appointment, 'id' | 'created_at' | 'patient_code' | 'time_until_minutes'>) => createAppointment(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['appointments'] });
            qc.invalidateQueries({ queryKey: ['appointment-stats'] });
        }
    });
};

export const useUpdateAppointmentStatus = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, status }: { id: number, status: AppointmentStatus }) => updateAppointmentStatus(id, status),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['appointments'] });
            qc.invalidateQueries({ queryKey: ['appointment-stats'] });
        }
    });
};

export const useAddAppointmentNotes = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, notes }: { id: number, notes: string }) => addAppointmentNotes(id, notes),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments'] })
    });
};
