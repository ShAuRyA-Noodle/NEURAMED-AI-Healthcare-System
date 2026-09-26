import { useMutation, useQueryClient } from '@tanstack/react-query'
import { analyzeImage } from '../api/imaging'
import { useToast } from './useToast'

export const useImageAnalysis = () => {
    const queryClient = useQueryClient()
    const { addToast } = useToast()

    return useMutation({
        mutationFn: analyzeImage,
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
            queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
            queryClient.invalidateQueries({ queryKey: ['recent-sessions'] })
            addToast('success', `Scan analyzed — anomaly ${data.anomaly_detected ? 'DETECTED' : 'not found'}`)
        },
        onError: (err) => {
            addToast('error', `Analysis failed: ${err instanceof Error ? err.message : 'Request failed'}`)
        }
    })
}
