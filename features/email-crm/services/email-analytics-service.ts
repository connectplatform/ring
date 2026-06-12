import 'server-only'

import { EmailApiUsageService } from './email-api-usage-service'
import { EmailThreadService } from './email-thread-service'
import { getEmailDraftService } from '@/services/email/drafts/draft-service'
import { getEmailTaskService } from '@/services/email/crm/task-service'

function parseRange(range: string): Date {
  const days = range === '90d' ? 90 : range === '30d' ? 30 : 7
  return new Date(Date.now() - days * 86400000)
}

export const EmailAnalyticsService = {
  async getDashboard(range: '7d' | '30d' | '90d' = '7d') {
    const since = parseRange(range)
    const threads = await EmailThreadService.listThreads({ limit: 500 })
    const recentThreads = threads.filter((t) => new Date(t.lastMessageAt) >= since)

    const intentDistribution: Record<string, number> = {}
    const sentimentDistribution: Record<string, number> = {}
    for (const t of recentThreads) {
      if (t.intent) intentDistribution[t.intent] = (intentDistribution[t.intent] ?? 0) + 1
      if (t.sentiment) sentimentDistribution[t.sentiment] = (sentimentDistribution[t.sentiment] ?? 0) + 1
    }

    const usage = await EmailApiUsageService.listSince(since)
    const totalCost = usage.reduce((sum, r) => sum + Number(r.costUsd ?? 0), 0)
    const cacheHits = usage.filter((r) => Number(r.cacheReadTokens ?? 0) > 0).length
    const cacheHitRate = usage.length > 0 ? cacheHits / usage.length : 0

    const draftService = getEmailDraftService()
    const draftStats = await draftService.getStatistics()
    const taskService = getEmailTaskService()
    const taskStats = await taskService.getStatistics()

    const dailyMap = new Map<string, { received: number; cost: number }>()
    for (const t of recentThreads) {
      const day = t.lastMessageAt.slice(0, 10)
      const entry = dailyMap.get(day) ?? { received: 0, cost: 0 }
      entry.received++
      dailyMap.set(day, entry)
    }
    for (const r of usage) {
      const ts = String(r.timestamp ?? '')
      const day = ts.slice(0, 10)
      if (!day) continue
      const entry = dailyMap.get(day) ?? { received: 0, cost: 0 }
      entry.cost += Number(r.costUsd ?? 0)
      dailyMap.set(day, entry)
    }

    const dailyStats = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({ date, received: stats.received, cost: stats.cost }))

    return {
      range,
      totalEmails: recentThreads.length,
      intentDistribution,
      sentimentDistribution,
      costStats: {
        totalCostUsd: totalCost,
        requestCount: usage.length,
        cacheHitRate,
        avgCostPerEmail: recentThreads.length > 0 ? totalCost / recentThreads.length : 0,
      },
      draftStats,
      taskStats,
      dailyStats,
    }
  },
}
