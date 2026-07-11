/**
 * Subscription provider stubs — WayForPay / Stripe / nft_gate promoted to own files.
 *
 * Remaining stubs:
 *   - paypal (Phase S8) — TBD future
 */

import 'server-only'

import type {
  SubscriptionProviderModule,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  CancelSubscriptionResult,
  RenewSubscriptionResult,
} from '@/lib/payments/subscription/subscription-types'

/** Re-export Phase S7 NFT gate provider (Metaplex Core + GateEscrow). */
export { nftGateSubscriptionProvider } from './nft-gate-subscription'

// ---------------------------------------------------------------------------
// PayPal (Phase S8 — TBD future)
// ---------------------------------------------------------------------------

export const paypalSubscriptionProvider: SubscriptionProviderModule = {
  provider: 'paypal',

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    return { success: false, error: 'PayPal integration — Phase S8 (TBD future)' }
  },

  async cancelSubscription(
    userId: string,
    gatewayReference?: string,
  ): Promise<CancelSubscriptionResult> {
    return { success: false, error: 'PayPal integration — Phase S8 (TBD future)' }
  },

  async renewSubscription(
    userId: string,
    gatewayReference?: string,
  ): Promise<RenewSubscriptionResult> {
    return { success: false, error: 'PayPal integration — Phase S8 (TBD future)' }
  },
}
