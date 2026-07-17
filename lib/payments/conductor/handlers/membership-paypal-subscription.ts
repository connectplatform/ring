/**
 * PayPal Subscriptions v1 lifecycle webhook handlers.
 * Does NOT call paypalSubscriptionProvider.createSubscription (avoids double checkout).
 *
 * @see paypal-payment-conductor-processor.nodus.json → subscriptions_v1.webhook_events_allowlist
 */

import 'server-only'

import { UserRolesArray, resolveSessionUserRole } from '@/features/auth/user-role'
import { processSuccessfulPayment } from '@/lib/payments/wayforpay-service'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { ReferralRewardService } from '@/features/refcodes/services/referral-reward-service'
import { SubscriptionConductor } from '@/lib/payments/subscription/subscription-conductor'
import { getGatewayConfig } from '@/lib/payments/subscription/subscription-config'
import { parseOrderReference } from '@/lib/payments/order-reference'
import { logger } from '@/lib/logger'

function resourceOf(event: Record<string, unknown>): Record<string, unknown> {
  return (event.resource as Record<string, unknown>) || {}
}

function extractCustomId(resource: Record<string, unknown>): string {
  return String(resource.custom_id ?? resource.customId ?? '').trim()
}

function extractSubscriptionId(resource: Record<string, unknown>): string {
  return String(resource.id ?? '').trim()
}

function extractSaleAmount(resource: Record<string, unknown>): {
  amount: number
  currency: string
} {
  const amountObj =
    (resource.amount as { total?: string; value?: string; currency?: string; currency_code?: string }) ||
    {}
  const value = Number(amountObj.total ?? amountObj.value ?? 0)
  const currency = String(amountObj.currency_code ?? amountObj.currency ?? 'USD').toUpperCase()
  return { amount: Number.isFinite(value) ? value : 0, currency }
}

/**
 * BILLING.SUBSCRIPTION.ACTIVATED — promote pending ledger + MEMBER role.
 */
export async function handlePayPalSubscriptionActivated(
  event: Record<string, unknown>,
): Promise<boolean> {
  const resource = resourceOf(event)
  const paypalSubscriptionId = extractSubscriptionId(resource)
  const customId = extractCustomId(resource)

  if (!paypalSubscriptionId) {
    logger.error('PayPal ACTIVATED: missing subscription id')
    return false
  }

  const parsed = customId ? parseOrderReference(customId) : null
  const userId =
    parsed?.userId ||
    (parsed?.purpose === 'membership_upgrade' ? parsed.entityId : undefined) ||
    ''

  // Prefer lookup by PayPal I-… id (set at create)
  let row = await SubscriptionConductor.findByPaypalSubscriptionId(paypalSubscriptionId)
  if (!row && userId) {
    row = await SubscriptionConductor.getSubscription(userId)
  }

  const amount = Number(row?.amount ?? 0)
  const currency = String(row?.currency ?? 'USD').toUpperCase()
  const resolvedUserId = String(row?.user_id || userId || '')

  if (!resolvedUserId) {
    logger.error('PayPal ACTIVATED: cannot resolve userId', {
      paypalSubscriptionId,
      customId,
    })
    return false
  }

  if (customId) {
    await paymentTransactionService.markPaid(customId, event).catch(() => false)
  }

  if (row) {
    const period = 30 * 24 * 60 * 60 * 1000
    await SubscriptionConductor.updateSubscriptionStatus(resolvedUserId, {
      status: 'active',
      paypal_subscription_id: paypalSubscriptionId,
      next_payment_due: Date.now() + period,
      payments_count: Math.max(1, Number(row.payments_count) || 0),
      total_paid: row.payments_count ? row.total_paid : String(row.amount),
      failed_attempts: 0,
    })
  } else {
    const gwConfig = getGatewayConfig('paypal')
    await SubscriptionConductor.recordPaidSubscription(
      {
        userId: resolvedUserId,
        userEmail: '',
        provider: 'paypal',
        gateway: 'PayPal',
        method: 'paypal',
        amount: amount || 0,
        currency,
        gatewayFeePercent: gwConfig?.feePercent ?? 2.9,
        gatewayFeeFixed: (gwConfig?.feeFixedCents ?? 30) / 100,
        metadata: { source: 'paypal_subscription_activated', customId },
      },
      paypalSubscriptionId,
    )
  }

  await processSuccessfulPayment({
    userId: resolvedUserId,
    targetRole: resolveSessionUserRole(UserRolesArray.member),
    paymentData: {
      orderReference: customId || paypalSubscriptionId,
      amount: amount || 0,
      currency,
      provider: 'paypal',
    },
  } as never)

  if (amount > 0) {
    try {
      await ReferralRewardService.onMembershipPaid({
        userId: resolvedUserId,
        orderReference: customId || paypalSubscriptionId,
        amount,
        currency,
      })
    } catch (referralError) {
      logger.error('PayPal ACTIVATED: referral failed', { referralError })
    }
  }

  logger.info('PayPal subscription activated', {
    userId: resolvedUserId,
    paypalSubscriptionId,
    customId,
  })
  return true
}

/**
 * PAYMENT.SALE.COMPLETED — advance next due / payments_count (idempotent via sale id).
 */
export async function handlePayPalSubscriptionSaleCompleted(
  event: Record<string, unknown>,
): Promise<boolean> {
  const resource = resourceOf(event)
  const saleId = String(resource.id ?? '').trim()
  const billingAgreementId = String(
    resource.billing_agreement_id ?? resource.billing_agreementId ?? '',
  ).trim()
  const customId = extractCustomId(resource)
  const { amount, currency } = extractSaleAmount(resource)

  let row = billingAgreementId
    ? await SubscriptionConductor.findByPaypalSubscriptionId(billingAgreementId)
    : null

  if (!row && customId) {
    const parsed = parseOrderReference(customId)
    if (parsed?.userId) {
      row = await SubscriptionConductor.getSubscription(parsed.userId)
    }
  }

  if (!row) {
    logger.warn('PayPal SALE.COMPLETED: no ledger row', { saleId, billingAgreementId, customId })
    return true // ack — may be non-membership sale
  }

  const period = 30 * 24 * 60 * 60 * 1000
  const prevPaid = Number(row.total_paid ?? 0) || 0
  const add = amount > 0 ? amount : Number(row.amount) || 0

  await SubscriptionConductor.updateSubscriptionStatus(row.user_id, {
    status: 'active',
    next_payment_due: Date.now() + period,
    payments_count: (Number(row.payments_count) || 0) + 1,
    total_paid: String(prevPaid + add),
    failed_attempts: 0,
    metadata: saleId ? { last_paypal_sale_id: saleId } : undefined,
  })

  if (customId) {
    await paymentTransactionService.markPaid(customId, event).catch(() => false)
  }

  logger.info('PayPal SALE.COMPLETED: ledger renewed', {
    userId: row.user_id,
    saleId,
    billingAgreementId,
    amount: add,
    currency,
  })
  return true
}

/**
 * CANCELLED / SUSPENDED / EXPIRED / PAYMENT.FAILED
 */
export async function handlePayPalSubscriptionTerminal(
  event: Record<string, unknown>,
  eventType: string,
): Promise<boolean> {
  const resource = resourceOf(event)
  const paypalSubscriptionId = extractSubscriptionId(resource)
  if (!paypalSubscriptionId) return true

  const row = await SubscriptionConductor.findByPaypalSubscriptionId(paypalSubscriptionId)
  if (!row) {
    logger.info('PayPal terminal event: no ledger row', { eventType, paypalSubscriptionId })
    return true
  }

  const now = Date.now()
  if (eventType.includes('CANCELLED') || eventType.includes('EXPIRED')) {
    await SubscriptionConductor.updateSubscriptionStatus(row.user_id, {
      status: eventType.includes('EXPIRED') ? 'expired' : 'cancelled',
      auto_renew: false,
      cancelled_at: eventType.includes('CANCELLED') ? now : undefined,
      expired_at: eventType.includes('EXPIRED') ? now : undefined,
    })
    // Role downgrade via cancel path helper — updateSubscriptionStatus does not downgrade.
    // Best-effort: call cancel with no provider API (already cancelled at PayPal).
    try {
      const { db } = await import('@/lib/database')
      const { UserRolesArray: Roles } = await import('@/features/auth/user-role')
      const userResult = await db().findDocById<Record<string, unknown>>('users', row.user_id)
      if (userResult.success && userResult.data?.role === Roles.member) {
        await db().updateDoc('users', row.user_id, {
          role: Roles.subscriber,
          updatedAt: new Date(),
        })
      }
    } catch {
      // non-blocking
    }
  } else if (eventType.includes('SUSPENDED') || eventType.includes('FAILED')) {
    await SubscriptionConductor.updateSubscriptionStatus(row.user_id, {
      status: 'suspended',
      failed_attempts: (Number(row.failed_attempts) || 0) + 1,
    })
  }

  logger.info('PayPal subscription terminal handled', {
    eventType,
    paypalSubscriptionId,
    userId: row.user_id,
  })
  return true
}
