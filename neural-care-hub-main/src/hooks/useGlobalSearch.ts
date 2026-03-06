import { useQuery } from '@tanstack/react-query'
import { globalSearch } from '@/api/search'

export const useGlobalSearch = (query: string) => {
    return useQuery({
        queryKey: ['global-search', query],
        queryFn: () => globalSearch(query),
        enabled: query.length >= 2,
        staleTime: 5000
    })
}
