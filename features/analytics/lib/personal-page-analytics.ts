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
  privateProfileView: 'private_profile_view',
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
  privateUnique24h: 0,
  privateUnique7d: 0,
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
  return recordProfileAnalyticsEvent({
    ...input,
    eventType: PERSONAL_PAGE_EVENT_TYPES.pageView,
  })
}

/** Record a hit on PrivateProfileShell (master or media surface gated). */
export async function recordPrivateProfileView(input: {
  username: string
  profileUserId: string
  locale: string
  path: string
  surface?: 'profile' | 'player' | 'games' | 'img'
}): Promise<void> {
  return recordProfileAnalyticsEvent({
    ...input,
    eventType: PERSONAL_PAGE_EVENT_TYPES.privateProfileView,
    surface: input.surface ?? 'profile',
  })
}

async function recordProfileAnalyticsEvent(input: {
  username: string
  profileUserId: string
  locale: string
  path: string
  eventType: string
  surface?: string
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
      type: input.eventType,
      data: {
        profileUsername: handle,
        profileUserId: input.profileUserId,
        locale: input.locale,
        path: input.path,
        surface: input.surface,
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

async function queryPersonalPageEvents(
  since: Date,
  eventType: string,
  profileUsername?: string,
) {
  if (isAnalyticsStorageDisabled()) {
    return [] as Array<Record<string, unknown>>
  }

  const result = await db().queryDocs({
    collection: ANALYTICS_EVENTS,
    filters: [
      { field: 'eventType', operator: '==', value: eventType },
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

async function queryPersonalPageViews(since: Date, profileUsername?: string) {
  return queryPersonalPageEvents(since, PERSONAL_PAGE_EVENT_TYPES.pageView, profileUsername)
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

    const [weekRows, privateWeekRows] = await Promise.all([
      queryPersonalPageViews(weekAgo, handle),
      queryPersonalPageEvents(
        weekAgo,
        PERSONAL_PAGE_EVENT_TYPES.privateProfileView,
        handle,
      ),
    ])

    const filterDay = (rows: Array<Record<string, unknown>>) =>
      rows.filter((row) => {
        const raw = (row.created_at as string | Date | undefined) ?? row.recordedAt
        const when = raw ? new Date(raw as string) : null
        return when && !Number.isNaN(when.getTime()) && when >= dayAgo
      })

    const dayRows = filterDay(weekRows)
    const privateDayRows = filterDay(privateWeekRows)

    const weekAgg = aggregateWindow(weekRows)
    const dayAgg = aggregateWindow(dayRows)
    const privateWeekAgg = aggregateWindow(privateWeekRows)
    const privateDayAgg = aggregateWindow(privateDayRows)

    const hasData = weekRows.length > 0 || privateWeekRows.length > 0
    if (!hasData) return EMPTY_STATS

    return {
      unique24h: dayAgg.unique,
      unique7d: weekAgg.unique,
      visits24h: dayAgg.visits,
      visits7d: weekAgg.visits,
      byRole24h: dayAgg.byRole,
      byRole7d: weekAgg.byRole,
      privateUnique24h: privateDayAgg.unique,
      privateUnique7d: privateWeekAgg.unique,
      hasData: true,
    }
  } catch {
    return EMPTY_STATS
  }
}

/** Platform-wide personal page metrics for admin/analytics. */
export async function getPersonalPagePlatformStats(
  timeframe: '24h' | '7d' | '30d' = '7d',
): Promise<
  PersonalPageVisitStats & {
    topProfiles: Array<{
      username: string
      unique: number
      visits: number
      privateUnique: number
    }>
  }
> {
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
    const [periodRows, privatePeriodRows] = await Promise.all([
      queryPersonalPageViews(periodStart),
      queryPersonalPageEvents(
        periodStart,
        PERSONAL_PAGE_EVENT_TYPES.privateProfileView,
      ),
    ])

    if (!periodRows.length && !privatePeriodRows.length) {
      return { ...EMPTY_STATS, topProfiles: [] }
    }

    const inDay = (row: Record<string, unknown>) => {
      const raw = (row.created_at as string | Date | undefined) ?? row.recordedAt
      const when = raw ? new Date(raw as string) : null
      return when && !Number.isNaN(when.getTime()) && when >= dayAgo
    }

    const dayRows = periodRows.filter(inDay)
    const privateDayRows = privatePeriodRows.filter(inDay)

    const weekAgg = aggregateWindow(periodRows)
    const dayAgg = aggregateWindow(dayRows)
    const privateWeekAgg = aggregateWindow(privatePeriodRows)
    const privateDayAgg = aggregateWindow(privateDayRows)

    type ProfileBucket = {
      keys: Set<string>
      visits: number
      privateKeys: Set<string>
    }
    const perProfile = new Map<string, ProfileBucket>()

    const bump = (
      rows: Array<Record<string, unknown>>,
      kind: 'public' | 'private',
    ) => {
      for (const row of rows) {
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
        const bucket = perProfile.get(username) ?? {
          keys: new Set(),
          visits: 0,
          privateKeys: new Set(),
        }
        if (kind === 'public') {
          bucket.keys.add(key)
          bucket.visits += 1
        } else {
          bucket.privateKeys.add(key)
        }
        perProfile.set(username, bucket)
      }
    }

    bump(periodRows, 'public')
    bump(privatePeriodRows, 'private')

    const topProfiles = [...perProfile.entries()]
      .map(([username, bucket]) => ({
        username,
        unique: bucket.keys.size,
        visits: bucket.visits,
        privateUnique: bucket.privateKeys.size,
      }))
      .sort(
        (a, b) =>
          b.unique + b.privateUnique - (a.unique + a.privateUnique) ||
          b.visits - a.visits,
      )
      .slice(0, 10)

    return {
      unique24h: dayAgg.unique,
      unique7d: weekAgg.unique,
      visits24h: dayAgg.visits,
      visits7d: weekAgg.visits,
      byRole24h: dayAgg.byRole,
      byRole7d: weekAgg.byRole,
      privateUnique24h: privateDayAgg.unique,
      privateUnique7d: privateWeekAgg.unique,
      hasData: true,
      topProfiles,
    }
  } catch {
    return { ...EMPTY_STATS, topProfiles: [] }
  }
}
