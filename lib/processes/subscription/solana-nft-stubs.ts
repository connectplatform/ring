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
 * Checks NFT ownership for users with nft_gate subscriptions.
 * If the NFT certificate is no longer held (transferred/burned/expired),
 * downgrades the user's membership.
 *
 * @phase Phase S7 — NFT gate integration (TBD).
 */

export async function runNftGateExpiry(): Promise<{
  checked: number
  downgraded: number
  skipped: boolean
  reason?: string
}> {
  // TODO: Phase S7
  // 1. Query subscription_ledger for active nft_gate subscriptions
  // 2. For each user, check NFT balance (soulbound certificate)
  // 3. If balance = 0 → downgrade membership to SUBSCRIBER
  // 4. Optionally: check NFT expiry timestamp (if certificate has time-limit)

  const NOT_YET_IMPLEMENTED = 'NFT gate integration — Phase S7 (TBD)'
  return {
    checked: 0,
    downgraded: 0,
    skipped: true,
    reason: NOT_YET_IMPLEMENTED,
  }
}
