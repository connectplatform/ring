'use server'

/**
 * Server Action only — types live in personal-page-stats-types.ts.
 * Do not re-export type-only imports from this file (Turbopack/SWC
 * turns `export type { X }` into a runtime `export { X }` → ReferenceError).
 */

import { auth } from '@/auth'
import { getPersonalPageVisitStats } from '@/features/analytics/lib/personal-page-analytics'
import { getUserByUsername } from '@/features/auth/services/get-user-by-username'
import { isPlatformAdmin } from '@/features/auth/user-role'
import type { PersonalPageViewStats } from '@/features/auth/services/personal-page-stats-types'

const EMPTY: PersonalPageViewStats = {
  today: 0,
  last7d: 0,
  unique24h: 0,
  unique7d: 0,
  visits24h: 0,
  visits7d: 0,
  byRole24h: [],
  byRole7d: [],
  hasData: false,
}

/**
 * Unique personal-page visits (24h / 7d) sorted by visitor role.
 * Restricted to the profile owner (or platform admin).
 */
export async function getPersonalPageViewStats(
  username: string,
): Promise<PersonalPageViewStats> {
  const handle = username.trim().toLowerCase()
  if (!handle) return EMPTY

  const session = await auth().catch(() => null)
  if (!session?.user?.id) return EMPTY

  const profile = await getUserByUsername(handle)
  if (!profile) return EMPTY

  const isOwner = profile.id === session.user.id
  const isAdmin = isPlatformAdmin(session.user.role)
  if (!isOwner && !isAdmin) return EMPTY

  const stats = await getPersonalPageVisitStats(handle)
  return {
    ...stats,
    today: stats.unique24h,
    last7d: stats.unique7d,
  }
}
