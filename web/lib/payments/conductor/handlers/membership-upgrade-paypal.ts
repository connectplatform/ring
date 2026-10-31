/**
 * PayPal Membership Upgrade webhook handler (Orders v2 CAPTURE — one-shot).
 * Never re-enters PayPal provider create — activates pending ledger or recordPaidSubscription.
 */

import { UserRolesArray, resolveSessionUserRole } from '@/features/auth/user-role'
import { processSuccessfulPayment } from '@/lib/payments/wayforpay-service'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { ReferralRewardService } from '@/features/refcodes/services/referral-reward-service'
import { SubscriptionConductor } from '@/lib/payments/subscription/subscription-conductor'
import { getGatewayConfig } from '@/lib/payments/subscription/subscription-config'
import { getSystemConfigSnapshot } from '@/lib/ring-config-core'
import { logger } from '@/lib/logger'

export async function handleMembershipPayPalCapture(opts: {
  orderReference: string
  userId: string
  userEmail: string
  amount: number
  currency: string
  processorPayload: Record<string, unknown>
}): Promise<boolean> {
  const { orderReference, userId, userEmail, amount, currency, processorPayload } = opts

  if (!orderReference || !userId) {
    logger.error('PayPal membership webhook: missing ids', { orderReference, userId })
    return false
  }

  const isNew = await paymentTransactionService.markPaid(orderReference, processorPayload)
  if (!isNew) {
    logger.info('PayPal membership webhook: already paid', { orderReference })
    return true
  }

  // WayForPay signature checks do not apply to a PayPal capture. Role upgrade is best-effort.
  const processed = await processSuccessfulPayment({
    userId,
    targetRole: resolveSessionUserRole(UserRolesArray.member),
    paymentData: {
      orderReference,
      amount,
      currency: currency.toUpperCase(),
      provider: 'paypal',
    },
  } as never).catch(() => false)

  if (processed) {
    try {
      await ReferralRewardService.onMembershipPaid({
        userId,
        orderReference,
        amount,
        currency: currency.toUpperCase(),
      })
    } catch (referralError) {
      logger.error('PayPal membership: referral reward failed', {
        orderReference,
        userId,
        error: referralError,
      })
    }
  }

  let ledgerUpdated = false
  try {
    const existing = await SubscriptionConductor.getSubscription(userId)
    const paid = amount > 0 ? amount : Number(existing?.amount) || 0
    const snapshotPrice = Number(
      (getSystemConfigSnapshot().membership?.tiers as { memberAnnual?: { amount?: number } } | undefined)
        ?.memberAnnual?.amount,
    )
    const isSnapshot = Number.isFinite(snapshotPrice) && Math.abs(paid - snapshotPrice) < 0.02
    // Only a pending one-shot row may be activated. An active Premium row must stay intact.
    if (existing && existing.status === 'pending') {
      const period = (isSnapshot ? 365 : 30) * 24 * 60 * 60 * 1000
      await SubscriptionConductor.updateSubscriptionStatus(userId, {
        status: 'active',
        auto_renew: isSnapshot ? false : existing.auto_renew,
        next_payment_due: Date.now() + period,
        payments_count: Math.max(1, Number(existing.payments_count) || 0),
        total_paid: String(paid || existing.amount),
        failed_attempts: 0,
        metadata: isSnapshot ? { legioxProduct: 'snapshot' } : undefined,
      })
      ledgerUpdated = true
    } else if (!existing) {
      const gwConfig = getGatewayConfig('paypal')
      await SubscriptionConductor.recordPaidSubscription({
        userId,
        userEmail,
        provider: 'paypal',
        gateway: 'PayPal',
        method: 'paypal',
        amount,
        currency: currency.toUpperCase(),
        gatewayFeePercent: gwConfig?.feePercent ?? 2.9,
        gatewayFeeFixed: (gwConfig?.feeFixedCents ?? 30) / 100,
        metadata: {
          source: 'paypal_orders_capture',
          orderReference,
          auto_renew: !isSnapshot,
          billingPeriod: isSnapshot ? 'yearly' : 'monthly',
          ...(isSnapshot ? { legioxProduct: 'snapshot' } : {}),
        },
      })
      ledgerUpdated = true
    }
  } catch (ledgerError) {
    logger.error('PayPal membership webhook: subscription_ledger update failed', {
      orderReference,
      ledgerError,
    })
  }

  if (ledgerUpdated) {
    logger.info('PayPal membership upgrade: completed', {
      userId,
      orderReference,
      amount,
      currency,
      processed,
    })
  }

  return processed || ledgerUpdated
}
