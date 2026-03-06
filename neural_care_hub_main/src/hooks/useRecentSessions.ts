import { useQuery } from '@tanstack/react-query'
import { getRecentSessions } from '../api/dashboard'

export const useRecentSessions = () => useQuery({
    queryKey: ['recent-sessions'],
    queryFn: () => getRecentSessions(10),
    refetchInterval: 10000,
})
