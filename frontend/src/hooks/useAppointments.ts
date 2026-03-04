import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAppointments, createAppointment, updateAppointmentStatus } from '@/api/appointments';
import type { Appointment, AppointmentStatus } from '@/types';

export const useAppointments = (params?: { patient_id?: number; status?: string }) => {
    return useQuery({
        queryKey: ['appointments', params],
        queryFn: () => getAppointments(params)
    });
};

export const useCreateAppointment = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: Omit<Appointment, 'id' | 'created_at' | 'patient_code'>) => createAppointment(data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments'] })
    });
};

export const useUpdateAppointmentStatus = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, status }: { id: number, status: AppointmentStatus }) => updateAppointmentStatus(id, status),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments'] })
    });
};
