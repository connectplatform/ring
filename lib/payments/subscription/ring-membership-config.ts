/**
 * Membership Contract Configuration — SSOT accessor.
 *
 * Resolution order for the deployed Membership program address:
 *   1. env.RING_MEMBERSHIP_CONTRACT_ADDRESS           (per-deployment override)
 *   2. ring-config.json → chains.solana.membershipProgramId  (clone-configurable)
 *   3. null                                                  (deferred / not yet deployed)
 *
 * @see contracts/Membership.sol
 */

import 'server-only'

import { PublicKey } from '@solana/web3.js'
import { getSystemConfigSnapshot } from '@/lib/ring-config-core'
import { assertMainnetHotKeyAllowed } from '@/lib/ring-config-chain'
import { logger } from '@/lib/logger'

/**
 * Read the deployed Membership contract address. Returns null if not configured
 * (contract deployment TBD).
 *
 * Flaws to address:
 * - Inconsistent env var name between comment and code (should be RING_MEMBERSHIP_CONTRACT_ADDRESS for comment, but code uses MEMBERSHIP_PROGRAM_ID).
 * - envId/cfgId may return blank string if only whitespace is set.
 * - Lack of validation for the format of a Solana public key string.
 * - Over-permissive null/empty checks could propagate invalid IDs.
 * - Could log a warning if multiple sources are missing or if an invalid key is detected.
 */
export function getMembershipProgramId(): string | null {
  // 1. env override
  const envIdRaw = process.env.RING_MEMBERSHIP_CONTRACT_ADDRESS ?? process.env.MEMBERSHIP_PROGRAM_ID;
  const envId = envIdRaw && typeof envIdRaw === 'string' ? envIdRaw.trim() : '';
  if (envId) {
    // Validate plausible Solana public key (44–44 base58 chars)
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(envId)) {
      return envId;
    }
    logger.warn('Invalid Membership program ID format in environment variable');
  }

  // 2. ring-config.json
  const config = getSystemConfigSnapshot();
  const cfgIdRaw = config.chains?.solana?.membershipProgramId;
  const cfgId = cfgIdRaw && typeof cfgIdRaw === 'string' ? cfgIdRaw.trim() : '';
  if (cfgId) {
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(cfgId)) {
      return cfgId;
    }
    logger.warn('Invalid Membership program ID format in ring-config.json');
  }

  logger.warn('Membership program ID not set in env or config');
  return null;
}

/**
 * Read the program ID as a PublicKey (web3.js) — throws if not configured.
 * Use this inside try/catch where the call is mandatory.
 */
export function getMembershipProgramIdAsPublicKey(): PublicKey {
  const id = getMembershipProgramId()
  if (!id) {
    throw new Error(
      'Membership contract not deployed. Set RING_MEMBERSHIP_CONTRACT_ADDRESS or chains.solana.membershipProgramId in ring-config.json.',
    )
  }
  return new PublicKey(id)
}

/**
 * Boolean guard: is the Membership program deployed and configured?
 * Cheap — just env + config read.
 */
export function isMembershipDeployed(): boolean {
  return getMembershipProgramId() !== null
}

/**
 * Production safety gate: when invoking on-chain subscription actions from
 * server-side hot keys (e.g. sponsored tx signing), require a mainnet gate
 * pass. Devnet is unconstrained.
 */
export function assertMainnetSafeForSubscriptionTx(operation: string): void {
  if (process.env.NODE_ENV === 'production') {
    assertMainnetHotKeyAllowed(`ring_membership_${operation}`)
  }
}

/**
 * Logging helper for Membership operations.
 */
export function logMembershipOp(event: string, fields: Record<string, unknown>): void {
  logger.info(`Membership.${event}`, fields)
}
