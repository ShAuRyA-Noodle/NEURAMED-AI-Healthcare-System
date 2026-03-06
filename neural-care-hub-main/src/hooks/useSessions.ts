import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client from '@/api/client'
import type { SessionStats, SessionDetail } from '@/types'

export const useSessionStats = () => {
    return useQuery({
        queryKey: ['session-stats'],
        queryFn: () => client.get<SessionStats>('/api/sessions/stats').then(r => r.data),
        refetchInterval: 30000
    })
}

export const useSessionDetail = (id: number) => {
    return useQuery({
        queryKey: ['session', id],
        queryFn: () => client.get<SessionDetail>(`/api/sessions/${id}`).then(r => r.data),
        enabled: !!id
    })
}

export const useDeleteSession = () => {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: number) => client.delete(`/api/sessions/${id}`).then(r => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['sessions'] })
            qc.invalidateQueries({ queryKey: ['session-stats'] })
            qc.invalidateQueries({ queryKey: ['dashboard'] })
        }
    })
}
