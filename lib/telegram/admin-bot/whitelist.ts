/**
 * ADMIN TELEGRAM BOT - Whitelist Service
 * Telegram Chat ID whitelist for ADMIN/SUPERADMIN users
 * 
 * Truth Lens:
 * - @legiox-truth-lens/ring-backend-administrator.json
 * - @legiox-truth-lens/postgres-db-specialist.json
 * 
 * Security:
 * - Only ADMIN/SUPERADMIN with telegramId can interact with bot
 * - 60-second cache to reduce DB load
 * - PALADIN Layer 2: Authorization check
 */

import { getDatabaseService } from '@/lib/database/DatabaseService'
import { UserRole } from '@/features/auth/types'

interface WhitelistCache {
  ids: Set<string>
  lastUpdated: number
}

const CACHE_TTL_MS = 60 * 1000 // 60 seconds
let cache: WhitelistCache | null = null

/**
 * Get all Telegram Chat IDs for ADMIN/SUPERADMIN users
 * Cached for 60 seconds to reduce database load
 * 
 * @returns Array of Telegram Chat IDs
 */
export async function getAdminTelegramIds(): Promise<string[]> {
  const now = Date.now()

  // Return cached data if still valid
  if (cache && now - cache.lastUpdated < CACHE_TTL_MS) {
    return Array.from(cache.ids)
  }

  // Query database for admin telegram IDs
  try {
    const db = getDatabaseService()

    // Query users with ADMIN or SUPERADMIN role AND telegramId set
    const adminUsersResult = await db.query({
      collection: 'users',
      filters: [
        {
          field: 'role',
          operator: 'in',
          value: [UserRole.ADMIN, UserRole.SUPERADMIN],
        },
      ],
    })

    if (!adminUsersResult.success) {
      console.error('[ADMIN BOT WHITELIST] Failed to query users:', adminUsersResult.error)
      return cache ? Array.from(cache.ids) : [] // Return stale cache on error
    }

    const adminUsers = adminUsersResult.data?.map((user) => user.data) || []

    // Extract telegramId from communication.telegramId JSONB path
    const telegramIds = adminUsers
      .map((user) => user.data?.communication?.telegramId)
      .filter((id): id is string => !!id && id.trim() !== '') || []

    // Update cache
    cache = {
      ids: new Set(telegramIds),
      lastUpdated: now,
    }

    console.log(
      `[ADMIN BOT WHITELIST] Refreshed whitelist: ${telegramIds.length} admin(s) with Telegram ID`
    )

    return telegramIds
  } catch (error) {
    console.error('[ADMIN BOT WHITELIST] Error fetching admin IDs:', error)
    return cache ? Array.from(cache.ids) : [] // Return stale cache on error
  }
}

/**
 * Check if a Telegram Chat ID is whitelisted
 * @param chatId - Telegram Chat ID to check
 * @returns true if chatId belongs to an ADMIN/SUPERADMIN user
 */
export async function isWhitelisted(chatId: string): Promise<boolean> {
  const whitelist = await getAdminTelegramIds()
  return whitelist.includes(chatId)
}

/**
 * Get user ID from Telegram Chat ID
 * Used for audit logging and permission checks
 * 
 * @param chatId - Telegram Chat ID
 * @returns Ring Platform user ID or null if not found
 */
export async function getUserIdFromTelegramId(chatId: string): Promise<string | null> {
  try {
    const db = getDatabaseService()

    const result = await db.query({
      collection: 'users',
      filters: [
        {
          field: 'role',
          operator: 'in',
          value: [UserRole.ADMIN, UserRole.SUPERADMIN],
        },
      ],
    })

    if (!result.success) return null

    const users = result.data || []
    const user = users.find((u: any) => u.data?.communication?.telegramId === chatId)

    return user?.id || null
  } catch (error) {
    console.error('[ADMIN BOT WHITELIST] Error fetching user ID:', error)
    return null
  }
}

/**
 * Invalidate whitelist cache
 * Call this after updating user telegramId or roles
 */
export function invalidateWhitelistCache(): void {
  cache = null
  console.log('[ADMIN BOT WHITELIST] Cache invalidated')
}
