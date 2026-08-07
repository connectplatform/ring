import 'server-only'

import { db } from '@/lib/database'
import { getEvents } from '@/lib/events/event-log.server'
import type { PaymentPurpose } from '@/lib/payments/conductor/types'

export type AdminActivityFilter = 'all' | 'new_user' | 'verification' | 'payments' | 'rewards'

export interface AdminActivityItem {
  id: string
  category: 'new_user' | 'verification' | 'payments' | 'rewards' | 'other'
  type: string
  message: string
  userId?: string
  timeMs: number
  meta?: Record<string, unknown>
}

const NEW_USER_TYPES = new Set(['user_registered', 'user_created'])
const VERIFICATION_TYPES = new Set([
  'user_verified',
  'user_unverified',
  'admin_manual_verification',
])
const REWARD_TYPES = new Set(['reward_credit_add'])
const PAYMENT_TYPES = new Set([
  'payment_paid',
  'wallet_topup_paid',
  'membership_upgrade_paid',
  'credit_topup',
  'desk_swap',
])

function categorize(type: string): AdminActivityItem['category'] {
  if (NEW_USER_TYPES.has(type)) return 'new_user'
  if (VERIFICATION_TYPES.has(type)) return 'verification'
  if (REWARD_TYPES.has(type)) return 'rewards'
  if (PAYMENT_TYPES.has(type) || type.startsWith('payment_') || type.includes('topup')) {
    return 'payments'
  }
  return 'other'
}

function formatEventMessage(type: string, payload: Record<string, unknown>, userId?: string): string {
  const email = typeof payload.email === 'string' ? payload.email : undefined
  const who = email || userId || 'user'

  switch (type) {
    case 'user_registered':
    case 'user_created':
      return `New user registered: ${who}`
    case 'user_verified':
    case 'admin_manual_verification':
      return `User verified: ${who}`
    case 'user_unverified':
      return `User verification cleared: ${who}`
    case 'wallet_topup_paid':
      return `Credit top-up paid: ${who}`
    case 'membership_upgrade_paid':
      return `Membership payment paid: ${who}`
    case 'payment_paid':
      return `Payment paid (${String(payload.purpose || 'unknown')}): ${who}`
    case 'reward_credit_add':
      return `Reward points credited (${String(payload.trigger || 'reward')}): ${who}`
    case 'desk_swap':
      return `Token desk swap: ${who}`
    default:
      return `${type.replace(/_/g, ' ')}: ${who}`
  }
}

async function loadRecentUsersAsActivity(limit: number): Promise<AdminActivityItem[]> {
  const result = await db().queryDocs<Record<string, unknown>>({
    collection: 'users',
    orderBy: [{ field: 'createdAt', direction: 'desc' }],
    pagination: { limit },
  })
  if (!result.success || !result.data?.length) return []

  return result.data.map((row) => {
    const id = String(row.id ?? '')
    const email = String(row.email ?? id)
    const createdAt = row.createdAt ? new Date(String(row.createdAt)).getTime() : Date.now()
    return {
      id: `synth_user_${id}`,
      category: 'new_user' as const,
      type: 'user_registered',
      message: `New user registered: ${email}`,
      userId: id,
      timeMs: Number.isFinite(createdAt) ? createdAt : Date.now(),
      meta: { source: 'users_table' },
    }
  })
}

async function loadRecentPaymentsAsActivity(limit: number): Promise<AdminActivityItem[]> {
  const result = await db().queryDocs<Record<string, unknown>>({
    collection: 'payment_transactions',
    orderBy: [{ field: 'created_at', direction: 'desc' }],
    pagination: { limit: Math.max(limit * 2, 40) },
  })
  if (!result.success || !result.data?.length) return []

  const purposes = new Set<PaymentPurpose>(['membership_upgrade', 'wallet_topup'])
  return result.data
    .filter((row) => purposes.has(row.purpose as PaymentPurpose))
    .slice(0, limit)
    .map((row) => {
      const purpose = String(row.purpose ?? 'payment')
      const status = String(row.status ?? 'unknown')
      const userId = row.user_id ? String(row.user_id) : undefined
      const orderRef = String(row.order_reference ?? row.id ?? '')
      const created =
        row.paid_at || row.updated_at || row.created_at
          ? new Date(String(row.paid_at || row.updated_at || row.created_at)).getTime()
          : Date.now()
      const type =
        purpose === 'wallet_topup'
          ? 'wallet_topup_paid'
          : purpose === 'membership_upgrade'
            ? 'membership_upgrade_paid'
            : 'payment_paid'
      return {
        id: `pay_${String(row.id ?? orderRef)}`,
        category: 'payments' as const,
        type,
        message: `${purpose.replace(/_/g, ' ')} · ${status}${userId ? ` · ${userId.slice(0, 8)}…` : ''}`,
        userId,
        timeMs: Number.isFinite(created) ? created : Date.now(),
        meta: {
          purpose,
          status,
          orderReference: orderRef,
          amountMinor: row.amount_minor,
          currency: row.currency,
        },
      }
    })
}

async function loadRewardCreditsAsActivity(limit: number): Promise<AdminActivityItem[]> {
  const result = await db().queryDocs<Record<string, unknown>>({
    collection: 'credit_add_events',
    orderBy: [{ field: 'created_at', direction: 'desc' }],
    pagination: { limit },
  })
  if (!result.success || !result.data?.length) return []

  return result.data.map((row) => {
    const userId = row.user_id ? String(row.user_id) : undefined
    const trigger = String(row.trigger ?? 'reward')
    const status = String(row.status ?? 'unknown')
    const created = row.created_at ? new Date(String(row.created_at)).getTime() : Date.now()
    return {
      id: `reward_${String(row.id ?? `${userId}_${trigger}`)}`,
      category: 'rewards' as const,
      type: 'reward_credit_add',
      message: `Reward points (${trigger}) · ${status}${userId ? `: ${userId.slice(0, 8)}…` : ''}`,
      userId,
      timeMs: Number.isFinite(created) ? created : Date.now(),
      meta: { trigger, status, amount: row.amount },
    }
  })
}

/**
 * Build admin Recent Activity feed from events + payment/reward/user fallbacks.
 */
export async function getAdminRecentActivity(opts?: {
  filter?: AdminActivityFilter
  limit?: number
}): Promise<AdminActivityItem[]> {
  const filter = opts?.filter ?? 'all'
  const limit = opts?.limit ?? 30

  const [events, users, payments, rewards] = await Promise.all([
    getEvents({
      limit: 100,
      order: 'desc',
      typeIn:
        filter === 'new_user'
          ? [...NEW_USER_TYPES]
          : filter === 'verification'
            ? [...VERIFICATION_TYPES]
            : filter === 'payments'
              ? [...PAYMENT_TYPES]
              : filter === 'rewards'
                ? [...REWARD_TYPES]
              : undefined,
    }).catch(() => []),
    filter === 'all' || filter === 'new_user'
      ? loadRecentUsersAsActivity(20)
      : Promise.resolve([]),
    filter === 'all' || filter === 'payments'
      ? loadRecentPaymentsAsActivity(20)
      : Promise.resolve([]),
    filter === 'all' || filter === 'rewards'
      ? loadRewardCreditsAsActivity(20)
      : Promise.resolve([]),
  ])

  // Prefer event-log rows; suppress synthetic user rows when a matching event exists.
  const eventItems: AdminActivityItem[] = events.map((e) => {
    const payload = (e.payload || {}) as Record<string, unknown>
    return {
      id: String(e.id ?? `event_${e.timeMs}`),
      category: categorize(e.type),
      type: e.type,
      message: formatEventMessage(e.type, payload, e.userId),
      userId: e.userId,
      timeMs: e.timeMs,
      meta: payload,
    }
  })

  const eventUserKeys = new Set(
    eventItems
      .filter((i) => i.category === 'new_user' && i.userId)
      .map((i) => i.userId as string),
  )
  const synthUsers = users.filter((u) => !u.userId || !eventUserKeys.has(u.userId))

  let merged = [...eventItems, ...synthUsers, ...payments, ...rewards]
  if (filter !== 'all') {
    merged = merged.filter((item) => item.category === filter)
  }

  merged.sort((a, b) => b.timeMs - a.timeMs)

  // Dedupe by id
  const seen = new Set<string>()
  const deduped: AdminActivityItem[] = []
  for (const item of merged) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    deduped.push(item)
    if (deduped.length >= limit) break
  }

  return deduped
}
