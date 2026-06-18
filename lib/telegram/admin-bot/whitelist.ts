/**
 * admin TELEGRAM BOT - Whitelist Service
 * Telegram Chat ID whitelist for admin/superadmin users
 * 
 * Truth Lens:
 * - @legiox-truth-lens/ring-backend-administrator.json
 * - @legiox-truth-lens/postgres-db-specialist.json
 * 
 * Security:
 * - Only admin/superadmin with telegramId can interact with bot
 * - 60-second cache to reduce DB load
 * - PALADIN Layer 2: Authorization check
 */

import { db } from '@/lib/database'
import { UserRole } from '@/features/auth/types'

interface WhitelistCache {
  ids: Set<string>
  lastUpdated: number
}

const CACHE_TTL_MS = 60 * 1000 // 60 seconds
let cache: WhitelistCache | null = null

type AdminUserRow = {
  id: string
  communication?: { telegramId?: string }
}

/**
 * Get all Telegram Chat IDs for admin/superadmin users
 * Cached for 60 seconds to reduce database load
 * 
 * @returns Array of Telegram Chat IDs
 */
export async function getAdminTelegramIds(): Promise<string[]> {
  const now = Date.now()

  if (cache && now - cache.lastUpdated < CACHE_TTL_MS) {
    return Array.from(cache.ids)
  }

  try {
    const adminUsersResult = await db().queryDocs<AdminUserRow>({
      collection: 'users',
      filters: [
        {
          field: 'role',
          operator: 'in',
          value: [UserRole.admin, UserRole.superadmin],
        },
      ],
    })

    if (!adminUsersResult.success) {
      console.error('[admin BOT WHITELIST] Failed to query users:', adminUsersResult.error)
      return cache ? Array.from(cache.ids) : []
    }

    const telegramIds = (adminUsersResult.data || [])
      .map((user) => user.communication?.telegramId)
      .filter((id): id is string => !!id && id.trim() !== '')

    cache = {
      ids: new Set(telegramIds),
      lastUpdated: now,
    }

    console.log(
      `[admin BOT WHITELIST] Refreshed whitelist: ${telegramIds.length} admin(s) with Telegram ID`
    )

    return telegramIds
  } catch (error) {
    console.error('[admin BOT WHITELIST] Error fetching admin IDs:', error)
    return cache ? Array.from(cache.ids) : []
  }
}

/**
 * Check if a Telegram Chat ID is whitelisted
 * @param chatId - Telegram Chat ID to check
 * @returns true if chatId belongs to an admin/superadmin user
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
    const result = await db().queryDocs<AdminUserRow>({
      collection: 'users',
      filters: [
        {
          field: 'role',
          operator: 'in',
          value: [UserRole.admin, UserRole.superadmin],
        },
      ],
    })

    if (!result.success) return null

    const user = (result.data || []).find((u) => u.communication?.telegramId === chatId)
    return user?.id || null
  } catch (error) {
    console.error('[admin BOT WHITELIST] Error fetching user ID:', error)
    return null
  }
}

/**
 * Invalidate whitelist cache
 * Call this after updating user telegramId or roles
 */
export function invalidateWhitelistCache(): void {
  cache = null
  console.log('[admin BOT WHITELIST] Cache invalidated')
}
