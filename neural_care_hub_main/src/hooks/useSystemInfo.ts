import { useQuery } from '@tanstack/react-query'
import { getSystemInfo } from '@/api/system'

export const useSystemInfo = () => {
    return useQuery({
        queryKey: ['system-info'],
        queryFn: getSystemInfo,
        refetchInterval: 10000
    })
}
