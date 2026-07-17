import 'server-only'

import type { RewardCreditAddEventTrigger } from '@/lib/zod/credit-reward-schemas'
import { enqueueRewardCreditAddEvent } from '@/lib/wallet/reward-credit-service'
import { db } from '@/lib/database'

type LooseUser = Record<string, unknown>

function nonEmpty(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'object') {
    // communication channel objects
    return Object.values(value as Record<string, unknown>).some((v) =>
      typeof v === 'string' ? v.trim().length > 0 : Boolean(v),
    )
  }
  return Boolean(value)
}

function getTelegram(user: LooseUser): string | null {
  const comm = user.communication as Record<string, unknown> | undefined
  const v =
    (comm?.telegramUsername as string) ||
    (comm?.telegram as string) ||
    (user.telegram_username as string) ||
    (user.telegramUsername as string)
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function getWhatsapp(user: LooseUser): string | null {
  const comm = user.communication as Record<string, unknown> | undefined
  const v =
    (comm?.whatsappNumber as string) ||
    (comm?.whatsapp as string) ||
    (user.whatsapp_number as string) ||
    (user.whatsappNumber as string)
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function getWebsite(user: LooseUser): string | null {
  const integrations = user.integrations as Record<string, unknown> | undefined
  const social = user.socialMedia as Record<string, unknown> | undefined
  const v =
    (user.website as string) ||
    (integrations?.website as string) ||
    (social?.website as string)
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function getLocation(user: LooseUser): string | null {
  const cultural = user.cultural as Record<string, unknown> | undefined
  const v =
    (user.location as string) ||
    (cultural?.location as string) ||
    (cultural?.timezone as string)
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/** Completeness heuristic aligned with progress widget core fields. */
export function isProfileComplete(user: LooseUser): boolean {
  return Boolean(
    nonEmpty(user.username) &&
      nonEmpty(user.bio) &&
      (getTelegram(user) || getWhatsapp(user)),
  )
}

/**
 * After a successful profile update, enqueue one-time rewards for newly filled fields.
 * Fire-and-forget safe — never throws to callers.
 */
export async function maybeAwardProfileRewards(params: {
  userId: string
  before: LooseUser | null
  after: LooseUser
  userRole?: string | null
}): Promise<void> {
  const { userId, before, after, userRole } = params
  const prev = before || {}
  const username =
    (typeof after.username === 'string' && after.username.trim()) || null
  const isVerified = Boolean(after.isVerified ?? after.is_verified)

  const tryAward = async (trigger: RewardCreditAddEventTrigger) => {
    await enqueueRewardCreditAddEvent({
      userId,
      trigger,
      username,
      isVerified,
      userRole,
    }).catch(() => undefined)
  }

  if (!nonEmpty(prev.username) && nonEmpty(after.username)) {
    await tryAward('ringUsername')
  }
  if (!nonEmpty(prev.bio) && nonEmpty(after.bio)) {
    await tryAward('addedBio')
  }
  if (!getLocation(prev) && getLocation(after)) {
    await tryAward('addedLocation')
  }
  if (!getWebsite(prev) && getWebsite(after)) {
    await tryAward('addedWebsite')
  }
  if (!getTelegram(prev) && getTelegram(after)) {
    await tryAward('addedTelegram')
  }
  if (!getWhatsapp(prev) && getWhatsapp(after)) {
    await tryAward('addedWhatsapp')
  }

  if (!isProfileComplete(prev) && isProfileComplete(after)) {
    await tryAward('profileCompleted')
  }
}

export async function loadUserLoose(userId: string): Promise<LooseUser | null> {
  const result = await db().findDocById<LooseUser>('users', userId)
  if (!result.success || !result.data) return null
  return result.data
}
