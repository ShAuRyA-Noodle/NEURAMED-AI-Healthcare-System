import { useQuery } from '@tanstack/react-query'
import { getActivityFeed } from '../api/dashboard'

export const useActivityFeed = () => useQuery({
    queryKey: ['activity-feed'],
    queryFn: () => getActivityFeed(20),
    refetchInterval: 5000,
})
