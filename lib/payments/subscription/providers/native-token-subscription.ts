/**
 * Native Token Subscription Provider — on-chain via Membership when deployed,
 * else treasury SPL transfer + ledger (soft-launch / pre-program).
 *
 * SSOT:
 *   - ring-membership-client.ts → on-chain invocation when program ID set
 *   - transferNativeTokenForUser → sponsored SPL to treasury when program not deployed
 *   - metadata.tx_hash → skip second transfer when /api/membership/payment/token already paid
 *   - getNativeWallet (lib/wallet/user-wallet-db) → user's custodial wallet
 *   - SubscriptionConductor → subscription_ledger + role upgrade
 *
 * @see contracts/Membership.sol / RingMembership.sol
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
import {
  getNativeTokenSymbol,
  getNativeTokenTreasuryAddress,
} from '@/lib/ring-config-chain'
import { transferNativeTokenForUser } from '@/features/wallet/chains/native-token-transfer-service'
import type {
  SubscriptionProviderModule,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  CancelSubscriptionResult,
  RenewSubscriptionResult,
} from '@/lib/payments/subscription/subscription-types'

async function requireUserNativeWallet(userId: string) {
  const wallet = await getNativeWallet(userId, 'solana')
  if (!wallet) {
    throw new Error('User has no Solana native wallet — call ensureWallets first')
  }
  return wallet
}

function resolveTreasuryAddress(): string {
  const treasury = getNativeTokenTreasuryAddress()
  if (!treasury || treasury === 'RING' || treasury.length < 32) {
    throw new Error(
      'Native token treasury is not configured (tokens.nativeToken.tokenTreasuryAddress / NATIVE_TOKEN_TREASURY_ADDRESS)',
    )
  }
  return treasury
}

/**
 * Soft-launch path: accept a pre-paid SPL tx, or transfer membership fee to treasury now.
 * Used when Membership program ID is empty (ring-platform.org soft launch).
 */
async function createViaTreasuryTransfer(
  input: CreateSubscriptionInput,
): Promise<CreateSubscriptionResult> {
  const existingTx = input.metadata?.tx_hash
  if (existingTx && String(existingTx).trim()) {
    logger.info('nativeTokenSubscriptionProvider: ledger-only (pre-paid tx)', {
      userId: input.userId,
      txHash: existingTx,
    })
    return {
      success: true,
      gatewayReference: String(existingTx),
      txSignature: String(existingTx),
    }
  }

  const amount =
    typeof input.amount === 'number' && input.amount > 0
      ? String(input.amount)
      : null
  if (!amount) {
    return {
      success: false,
      error: 'Native token membership amount is required when Membership program is not deployed',
    }
  }

  const treasuryAddress = resolveTreasuryAddress()
  const transfer = await transferNativeTokenForUser({
    userId: input.userId,
    toAddress: treasuryAddress,
    amount,
  })

  logger.info('nativeTokenSubscriptionProvider: treasury SPL createSubscription', {
    userId: input.userId,
    txHash: transfer.txHash,
    amount,
    symbol: getNativeTokenSymbol(),
  })

  return {
    success: true,
    gatewayReference: transfer.txHash,
    txSignature: transfer.txHash,
  }
}

export const nativeTokenSubscriptionProvider: SubscriptionProviderModule = {
  provider: 'native_token',

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    try {
      if (isMembershipDeployed()) {
        // On-chain Membership deducts fee — do not also SPL-transfer in the API route.
        const wallet = await requireUserNativeWallet(input.userId)
        const { txSignature, userAddress } = await createOnchainSubscription(wallet)

        logger.info('nativeTokenSubscriptionProvider: createSubscription success', {
          userId: input.userId,
          userAddress,
          txSignature,
        })

        return {
          success: true,
          gatewayReference: txSignature,
          txSignature,
        }
      }

      return await createViaTreasuryTransfer(input)
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
        // Soft-launch: ledger cancel is enough (no on-chain subscription account).
        logger.info('nativeTokenSubscriptionProvider: cancel ledger-only (program not deployed)', {
          userId,
          previousTx: gatewayReference,
        })
        return { success: true }
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
      if (isMembershipDeployed()) {
        const wallet = await requireUserNativeWallet(userId)
        const { txSignature } = await renewOnchainSubscription(wallet)
        const sub = await getOnchainSubscription(wallet.address)
        const nextPaymentDue = sub?.nextPaymentDue ?? Date.now() + 30 * 24 * 60 * 60 * 1000

        logger.info('nativeTokenSubscriptionProvider: renewSubscription success', {
          userId,
          txSignature,
          nextPaymentDue,
          previousTx: gatewayReference,
        })
        return { success: true, txSignature, nextPaymentDue }
      }

      // Soft-launch renew: charge treasury transfer for renewal amount from pricing.
      const { getMembershipRingRenewalAmount } = await import('@/lib/membership/pricing')
      const amount = String(getMembershipRingRenewalAmount())
      const treasuryAddress = resolveTreasuryAddress()
      const transfer = await transferNativeTokenForUser({
        userId,
        toAddress: treasuryAddress,
        amount,
      })
      const nextPaymentDue = Date.now() + 30 * 24 * 60 * 60 * 1000
      logger.info('nativeTokenSubscriptionProvider: renew via treasury SPL', {
        userId,
        txHash: transfer.txHash,
        nextPaymentDue,
        previousTx: gatewayReference,
      })
      return { success: true, txSignature: transfer.txHash, nextPaymentDue }
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
