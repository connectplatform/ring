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
      // Delegate to the existing credit-balance subscription service.
      // It handles: balance check → deduct → create ring_subscriptions row → update user profile
      const result = await subscriptionService.createSubscription(input.userId)

      if (!result.success) {
        return { success: false, error: 'Credit subscription creation failed' }
      }

      logger.info('RingCredit subscription created', {
        userId: input.userId,
        nextPaymentDue: result.subscription.next_payment_due,
      })

      return {
        success: true,
        gatewayReference: result.contract_address, // RING_MEMBERSHIP_CONTRACT_ADDRESS
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
