import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPatients, createPatient } from '../api/patients'
import type { CreatePatientData } from '../api/patients'

export const usePatients = (params?: { search?: string; limit?: number; offset?: number }) => useQuery({
  queryKey: ['patients', params],
  queryFn: () => getPatients(params),
})

export const useCreatePatient = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreatePatientData) => createPatient(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patients'] })
    }
  })
}
