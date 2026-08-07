/**
 * Ring Credit Subscription Provider — internal credit-balance auto-renewal.
 *
 * Reuses the existing `SubscriptionService` logic for credit-balance membership
 * payments.  Wraps it in the `SubscriptionProviderModule` contract so the
 * SubscriptionConductor can route to it like any other provider.
 *
 * Payment method: user's ring-credit-balance (internal ledger).
 * Gateway fee: 0% (ring-config.json: credit_balance.feePercent = 0).
 */

import 'server-only'

import { subscriptionService } from '@/features/membership/services/subscription-service'
import { logger } from '@/lib/logger'
import type {
  SubscriptionProviderModule,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  CancelSubscriptionResult,
  RenewSubscriptionResult,
} from '@/lib/payments/subscription/subscription-types'

export const ringCreditSubscriptionProvider: SubscriptionProviderModule = {
  provider: 'credit_balance',

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    try {
      // Delegate to credit-balance subscription service (SSOT amount from Conductor input).
      // skipCharge when caller already deducted (metadata.prePaid / tx_hash style).
      const skipCharge =
        input.metadata?.prePaid === true ||
        Boolean(input.metadata?.tx_hash) ||
        Boolean(input.metadata?.credit_tx_id)
      const result = await subscriptionService.createSubscription(input.userId, {
        amount: input.amount,
        skipCharge,
      })

      if (!result.success) {
        return { success: false, error: 'Credit subscription creation failed' }
      }

      logger.info('RingCredit subscription created', {
        userId: input.userId,
        amount: input.amount,
        skipCharge,
        nextPaymentDue: result.subscription.next_payment_due,
      })

      return {
        success: true,
        gatewayReference:
          (typeof input.metadata?.credit_tx_id === 'string' && input.metadata.credit_tx_id) ||
          result.contract_address,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.error('RingCredit createSubscription failed', { userId: input.userId, error: message })
      return { success: false, error: message }
    }
  },

  async cancelSubscription(userId: string): Promise<CancelSubscriptionResult> {
    try {
      await subscriptionService.cancelSubscription(userId)
      logger.info('RingCredit subscription cancelled', { userId })
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.error('RingCredit cancelSubscription failed', { userId, error: message })
      return { success: false, error: message }
    }
  },

  async renewSubscription(userId: string): Promise<RenewSubscriptionResult> {
    try {
      const result = await subscriptionService.renewSubscription(userId)

      if (!result.success) {
        return { success: false, error: result.error ?? 'Renewal failed' }
      }

      logger.info('RingCredit subscription renewed', {
        userId,
        amountPaid: result.amount_paid,
        nextPaymentDue: result.next_payment_due,
      })

      return {
        success: true,
        nextPaymentDue: result.next_payment_due,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.error('RingCredit renewSubscription failed', { userId, error: message })
      return { success: false, error: message }
    }
  },
}
