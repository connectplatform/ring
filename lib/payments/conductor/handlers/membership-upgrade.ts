import { processSuccessfulPayment } from '@/lib/payments/wayforpay-service'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { ReferralRewardService } from '@/features/refcodes/services/referral-reward-service'
import { SubscriptionConductor } from '@/lib/payments/subscription/subscription-conductor'
import { getGatewayConfig } from '@/lib/payments/subscription/subscription-config'
import { logger } from '@/lib/logger'

/**
 * WayForPay membership webhook handler.
 *
 * After a successful WayForPay payment, this handler:
 *   1. Verifies + processes the payment (legacy flow)
 *   2. Marks the payment transaction as paid
 *   3. Triggers referral rewards
 *   4. Creates a subscription_ledger row via SubscriptionConductor (NEW)
 *   5. Captures recToken from the webhook payload into subscription_ledger.wayforpay_rec_token
 *      (per WayForPay Guru truth lens — required for subsequent regularApi management calls)
 */
export async function handleMembershipWayForPayWebhook(
  payload: Record<string, unknown>
): Promise<boolean> {
  const orderReference = String(payload.orderReference ?? '')
  const transactionStatus = String(payload.transactionStatus ?? '')

  if (transactionStatus !== 'Approved') {
    logger.warn('Membership WFP webhook: not approved', { orderReference, transactionStatus })
    return false
  }

  const processed = await processSuccessfulPayment(payload as any)
  if (processed) {
    await paymentTransactionService.markPaid(orderReference, payload as Record<string, unknown>)

    const orderParts = orderReference.split('_')
    const userId = orderParts[1]
    if (userId) {
      // Trigger referral rewards (existing flow)
      try {
        await ReferralRewardService.onMembershipPaid({
          userId,
          orderReference,
          amount: Number(payload.amount) || 0,
          currency: String(payload.currency || 'UAH'),
        })
      } catch (referralError) {
        logger.error('Membership webhook: referral reward failed', { orderReference, referralError })
      }

      // Create subscription_ledger row (NEW — Phase S6 integration)
      try {
        const amount = Number(payload.amount) || 0
        const currency = String(payload.currency || 'UAH')
        const gwConfig = getGatewayConfig('wayforpay')
        const userEmail = String(payload.email || '')
        // SSOT: recToken from webhook is the key for all future regularApi calls
        // (STATUS, CHANGE, SUSPEND, RESUME, REMOVE). Per WayForPay Guru truth lens.
        const recToken = payload.recToken ? String(payload.recToken) : undefined

        await SubscriptionConductor.createSubscription({
          userId,
          userEmail,
          provider: 'wayforpay',
          gateway: 'WayForPay',
          method: 'card',
          amount,
          currency,
          gatewayFeePercent: gwConfig?.feePercent ?? 2.5,
          gatewayFeeFixed: gwConfig?.feeFixedCents ?? 0,
          metadata: {
            source: 'wayforpay_webhook',
            orderReference,
            transactionStatus,
            recToken: recToken ?? null,
          },
        })

        logger.info('Membership WFP webhook: subscription_ledger row created', {
          userId,
          orderReference,
          amount,
          currency,
          recTokenCaptured: !!recToken,
        })
      } catch (ledgerError) {
        logger.error('Membership webhook: subscription_ledger create failed', {
          orderReference,
          ledgerError,
        })
        // Non-fatal — the webhook already upgraded the role
      }
    }
  }
  return processed
}
