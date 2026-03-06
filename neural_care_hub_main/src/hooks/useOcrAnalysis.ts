import { useMutation, useQueryClient } from '@tanstack/react-query'
import { analyzeReport } from '../api/ocr'
import { useToast } from './useToast'

export const useOcrAnalysis = () => {
    const queryClient = useQueryClient()
    const { addToast } = useToast()

    return useMutation({
        mutationFn: ({ file, patientId }: { file: File, patientId?: number }) =>
            analyzeReport(file, patientId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
            queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
            queryClient.invalidateQueries({ queryKey: ['recent-sessions'] })
            addToast('success', 'Report extracted successfully')
        },
        onError: (err: any) => {
            addToast('error', `OCR failed: ${err.message || 'Request failed'}`)
        }
    })
}
