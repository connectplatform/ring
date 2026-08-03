import 'server-only'

import { auth } from '@/auth'
import { db } from '@/lib/database'
import {
  insertAnalyticsEventBatch,
  isAnalyticsStorageDisabled,
} from '@/features/analytics/lib/analytics-db'
import { getRequestForensicsContext } from '@/features/analytics/lib/request-forensics'
import type {
  PersonalPageRoleBucket,
  PersonalPageVisitStats,
} from '@/features/analytics/types/personal-page'
import {
  ALL_USER_ROLES,
  resolveSessionUserRole,
  UserRolesArray,
} from '@/features/auth/user-role'

const ANALYTICS_EVENTS = 'analytics_events'

export const PERSONAL_PAGE_EVENT_TYPES = {
  pageView: 'personal_page_view',
} as const

export type {
  PersonalPageRoleBucket,
  PersonalPageVisitStats,
} from '@/features/analytics/types/personal-page'

const EMPTY_STATS: PersonalPageVisitStats = {
  unique24h: 0,
  unique7d: 0,
  visits24h: 0,
  visits7d: 0,
  byRole24h: [],
  byRole7d: [],
  hasData: false,
}

function roleRank(role: string): number {
  const idx = ALL_USER_ROLES.indexOf(role as UserRolesArray)
  return idx >= 0 ? idx : 999
}

function sortRoleBuckets(buckets: PersonalPageRoleBucket[]): PersonalPageRoleBucket[] {
  return [...buckets].sort((a, b) => {
    if (b.unique !== a.unique) return b.unique - a.unique
    if (b.visits !== a.visits) return b.visits - a.visits
    return roleRank(a.role) - roleRank(b.role)
  })
}

function visitorKey(row: {
  userId?: unknown
  sessionId?: unknown
  payload?: Record<string, unknown>
}): string {
  const payload = row.payload ?? {}
  const userId =
    (typeof row.userId === 'string' && row.userId) ||
    (typeof payload.visitorUserId === 'string' && payload.visitorUserId) ||
    null
  if (userId) return `user:${userId}`

  const sessionId =
    (typeof row.sessionId === 'string' && row.sessionId) ||
    (typeof payload.visitorKey === 'string' && payload.visitorKey) ||
    null
  if (sessionId) return `sess:${sessionId}`

  const ip = typeof payload.ip === 'string' ? payload.ip : 'unknown'
  return `anon:${ip}`
}

function visitorRole(row: {
  userId?: unknown
  payload?: Record<string, unknown>
}): string {
  const payload = row.payload ?? {}
  const raw =
    typeof payload.visitorRole === 'string'
      ? payload.visitorRole
      : row.userId
        ? UserRolesArray.subscriber
        : UserRolesArray.visitor
  return resolveSessionUserRole(raw)
}

function aggregateWindow(
  rows: Array<Record<string, unknown>>,
): Pick<PersonalPageVisitStats, 'unique24h' | 'visits24h' | 'byRole24h'> & {
  unique: number
  visits: number
  byRole: PersonalPageRoleBucket[]
} {
  const uniqueKeys = new Set<string>()
  const roleUniques = new Map<string, Set<string>>()
  const roleVisits = new Map<string, number>()

  for (const row of rows) {
    const key = visitorKey({
      userId: row.userId,
      sessionId: row.sessionId,
      payload: (row.payload ?? {}) as Record<string, unknown>,
    })
    const role = visitorRole({
      userId: row.userId,
      payload: (row.payload ?? {}) as Record<string, unknown>,
    })
    uniqueKeys.add(key)
    if (!roleUniques.has(role)) roleUniques.set(role, new Set())
    roleUniques.get(role)!.add(key)
    roleVisits.set(role, (roleVisits.get(role) ?? 0) + 1)
  }

  const byRole = sortRoleBuckets(
    [...roleUniques.entries()].map(([role, keys]) => ({
      role,
      unique: keys.size,
      visits: roleVisits.get(role) ?? 0,
    })),
  )

  return {
    unique: uniqueKeys.size,
    visits: rows.length,
    byRole,
    unique24h: uniqueKeys.size,
    visits24h: rows.length,
    byRole24h: byRole,
  }
}

/**
 * Server-side personal page view — mirrors docs-analytics `recordDocsPageView`.
 * Records every visit (authenticated + anonymous); stores known visitor username/role when present.
 */
export async function recordPersonalPageView(input: {
  username: string
  profileUserId: string
  locale: string
  path: string
}): Promise<void> {
  if (isAnalyticsStorageDisabled()) return

  const handle = input.username.trim().toLowerCase()
  if (!handle || !input.profileUserId) return

  const session = await auth().catch(() => null)
  const visitorUserId = session?.user?.id ?? null
  // Defense in depth: call sites also skip owners; keep recorder idempotent.
  if (visitorUserId && visitorUserId === input.profileUserId) return

  const forensics = await getRequestForensicsContext()
  const visitorUsername =
    typeof (session?.user as { username?: unknown } | undefined)?.username === 'string'
      ? ((session!.user as { username: string }).username || null)
      : null
  const visitorRole = resolveSessionUserRole(session?.user?.role)

  const sessionId = visitorUserId
    ? `server-profile:user:${visitorUserId}`
    : `server-profile:${forensics.ip ?? 'unknown'}`

  await insertAnalyticsEventBatch(sessionId, visitorUserId, [
    {
      type: PERSONAL_PAGE_EVENT_TYPES.pageView,
      data: {
        profileUsername: handle,
        profileUserId: input.profileUserId,
        locale: input.locale,
        path: input.path,
        visitorUserId,
        visitorUsername,
        visitorRole,
        visitorKey: sessionId,
        ip: forensics.ip,
        userAgent: forensics.userAgent,
        referer: forensics.referer,
        originatingPath: forensics.referer,
        requestUrl: forensics.requestUrl,
        requestPath: forensics.requestPath,
        source: 'server',
      },
      timestamp: Date.now(),
    },
  ])
}

async function queryPersonalPageViews(since: Date, profileUsername?: string) {
  if (isAnalyticsStorageDisabled()) {
    return [] as Array<Record<string, unknown>>
  }

  const result = await db().queryDocs({
    collection: ANALYTICS_EVENTS,
    filters: [
      { field: 'eventType', operator: '==', value: PERSONAL_PAGE_EVENT_TYPES.pageView },
      { field: 'created_at', operator: '>=', value: since },
    ],
    orderBy: [{ field: 'created_at', direction: 'desc' }],
    pagination: { limit: 5000 },
  })

  if (!result.success || !result.data?.length) return []

  const handle = profileUsername?.trim().toLowerCase()
  if (!handle) return result.data as Array<Record<string, unknown>>

  return (result.data as Array<Record<string, unknown>>).filter((row) => {
    const payload = (row.payload ?? {}) as Record<string, unknown>
    const name =
      typeof payload.profileUsername === 'string'
        ? payload.profileUsername.toLowerCase()
        : ''
    return name === handle
  })
}

/** Unique + total visit windows for one personal page, roles sorted by unique desc. */
export async function getPersonalPageVisitStats(
  username: string,
): Promise<PersonalPageVisitStats> {
  const handle = username.trim().toLowerCase()
  if (!handle) return EMPTY_STATS

  try {
    const now = Date.now()
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000)
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)

    const weekRows = await queryPersonalPageViews(weekAgo, handle)
    if (!weekRows.length) return EMPTY_STATS

    const dayRows = weekRows.filter((row) => {
      const raw = (row.created_at as string | Date | undefined) ?? row.recordedAt
      const when = raw ? new Date(raw as string) : null
      return when && !Number.isNaN(when.getTime()) && when >= dayAgo
    })

    const weekAgg = aggregateWindow(weekRows)
    const dayAgg = aggregateWindow(dayRows)

    return {
      unique24h: dayAgg.unique,
      unique7d: weekAgg.unique,
      visits24h: dayAgg.visits,
      visits7d: weekAgg.visits,
      byRole24h: dayAgg.byRole,
      byRole7d: weekAgg.byRole,
      hasData: true,
    }
  } catch {
    return EMPTY_STATS
  }
}

/** Platform-wide personal page metrics for admin/analytics. */
export async function getPersonalPagePlatformStats(
  timeframe: '24h' | '7d' | '30d' = '7d',
): Promise<PersonalPageVisitStats & { topProfiles: Array<{ username: string; unique: number; visits: number }> }> {
  const ms =
    timeframe === '24h'
      ? 24 * 60 * 60 * 1000
      : timeframe === '30d'
        ? 30 * 24 * 60 * 60 * 1000
        : 7 * 24 * 60 * 60 * 1000

  const now = Date.now()
  const periodStart = new Date(now - ms)
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000)

  try {
    const periodRows = await queryPersonalPageViews(periodStart)
    if (!periodRows.length) {
      return { ...EMPTY_STATS, topProfiles: [] }
    }

    const dayRows = periodRows.filter((row) => {
      const raw = (row.created_at as string | Date | undefined) ?? row.recordedAt
      const when = raw ? new Date(raw as string) : null
      return when && !Number.isNaN(when.getTime()) && when >= dayAgo
    })

    const weekAgg = aggregateWindow(periodRows)
    const dayAgg = aggregateWindow(dayRows)

    const perProfile = new Map<string, { keys: Set<string>; visits: number }>()
    for (const row of periodRows) {
      const payload = (row.payload ?? {}) as Record<string, unknown>
      const username =
        typeof payload.profileUsername === 'string'
          ? payload.profileUsername.toLowerCase()
          : ''
      if (!username) continue
      const key = visitorKey({
        userId: row.userId,
        sessionId: row.sessionId,
        payload,
      })
      const bucket = perProfile.get(username) ?? { keys: new Set(), visits: 0 }
      bucket.keys.add(key)
      bucket.visits += 1
      perProfile.set(username, bucket)
    }

    const topProfiles = [...perProfile.entries()]
      .map(([username, bucket]) => ({
        username,
        unique: bucket.keys.size,
        visits: bucket.visits,
      }))
      .sort((a, b) => b.unique - a.unique || b.visits - a.visits)
      .slice(0, 10)

    return {
      unique24h: dayAgg.unique,
      unique7d: weekAgg.unique,
      visits24h: dayAgg.visits,
      visits7d: weekAgg.visits,
      byRole24h: dayAgg.byRole,
      byRole7d: weekAgg.byRole,
      hasData: true,
      topProfiles,
    }
  } catch {
    return { ...EMPTY_STATS, topProfiles: [] }
  }
}
