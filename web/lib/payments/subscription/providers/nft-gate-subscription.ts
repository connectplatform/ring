/**
 * NFT Gate subscription provider — membership via GateEscrow-staked Metaplex Core NFT.
 * Phase S7: buy-with-RING + auto-stake membership slugs → MEMBER role via conductor.
 */

import 'server-only'

import { logger } from '@/lib/logger'
import { purchaseGateNft } from '@/features/nft-gates/purchase'
import { hasFeature } from '@/features/nft-gates/gate-resolver'
import { listActiveStakes, unstakeGateAsset } from '@/features/nft-gates/gate-escrow'
import { MEMBERSHIP_GATE_SLUGS, type NftGateSlug } from '@/features/nft-gates/types'
import type {
  SubscriptionProviderModule,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  CancelSubscriptionResult,
  RenewSubscriptionResult,
} from '@/lib/payments/subscription/subscription-types'

function resolveMembershipSlug(metadata?: Record<string, unknown>): NftGateSlug {
  const slug = metadata?.gateSlug
  if (typeof slug === 'string' && MEMBERSHIP_GATE_SLUGS.includes(slug as NftGateSlug)) {
    return slug as NftGateSlug
  }
  return 'one-month-membership'
}

export const nftGateSubscriptionProvider: SubscriptionProviderModule = {
  provider: 'nft_gate',

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    try {
      const slug = resolveMembershipSlug(input.metadata)
      const roleRaw = input.metadata?.userRole
      const { resolvePersistedUserRole, UserRolesArray } = await import(
        '@/features/auth/user-role'
      )
      const userRole = resolvePersistedUserRole(
        (typeof roleRaw === 'string' ? roleRaw : UserRolesArray.subscriber) as never,
      )

      const result = await purchaseGateNft({
        userId: input.userId,
        slug,
        autoStakeMembership: true,
        userRole,
      })

      if (!result.success || !result.ownership) {
        return {
          success: false,
          error: result.error || 'NFT gate purchase failed',
          ...(result.paySignature ? { txSignature: result.paySignature } : {}),
        }
      }

      logger.info('nftGateSubscriptionProvider: membership gate purchased', {
        userId: input.userId,
        slug,
        asset: result.ownership.asset,
        signature: result.ownership.signature,
      })

      return {
        success: true,
        gatewayReference: result.ownership.asset,
        txSignature: result.ownership.signature,
        subscriptionId: result.ownership.purchaseId,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.error('nftGateSubscriptionProvider: createSubscription failed', {
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
      const stakes = await listActiveStakes(userId)
      const membershipStakes = stakes.filter((s) => MEMBERSHIP_GATE_SLUGS.includes(s.slug))
      const target = gatewayReference
        ? membershipStakes.find((s) => s.asset === gatewayReference)
        : membershipStakes[0]

      if (target) {
        await unstakeGateAsset({ userId, asset: target.asset })
      }

      logger.info('nftGateSubscriptionProvider: cancelled / unstaked', {
        userId,
        asset: target?.asset ?? gatewayReference,
      })
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  },

  async renewSubscription(
    userId: string,
    gatewayReference?: string,
  ): Promise<RenewSubscriptionResult> {
    const stillMember = await hasFeature(userId, 'membership.member')
    if (!stillMember) {
      return { success: false, error: 'No active membership gate stake' }
    }
    return {
      success: true,
      txSignature: gatewayReference,
      nextPaymentDue: undefined,
    }
  },
}
