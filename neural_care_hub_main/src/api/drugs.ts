import client from './client'
import type { DrugInteractionResult } from '../types'

export const checkDrugInteractions = (drugs: string[]) =>
  client.post<DrugInteractionResult>('/api/drugs/check-interactions', drugs, {
    timeout: 60000,
  }).then(r => r.data)
