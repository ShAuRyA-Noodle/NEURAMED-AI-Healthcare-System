import client from './client'
import type { DashboardStats, ActivityFeedItem, DiagnosisSession } from '../types'

export const getStats = () =>
  client.get<DashboardStats>('/api/dashboard/stats').then(r => r.data)

export const getActivityFeed = (limit = 20) =>
  client.get<ActivityFeedItem[]>(`/api/dashboard/activity-feed?limit=${limit}`).then(r => r.data)

export const getRecentSessions = (limit = 10) =>
  client.get<DiagnosisSession[]>(`/api/dashboard/recent-sessions?limit=${limit}`).then(r => r.data)
