import 'server-only'

import { db } from '@/lib/database'
import { getCreditUnitLabel } from '@/lib/payments/credit-balance'

export type RewardStatsRange = '7d' | '28d' | '90d'

type RewardEvent = Record<string, unknown>

const RANGE_DAYS: Record<RewardStatsRange, number> = {
  '7d': 7,
  '28d': 28,
  '90d': 90,
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {}
    } catch {
      return {}
    }
  }
  return {}
}

function amountFor(event: RewardEvent): number {
  const metadata = asRecord(event.metadata)
  const raw = event.amount ?? metadata.final_amount
  const amount = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(amount) ? amount : 0
}

function timeFor(event: RewardEvent): number {
  const raw = event.completed_at ?? event.created_at ?? event.updated_at
  const time = raw ? new Date(String(raw)).getTime() : Number.NaN
  return Number.isFinite(time) ? time : 0
}

function utcDay(timeMs: number): string {
  return new Date(timeMs).toISOString().slice(0, 10)
}

function statusFor(event: RewardEvent): string {
  return String(event.status ?? 'unknown').toLowerCase()
}

async function fetchRecentRewardEvents(): Promise<RewardEvent[]> {
  const result = await db().queryDocs<RewardEvent>({
    collection: 'credit_add_events',
    orderBy: [{ field: 'created_at', direction: 'desc' }],
    pagination: { limit: 2000 },
  })

  if (!result.success || !result.data) {
    throw result.error ?? new Error('Failed to fetch reward events')
  }
  return result.data
}

export async function getAdminRewardStats(range: RewardStatsRange): Promise<{
  totals: { completedCount: number; pointsMinted: number; skippedCapCount: number; failedCount: number }
  seriesDaily: Array<{ date: string; points: number; events: number }>
  byTrigger: Array<{ trigger: string; count: number; points: number }>
  byRole: Array<{ role: string; count: number; points: number }>
  topEarners: Array<{ userId: string; points: number; events: number }>
  unitLabel: string
}> {
  const events = await fetchRecentRewardEvents()
  const now = Date.now()
  const cutoff = now - RANGE_DAYS[range] * 24 * 60 * 60 * 1000
  const inRange = events.filter((event) => timeFor(event) >= cutoff)

  const daily = new Map<string, { points: number; events: number }>()
  const byTrigger = new Map<string, { count: number; points: number }>()
  const byRole = new Map<string, { count: number; points: number }>()
  const earners = new Map<string, { points: number; events: number }>()
  let completedCount = 0
  let pointsMinted = 0
  let skippedCapCount = 0
  let failedCount = 0

  for (const event of inRange) {
    const status = statusFor(event)
    const metadata = asRecord(event.metadata)
    const amount = amountFor(event)

    if (status === 'completed') {
      completedCount++
      pointsMinted += amount

      const day = utcDay(timeFor(event))
      const dailyEntry = daily.get(day) ?? { points: 0, events: 0 }
      dailyEntry.points += amount
      dailyEntry.events++
      daily.set(day, dailyEntry)

      const trigger = String(event.trigger ?? metadata.trigger ?? 'unknown')
      const triggerEntry = byTrigger.get(trigger) ?? { count: 0, points: 0 }
      triggerEntry.count++
      triggerEntry.points += amount
      byTrigger.set(trigger, triggerEntry)

      const role = String(event.role ?? metadata.role ?? metadata.userRole ?? 'unknown')
      const roleEntry = byRole.get(role) ?? { count: 0, points: 0 }
      roleEntry.count++
      roleEntry.points += amount
      byRole.set(role, roleEntry)

      const userId = String(event.user_id ?? event.userId ?? '')
      if (userId) {
        const earner = earners.get(userId) ?? { points: 0, events: 0 }
        earner.points += amount
        earner.events++
        earners.set(userId, earner)
      }
    } else if (status === 'failed') {
      failedCount++
    } else if (
      status.includes('cap') ||
      (status.startsWith('skipped') &&
        String(metadata.reason ?? metadata.skip_reason ?? event.failure_reason ?? '').toLowerCase().includes('cap'))
    ) {
      skippedCapCount++
    }
  }

  const start = new Date()
  start.setUTCDate(start.getUTCDate() - RANGE_DAYS[range] + 1)
  const seriesDaily = Array.from({ length: RANGE_DAYS[range] }, (_, index) => {
    const day = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + index))
    const date = day.toISOString().slice(0, 10)
    const value = daily.get(date) ?? { points: 0, events: 0 }
    return { date, ...value }
  })

  return {
    totals: { completedCount, pointsMinted, skippedCapCount, failedCount },
    seriesDaily,
    byTrigger: [...byTrigger.entries()]
      .map(([trigger, value]) => ({ trigger, ...value }))
      .sort((a, b) => b.points - a.points),
    byRole: [...byRole.entries()]
      .map(([role, value]) => ({ role, ...value }))
      .sort((a, b) => b.points - a.points),
    topEarners: [...earners.entries()]
      .map(([userId, value]) => ({ userId, ...value }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 20),
    unitLabel: getCreditUnitLabel(),
  }
}

export async function listAdminRewardEvents(opts: {
  limit?: number
  offset?: number
  trigger?: string
  status?: string
  userId?: string
}): Promise<{ events: Array<Record<string, unknown>>; total: number }> {
  const events = await fetchRecentRewardEvents()
  const trigger = opts.trigger?.trim()
  const status = opts.status?.trim().toLowerCase()
  const userId = opts.userId?.trim()
  const filtered = events.filter((event) => {
    if (trigger && String(event.trigger ?? asRecord(event.metadata).trigger ?? '') !== trigger) return false
    if (status && statusFor(event) !== status) return false
    if (userId && String(event.user_id ?? event.userId ?? '') !== userId) return false
    return true
  })
  const offset = Math.max(0, opts.offset ?? 0)
  const limit = Math.min(Math.max(1, opts.limit ?? 50), 200)

  return { events: filtered.slice(offset, offset + limit), total: filtered.length }
}
