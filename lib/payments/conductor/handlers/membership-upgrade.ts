import { processSuccessfulPayment } from '@/lib/payments/wayforpay-service'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { ReferralRewardService } from '@/features/refcodes/services/referral-reward-service'
import { logger } from '@/lib/logger'

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
    }
  }
  return processed
}
