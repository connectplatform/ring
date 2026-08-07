/**
 * C2: credit-balance-monthly pipeline.
 *
 * Runs periodically (daily recommended, hourly in production) to:
 *   1. Find active credit_balance subscriptions with next_payment_due <= now.
 *   2. Deduct monthly fee from user's ring-credit-balance.
 *   3. Extend next_payment_due by 30 days.
 *   4. Handle insufficient balance: increment failed_attempts, expire after 3.
 *
 * Reuses existing subscriptionService.renewSubscription() logic.
 */

import 'server-only'

import { db } from '@/lib/database'
import { logger } from '@/lib/logger'
import { subscriptionService } from '@/features/membership/services/subscription-service'
import { subscriptionLedgerSchema } from '@/lib/payments/subscription/subscription-ledger-schema'
import type { SubscriptionLedgerRow } from '@/lib/payments/subscription/subscription-ledger-schema'

const COLLECTION = 'subscription_ledger'

export async function runCreditBalanceMonthly(): Promise<{
  checked: number
  renewed: number
  failed: number
  expired: number
}> {
  const now = Date.now()

  // Find active credit_balance subscriptions due for payment
  const result = await db().queryDocs<Record<string, unknown>>({
    collection: COLLECTION,
    filters: [
      { field: 'provider', operator: '==', value: 'credit_balance' },
      { field: 'status', operator: '==', value: 'active' },
      { field: 'next_payment_due', operator: '<=', value: now },
    ],
    pagination: { limit: 100 },
  })

  if (!result.success || !result.data) {
    return { checked: 0, renewed: 0, failed: 0, expired: 0 }
  }

  let renewed = 0
  let failed = 0
  let expired = 0

  for (const raw of result.data) {
    const parsed = subscriptionLedgerSchema.safeParse(raw)
    if (!parsed.success) continue

    const sub = parsed.data as SubscriptionLedgerRow & { id: string }
    const userId = sub.user_id

    try {
      const renewalResult = await subscriptionService.renewSubscription(userId)

      if (renewalResult.success) {
        // Extend next_payment_due in subscription_ledger
        await db().updateDoc(COLLECTION, sub.id, {
          next_payment_due: now + (30 * 24 * 60 * 60 * 1000),
          failed_attempts: 0,
          payments_count: (sub.payments_count || 0) + 1,
          total_paid: String(Number(sub.total_paid) + sub.amount),
          updated_at: now,
        }).catch(() => {})
        renewed++
      } else if (renewalResult.error?.includes('Insufficient')) {
        // Insufficient balance — increment fails, possibly expire
        const newFails = (sub.failed_attempts || 0) + 1
        if (newFails >= (sub.max_failed_attempts || 3)) {
          await db().updateDoc(COLLECTION, sub.id, {
            status: 'expired',
            failed_attempts: newFails,
            expired_at: now,
            updated_at: now,
          }).catch(() => {})
          expired++
        } else {
          await db().updateDoc(COLLECTION, sub.id, {
            status: 'grace_period',
            failed_attempts: newFails,
            updated_at: now,
          }).catch(() => {})
          failed++
        }
      } else {
        failed++
      }
    } catch (error) {
      logger.error('Credit-balance monthly: renewal failed', { userId, error })
      failed++
    }
  }

  logger.info('Credit balance monthly complete', { checked: result.data.length, renewed, failed, expired })
  return { checked: result.data.length, renewed, failed, expired }
}
