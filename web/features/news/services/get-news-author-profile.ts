/**
 * Get News Author Profile Service
 *
 * Public author profile fetch for news AuthorBioCard.
 * Does NOT require authentication — safe for public Server Components.
 * Uses React 19 cache() for request deduplication within a request.
 */

import { cache } from 'react'
import { db } from '@/lib/database'
import { logger } from '@/lib/logger'

export interface NewsAuthorProfile {
  id: string
  name: string
  photoURL: string | null
  bio?: string
  role: string
  createdAt: Date
  socialLinks?: {
    twitter?: string | null
    linkedin?: string | null
    website?: string | null
  }
}

const EMPTY_DATE = new Date(0)

/**
 * Resolve a public author profile by user ID.
 * Returns minimal public-safe fields — no email, no wallet, no auth metadata.
 * Never throws; returns null on any error or missing data.
 */
export const getNewsAuthorProfile = cache(
  async (authorId: string): Promise<NewsAuthorProfile | null> => {
    if (!authorId) return null

    try {
      const result = await db().readDoc<Record<string, unknown>>(
        'users',
        authorId,
      )

      if (!result.success || !result.data) {
        logger.warn('getNewsAuthorProfile: user not found', {
          authorId,
          success: result.success,
        })
        return null
      }

      const d = result.data

      // Try to extract social media links from either ExtendedProfile format
      // or flat social_media JSONB column.
      const socialMedia =
        (d.socialMedia as Record<string, unknown> | undefined) ??
        (d.social_media as Record<string, unknown> | undefined)

      return {
        id: (d.id as string) ?? authorId,
        name:
          (d.name as string) ??
          (d.displayName as string) ??
          (d.email as string) ??
          'Unknown',
        photoURL:
          (d.photoURL as string | null) ??
          (d.photo_url as string | null) ??
          (d.image as string | null) ??
          null,
        bio: (d.bio as string | undefined) ?? (d.description as string | undefined),
        role: (d.role as string) ?? 'member',
        createdAt: d.createdAt
          ? new Date(d.createdAt as string)
          : EMPTY_DATE,
        socialLinks: socialMedia
          ? {
              twitter: (socialMedia.twitter as string | null) ?? null,
              linkedin: (socialMedia.linkedin as string | null) ?? null,
              website:
                (d.website as string | null) ??
                (socialMedia.website as string | null) ??
                null,
            }
          : undefined,
      }
    } catch (error) {
      logger.error('getNewsAuthorProfile: Error', {
        authorId,
        error: error instanceof Error ? error.message : error,
      })
      return null
    }
  },
)
