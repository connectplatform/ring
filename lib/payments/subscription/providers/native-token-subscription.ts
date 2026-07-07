/**
 * Native Token Subscription Provider — on-chain via Membership.
 *
 * Uses the Membership client (lib/payments/subscription/ring-membership-client.ts)
 * to call createSubscription / cancelSubscription / renewSubscription on the
 * Membership program deployed on Solana (Solidity via Solang).
 *
 * SSOT reuses:
 *   - ring-membership-client.ts → on-chain invocation
 *   - getNativeWallet (lib/wallet/user-wallet-db) → user's custodial wallet
 *   - SubscriptionConductor → writes subscription_ledger row + upgrades role
 *
 * @see contracts/Membership.sol
 */

import 'server-only'

import { logger } from '@/lib/logger'
import { getNativeWallet } from '@/lib/wallet/user-wallet-db'
import {
  createOnchainSubscription,
  cancelOnchainSubscription,
  renewOnchainSubscription,
  getOnchainSubscription,
  hasOnchainActiveMembership,
} from '@/lib/payments/subscription/ring-membership-client'
import { isMembershipDeployed } from '@/lib/payments/subscription/ring-membership-config'
import type {
  SubscriptionProviderModule,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  CancelSubscriptionResult,
  RenewSubscriptionResult,
} from '@/lib/payments/subscription/subscription-types'

const NOT_DEPLOYED = 'Membership contract not deployed to Solana. ' +
  'Set RING_MEMBERSHIP_CONTRACT_ADDRESS env var or chains.solana.membershipProgramId in ring-config.json.'

async function requireUserNativeWallet(userId: string) {
  const wallet = await getNativeWallet(userId, 'solana')
  if (!wallet) {
    throw new Error('User has no Solana native wallet — call ensureWallets first')
  }
  return wallet
}

export const nativeTokenSubscriptionProvider: SubscriptionProviderModule = {
  provider: 'native_token',

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    try {
      if (!isMembershipDeployed()) {
        return { success: false, error: NOT_DEPLOYED }
      }

      const wallet = await requireUserNativeWallet(input.userId)
      const { txSignature, userAddress } = await createOnchainSubscription(wallet)

      logger.info('nativeTokenSubscriptionProvider: createSubscription success', {
        userId: input.userId,
        userAddress,
        txSignature,
      })

      return {
        success: true,
        gatewayReference: txSignature, // Solang program stores subscription by user
        txSignature,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.error('nativeTokenSubscriptionProvider: createSubscription failed', {
        userId: input.userId,
        error: message,
      })
      return { success: false, error: message }
    }
  },

  async cancelSubscription(
    userId: string,
    gatewayReference?: string,
  ): Promise<CancelSubscriptionResult> {
    try {
      if (!isMembershipDeployed()) {
        return { success: false, error: NOT_DEPLOYED }
      }
      const wallet = await requireUserNativeWallet(userId)
      const { txSignature } = await cancelOnchainSubscription(wallet)
      logger.info('nativeTokenSubscriptionProvider: cancelSubscription success', {
        userId,
        txSignature,
        previousTx: gatewayReference,
      })
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.error('nativeTokenSubscriptionProvider: cancelSubscription failed', {
        userId,
        error: message,
      })
      return { success: false, error: message }
    }
  },

  async renewSubscription(
    userId: string,
    gatewayReference?: string,
  ): Promise<RenewSubscriptionResult> {
    try {
      if (!isMembershipDeployed()) {
        return { success: false, error: NOT_DEPLOYED }
      }
      const wallet = await requireUserNativeWallet(userId)
      const { txSignature } = await renewOnchainSubscription(wallet)

      // After successful renew, re-read on-chain to get fresh nextPaymentDue
      const sub = await getOnchainSubscription(wallet.address)
      const nextPaymentDue = sub?.nextPaymentDue ?? Date.now() + 30 * 24 * 60 * 60 * 1000

      logger.info('nativeTokenSubscriptionProvider: renewSubscription success', {
        userId,
        txSignature,
        nextPaymentDue,
        previousTx: gatewayReference,
      })
      return { success: true, txSignature, nextPaymentDue }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.error('nativeTokenSubscriptionProvider: renewSubscription failed', {
        userId,
        error: message,
      })
      return { success: false, error: message }
    }
  },
}

// Re-export the read helpers for use by API routes and server actions
export { getOnchainSubscription, hasOnchainActiveMembership }
