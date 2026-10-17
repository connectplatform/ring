import 'server-only'

import { db } from '@/lib/database'
import { isAnalyticsStorageDisabled } from '@/features/analytics/lib/analytics-db'
import { CURTAIN_EVENT_TYPES } from '@/features/curtain/constants'
import type { CurtainFunnelCounts } from '@/features/curtain/types'

const ANALYTICS_EVENTS = 'analytics_events'

const EMPTY: CurtainFunnelCounts = {
  shown: 0,
  resurfaced: 0,
  cta: 0,
  notToday: 0,
  notForMe: 0,
  scrollAway: 0,
  paid: 0,
}

function sinceFor(timeframe: '24h' | '7d' | '30d'): Date {
  const ms =
    timeframe === '24h'
      ? 24 * 60 * 60 * 1000
      : timeframe === '30d'
        ? 30 * 24 * 60 * 60 * 1000
        : 7 * 24 * 60 * 60 * 1000
  return new Date(Date.now() - ms)
}

async function queryType(since: Date, eventType: string): Promise<Array<Record<string, unknown>>> {
  if (isAnalyticsStorageDisabled()) return []
  const result = await db().queryDocs({
    collection: ANALYTICS_EVENTS,
    filters: [
      { field: 'eventType', operator: '==', value: eventType },
      { field: 'created_at', operator: '>=', value: since },
    ],
    orderBy: [{ field: 'created_at', direction: 'desc' }],
    pagination: { limit: 5000 },
  })
  return result.success && result.data ? (result.data as Array<Record<string, unknown>>) : []
}

function payloadOf(row: Record<string, unknown>): Record<string, unknown> {
  return (row.payload ?? {}) as Record<string, unknown>
}

function matchesScope(
  row: Record<string, unknown>,
  scope: { authorUserId?: string; vendorId?: string },
): boolean {
  const payload = payloadOf(row)
  if (scope.authorUserId && payload.authorUserId !== scope.authorUserId) return false
  if (scope.vendorId && payload.vendorId !== scope.vendorId) return false
  return true
}

export async function getCurtainFunnel(options: {
  timeframe?: '24h' | '7d' | '30d'
  authorUserId?: string
  vendorId?: string
}): Promise<CurtainFunnelCounts> {
  const since = sinceFor(options.timeframe ?? '7d')
  const scope = { authorUserId: options.authorUserId, vendorId: options.vendorId }
  try {
    const [shownRows, ctaRows, responseRows, suppressRows, paidRows] = await Promise.all([
      queryType(since, CURTAIN_EVENT_TYPES.shown),
      queryType(since, CURTAIN_EVENT_TYPES.cta),
      queryType(since, CURTAIN_EVENT_TYPES.response),
      queryType(since, CURTAIN_EVENT_TYPES.suppress),
      queryType(since, CURTAIN_EVENT_TYPES.paid),
    ])
    const counts = { ...EMPTY }
    for (const row of shownRows.filter((item) => matchesScope(item, scope))) {
      if (payloadOf(row).resurface === true) counts.resurfaced += 1
      else counts.shown += 1
    }
    counts.cta = ctaRows.filter((item) => matchesScope(item, scope)).length
    counts.paid = paidRows.filter((item) => matchesScope(item, scope)).length
    for (const row of responseRows.filter((item) => matchesScope(item, scope))) {
      if (payloadOf(row).response === 'scroll_away') counts.scrollAway += 1
    }
    for (const row of suppressRows.filter((item) => matchesScope(item, scope))) {
      const mode = payloadOf(row).mode
      if (mode === 'not_today') counts.notToday += 1
      if (mode === 'not_for_me') counts.notForMe += 1
    }
    return counts
  } catch {
    return EMPTY
  }
}
