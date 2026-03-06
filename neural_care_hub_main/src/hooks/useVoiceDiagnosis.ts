import { useMutation, useQueryClient } from '@tanstack/react-query'
import { diagnoseSpeech } from '../api/voice'
import { useToast } from './useToast'

export const useVoiceDiagnosis = () => {
    const queryClient = useQueryClient()
    const { addToast } = useToast()

    return useMutation({
        mutationFn: diagnoseSpeech,
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
            queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
            queryClient.invalidateQueries({ queryKey: ['recent-sessions'] })
            addToast('success', `Diagnosis complete — ${data.urgency?.toUpperCase() || 'UNKNOWN'} urgency detected`)
        },
        onError: (err: any) => {
            addToast('error', `Diagnosis failed: ${err.message || 'Request failed'}`)
        }
    })
}
