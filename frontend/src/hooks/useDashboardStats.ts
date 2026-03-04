import { useQuery } from '@tanstack/react-query'
import { getStats } from '../api/dashboard'

export const useDashboardStats = () => useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getStats,
    refetchInterval: 30000,
    staleTime: 20000,
})
