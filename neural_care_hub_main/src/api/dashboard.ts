import client from './client'
import type { DashboardStats, ActivityFeedItem, DiagnosisSession, QuickStats, AIInsight, UrgencyHeatmapData } from '../types'

export const getStats = () =>
  client.get<DashboardStats>('/api/dashboard/stats').then(r => r.data)

export const getActivityFeed = (limit = 20) =>
  client.get<ActivityFeedItem[]>(`/api/dashboard/activity-feed?limit=${limit}`).then(r => r.data)

export const getRecentSessions = (limit = 10) =>
  client.get<DiagnosisSession[]>(`/api/dashboard/recent-sessions?limit=${limit}`).then(r => r.data)

export const getQuickStats = () =>
  client.get<QuickStats>('/api/dashboard/quick-stats').then(r => r.data)

export const getAIInsights = () =>
  client.get<{ insights: AIInsight[] }>('/api/dashboard/ai-insights').then(r => r.data)

export const getUrgencyHeatmap = () =>
  client.get<UrgencyHeatmapData>('/api/dashboard/urgency-heatmap').then(r => r.data)
