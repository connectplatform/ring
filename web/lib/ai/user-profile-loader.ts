/**
 * User profile loader for AI matching.
 *
 * Replaces the placeholder/mock profile sources in Matcher and
 * OpportunityMatchingService with real `users` collection data.
 */

import { db } from '@/lib/database'
import { logger } from '@/lib/logger'
import type { UserProfile } from '@/lib/ai/types'

const MAX_CANDIDATES = Number(process.env.MATCHING_MAX_CANDIDATES || '200')

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

/** Map a Ring user document to the AI matching profile shape (best-effort). */
export function mapUserToProfile(id: string, data: Record<string, unknown>): UserProfile {
  const experience: string[] = [
    ...toStringArray(data.experience),
    ...(data.position ? [String(data.position)] : []),
    ...(data.company ? [String(data.company)] : []),
    ...(data.bio ? [String(data.bio).slice(0, 200)] : []),
  ]

  return {
    id,
    name: (data.name as string) || (data.username as string) || undefined,
    skills: toStringArray(data.skills ?? data.tags),
    experience,
    location: (data.location as string) || undefined,
    availability: (data.availability as string) || 'unknown',
    budget: data.budget && typeof data.budget === 'object' ? data.budget as UserProfile['budget'] : undefined,
    industry: toStringArray(data.industry ?? data.industries),
    careerGoals: toStringArray(data.careerGoals),
    preferredWorkTypes: toStringArray(data.preferredWorkTypes),
    experienceLevel: (data.experienceLevel as string) || undefined,
  }
}

/** Candidate pool for opportunity matching (active, non-visitor users). */
export async function loadCandidateProfiles(limit: number = MAX_CANDIDATES): Promise<UserProfile[]> {
  try {
    const result = await db().queryDocs<Record<string, unknown>>({
      collection: 'users',
      pagination: { limit },
    })

    if (!result.success) return []

    return result.data
      .map((row) => mapUserToProfile(row.id, row))
      .filter((p) => p.id && (p.skills.length > 0 || p.experience.length > 0 || p.name))
  } catch (error) {
    logger.warn('user-profile-loader: failed to load candidate profiles', { error })
    return []
  }
}

/** Load specific user profiles by id (for match enrichment + notifications). */
export async function loadProfilesByIds(userIds: string[]): Promise<UserProfile[]> {
  if (userIds.length === 0) return []
  try {
    const profiles: UserProfile[] = []
    for (const id of userIds) {
      const result = await db().readDoc<Record<string, unknown>>('users', id)
      if (result.success && result.data) {
        profiles.push(mapUserToProfile(id, result.data))
      }
    }
    return profiles
  } catch (error) {
    logger.warn('user-profile-loader: failed to load profiles by id', { error })
    return []
  }
}
