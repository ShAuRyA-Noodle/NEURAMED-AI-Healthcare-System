import { useQuery } from '@tanstack/react-query'
import { getPatients } from '../api/patients'

export const usePatients = (params?: { search?: string; limit?: number; offset?: number }) => useQuery({
  queryKey: ['patients', params],
  queryFn: () => getPatients(params),
})
