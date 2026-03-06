import { useQuery } from '@tanstack/react-query'
import { getQuickStats, getAIInsights, getUrgencyHeatmap } from '@/api/dashboard'

export const useQuickStats = () => {
    return useQuery({
        queryKey: ['quick-stats'],
        queryFn: getQuickStats,
        refetchInterval: 30000
    })
}

export const useAIInsights = () => {
    return useQuery({
        queryKey: ['ai-insights'],
        queryFn: getAIInsights,
        staleTime: 300000 // 5 min cache on client side too
    })
}

export const useUrgencyHeatmap = () => {
    return useQuery({
        queryKey: ['urgency-heatmap'],
        queryFn: getUrgencyHeatmap,
        staleTime: 60000
    })
}
