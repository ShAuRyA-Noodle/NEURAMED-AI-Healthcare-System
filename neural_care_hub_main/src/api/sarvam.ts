import client from './client'
import type { SarvamHealthStatus, SarvamDiagnoseResult } from '../types'

export const getSarvamHealth = () =>
  client.get<SarvamHealthStatus>('/api/sarvam/health').then(r => r.data)

export const sarvamDiagnose = (transcript: string, language: string) =>
  client.post<SarvamDiagnoseResult>('/api/sarvam/diagnose', null, {
    params: { transcript, language },
    timeout: 120000,
  }).then(r => r.data)

export const sarvamTextDiagnose = (message: string, language: string, conversationHistory: { role: string; content: string }[] = []) =>
  client.post<SarvamDiagnoseResult>('/api/sarvam/text-diagnose', null, {
    params: { message, language, conversation_history: JSON.stringify(conversationHistory) },
    timeout: 120000,
  }).then(r => r.data)

export const getSarvamLanguages = () =>
  client.get('/api/sarvam/languages').then(r => r.data)

export const sarvamTTS = (text: string, language: string) =>
  client.post('/api/sarvam/tts', { text, language }, {
    responseType: 'blob',
    timeout: 60000,
  }).then(r => r.data as Blob)
