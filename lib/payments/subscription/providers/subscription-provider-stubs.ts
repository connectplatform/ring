/**
 * Subscription provider stubs — WayForPay has been promoted to its own file
 * (lib/payments/subscription/providers/wayforpay-subscription.ts) since it now
 * has full implementation.  Stripe provider is also at stripe-subscription.ts.
 *
 * Remaining stubs:
 *   - nft_gate (Phase S7) — soulbound NFT certificate membership
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

// ---------------------------------------------------------------------------
// NFT Gate (Phase S7 — TBD)
// ---------------------------------------------------------------------------

export const nftGateSubscriptionProvider: SubscriptionProviderModule = {
  provider: 'nft_gate',

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    // TBD: Phase S7
    // 1. Mint soulbound NFT certificate (12-month)
    // 2. Check NFT ownership → grant membership
    // 3. Cron: check balanceOf(user) > 0 → extend/downgrade
    return { success: false, error: 'NFT gate integration — Phase S7 (TBD)' }
  },

  async cancelSubscription(
    userId: string,
    gatewayReference?: string,
  ): Promise<CancelSubscriptionResult> {
    // TBD: Phase S7 — burn NFT certificate
    return { success: false, error: 'NFT gate integration — Phase S7 (TBD)' }
  },

  async renewSubscription(
    userId: string,
    gatewayReference?: string,
  ): Promise<RenewSubscriptionResult> {
    return { success: false, error: 'NFT gate integration — Phase S7 (TBD)' }
  },
}

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
