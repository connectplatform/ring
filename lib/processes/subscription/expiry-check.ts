/**
 * C1: subscription-expiry-check pipeline.
 *
 * Runs periodically (daily recommended) to:
 *   1. Find active subscription_ledger rows where next_payment_due + grace
 *      has passed.
 *   2. Mark them as 'expired' in subscription_ledger.
 *   3. Downgrade user role from MEMBER → SUBSCRIBER.
 */

import 'server-only'

import { db } from '@/lib/database'
import { logger } from '@/lib/logger'
import { subscriptionLedgerSchema } from '@/lib/payments/subscription/subscription-ledger-schema'
import type { SubscriptionLedgerRow } from '@/lib/payments/subscription/subscription-ledger-schema'

const COLLECTION = 'subscription_ledger'
const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000

export async function runSubscriptionExpiryCheck(): Promise<{
  checked: number
  expired: number
  downgraded: number
}> {
  const now = Date.now()
  const expiryThreshold = now - GRACE_PERIOD_MS

  // Find active/grace_period subscriptions past the grace period
  const result = await db().queryDocs<Record<string, unknown>>({
    collection: COLLECTION,
    filters: [
      { field: 'status', operator: 'in', value: ['active', 'grace_period'] },
      { field: 'next_payment_due', operator: '<', value: expiryThreshold },
    ],
    pagination: { limit: 200 },
  })

  if (!result.success || !result.data) {
    return { checked: 0, expired: 0, downgraded: 0 }
  }

  let expired = 0
  let downgraded = 0

  for (const raw of result.data) {
    const parsed = subscriptionLedgerSchema.safeParse(raw)
    if (!parsed.success) continue

    const sub = parsed.data as SubscriptionLedgerRow & { id: string }
    const userId = sub.user_id

    // Mark subscription as expired
    await db().updateDoc(COLLECTION, sub.id, {
      status: 'expired',
      expired_at: now,
      auto_renew: false,
      updated_at: now,
    }).catch(() => { /* best-effort */ })
    expired++

    // Downgrade user role: MEMBER → SUBSCRIBER
    const userResult = await db().findDocById('users', userId).catch(() => null)
    if (userResult?.success && userResult.data) {
      const userData = userResult.data as Record<string, unknown>
      const currentTier = String(userData['membership.tier'] ?? userData['membership']?.['tier'] ?? '')

      if (currentTier === 'MEMBER' || currentTier === 'member') {
        await db().updateDoc('users', userId, {
          'membership.tier': 'SUBSCRIBER',
          'membership.auto_renew': false,
          'credit_balance.subscription_active': false,
          updated_at: new Date().toISOString(),
        }).catch(() => { /* best-effort */ })
        downgraded++
      }
    }
  }

  logger.info('Subscription expiry check complete', { checked: result.data.length, expired, downgraded })
  return { checked: result.data.length, expired, downgraded }
}
