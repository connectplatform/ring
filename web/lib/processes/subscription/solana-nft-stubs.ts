/**
 * C4: solana-batch-payment pipeline.
 *
 * Calls Membership.processBatchPayments(batchSize) on-chain via
 * the ring-membership-client (SSOT for on-chain invocation).
 *
 * After processing, parses the BatchPaymentProcessed event from the tx logs
 * and reports processed/successful/failed counts.
 *
 * @phase Phase S6 — Solana contract deployment (completed in Phase 2).
 */

import 'server-only'

import { logger } from '@/lib/logger'
import { processBatchPayments, parseBatchPaymentEvent } from '@/lib/payments/subscription/ring-membership-client'
import { isMembershipDeployed } from '@/lib/payments/subscription/ring-membership-config'

const NOT_DEPLOYED = 'Membership.sol not yet deployed to Solana. ' +
  'Set RING_MEMBERSHIP_CONTRACT_ADDRESS env var or chains.solana.membershipProgramId in ring-config.json.'

const DEFAULT_BATCH_SIZE = 50

export async function runSolanaBatchPayment(batchSize: number = DEFAULT_BATCH_SIZE): Promise<{
  processed: number
  successful: number
  failed: number
  skipped: boolean
  reason?: string
}> {
  if (!isMembershipDeployed()) {
    return { processed: 0, successful: 0, failed: 0, skipped: true, reason: NOT_DEPLOYED }
  }

  try {
    const { txSignature } = await processBatchPayments(batchSize)
    const event = await parseBatchPaymentEvent(txSignature)

    logger.info('Solana batch payment: completed', {
      txSignature,
      batchSize,
      ...event,
    })

    return { ...event, skipped: false }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Solana batch payment: failed', { error: message })
    return { processed: 0, successful: 0, failed: 0, skipped: true, reason: message }
  }
}

/**
 * C5: nft-gate-expiry pipeline.
 *
 * Timed GateEscrow stakes past expiresAt → unstake + invalidate entitlement cache.
 * Burned ownership also revokes. Membership role downgrade via SubscriptionConductor
 * when no remaining membership.member stake.
 *
 * @phase Phase S7 — NFT gate MVP-A
 */

export async function runNftGateExpiry(): Promise<{
  checked: number
  downgraded: number
  skipped: boolean
  reason?: string
}> {
  try {
    const { db } = await import('@/lib/database')
    const { invalidateEntitlementsForAsset } = await import('@/features/nft-gates/gate-escrow')
    const { hasFeature } = await import('@/features/nft-gates/gate-resolver')
    const { MEMBERSHIP_GATE_SLUGS } = await import('@/features/nft-gates/types')

    const stakesResult = await db().queryDocs<{
      id: string
      userId: string
      asset: string
      slug: string
      expiresAt?: string
      unstakedAt?: string
    }>({
      collection: 'nft_stakes',
      pagination: { limit: 500 },
    })

    if (!stakesResult.success || !stakesResult.data) {
      return { checked: 0, downgraded: 0, skipped: true, reason: 'nft_stakes query failed' }
    }

    const now = Date.now()
    let checked = 0
    let downgraded = 0

    for (const stake of stakesResult.data) {
      if (stake.unstakedAt) continue
      checked += 1

      const expired =
        stake.expiresAt && new Date(stake.expiresAt).getTime() <= now

      if (!expired) continue

      await db().updateDoc('nft_stakes', stake.id, {
        unstakedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiryReason: 'duration_elapsed',
      })
      await invalidateEntitlementsForAsset(stake.userId, stake.asset)

      if (MEMBERSHIP_GATE_SLUGS.includes(stake.slug as (typeof MEMBERSHIP_GATE_SLUGS)[number])) {
        const stillMember = await hasFeature(stake.userId, 'membership.member')
        if (!stillMember) {
          const { SubscriptionConductor } = await import(
            '@/lib/payments/subscription/subscription-conductor'
          )
          await SubscriptionConductor.cancelSubscription(stake.userId, 'nft_gate', stake.asset)
          downgraded += 1
        }
      }
    }

    logger.info('NFT gate expiry: completed', { checked, downgraded })
    return { checked, downgraded, skipped: false }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error('NFT gate expiry: failed', { error: message })
    return { checked: 0, downgraded: 0, skipped: true, reason: message }
  }
}
