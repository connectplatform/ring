/**
 * C3: subscription-payment pipeline.
 *
 * Runs periodically (daily recommended) to:
 *   1. Sync Stripe subscription statuses (invoice.payment_succeeded/failed).
 *   2. Check WayForPay recurring payments (recToken-based).
 *
 * Stripe automatic billing handles invoice generation; this cron verifies
 * the local ledger matches Stripe's state (belt-and-suspenders approach).
 *
 * WayForPay recToken integration is a Phase S3 remaining task; this cron
 * provides the entry point for when it's implemented.
 *
 * @stripe_integration Uses Stripe SDK to fetch latest subscription/invoice status.
 */

import 'server-only'

import { db } from '@/lib/database'
import { logger } from '@/lib/logger'
import { subscriptionLedgerSchema } from '@/lib/payments/subscription/subscription-ledger-schema'
import type { SubscriptionLedgerRow } from '@/lib/payments/subscription/subscription-ledger-schema'

const COLLECTION = 'subscription_ledger'
const STRIPE_API_VERSION = '2024-11-20.acacia'

async function syncStripeSubscription(sub: SubscriptionLedgerRow & { id: string }): Promise<{
  synced: boolean
  status?: string
}> {
  if (!sub.stripe_subscription_id) return { synced: false }

  try {
    const secret = process.env.STRIPE_SECRET_KEY
    if (!secret) return { synced: false }

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(secret, { apiVersion: STRIPE_API_VERSION as any })

    const stripeSub = await stripe.subscriptions.retrieve(
      sub.stripe_subscription_id,
    )
    const subData = stripeSub as unknown as Record<string, unknown>
    const stripeStatus = String(subData.status ?? '')

    // Map Stripe status to our ledger status
    const statusMap: Record<string, SubscriptionLedgerRow['status']> = {
      active: 'active',
      past_due: 'grace_period',
      unpaid: 'grace_period',
      canceled: 'cancelled',
      incomplete: 'active',
      incomplete_expired: 'expired',
    }

    const newStatus = statusMap[stripeStatus] ?? sub.status
    const now = Date.now()

    if (newStatus !== sub.status) {
      await db().updateDoc(COLLECTION, sub.id, {
        status: newStatus,
        updated_at: now,
        ...(newStatus === 'cancelled' ? { cancelled_at: now } : {}),
        ...(newStatus === 'expired' ? { expired_at: now } : {}),
      }).catch(() => {})
    }

    // Sync next_payment_due from Stripe (access via raw response for type safety)
    const currentPeriodEnd = subData.current_period_end as number | undefined
    if (typeof currentPeriodEnd === 'number') {
      const stripeNextDue = currentPeriodEnd * 1000 // seconds → ms
      if (Math.abs(stripeNextDue - sub.next_payment_due) > 24 * 60 * 60 * 1000) {
        await db().updateDoc(COLLECTION, sub.id, {
          next_payment_due: stripeNextDue,
          updated_at: now,
        }).catch(() => {})
      }
    }

    return { synced: true, status: newStatus }
  } catch (error) {
    logger.warn('Stripe sync failed for subscription', {
      subscriptionId: sub.id,
      stripeSubscriptionId: sub.stripe_subscription_id,
      error,
    })
    return { synced: false }
  }
}

export async function runSubscriptionPaymentCheck(): Promise<{
  checked: number
  synced: number
  wayforpaySkipped: number
}> {
  // Find all active card subscriptions (stripe + wayforpay)
  const result = await db().queryDocs<Record<string, unknown>>({
    collection: COLLECTION,
    filters: [
      { field: 'provider', operator: 'in', value: ['stripe', 'wayforpay'] },
      { field: 'status', operator: 'in', value: ['active', 'grace_period'] },
    ],
    pagination: { limit: 200 },
  })

  if (!result.success || !result.data) {
    return { checked: 0, synced: 0, wayforpaySkipped: 0 }
  }

  let synced = 0
  let wayforpaySkipped = 0

  for (const raw of result.data) {
    const parsed = subscriptionLedgerSchema.safeParse(raw)
    if (!parsed.success) continue

    const sub = parsed.data as SubscriptionLedgerRow & { id: string }

    if (sub.provider === 'stripe') {
      const { synced: ok } = await syncStripeSubscription(sub)
      if (ok) synced++
    } else if (sub.provider === 'wayforpay') {
      // TODO: Phase S3 — WayForPay recToken recurring integration
      // When implemented, call WayForPay regularApi to check/charge recurring payment
      wayforpaySkipped++
    }
  }

  logger.info('Subscription payment check complete', {
    checked: result.data.length,
    synced,
    wayforpaySkipped,
  })
  return { checked: result.data.length, synced, wayforpaySkipped }
}
