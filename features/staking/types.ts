/**
 * features/staking/types.ts — Canonical staking domain model (SSOT for pools/tokens/errors).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BIG PICTURE — ring-staking offers exactly TWO staking products today:
 *
 * 1. SALES DISTRIBUTOR staking
 *    Legacy EVM reference: daarion/daarion-token/contracts/DAARDistributor.sol
 *    A configured share (bps) of every store sale PAID IN NATIVE TOKEN is routed
 *    to the Distributor pool. The pool is emptied each epoch and shared pro-rata
 *    among native-token stakers (share = yourStake / totalStaked, regardless of
 *    absolute size). Example: 5% commission, 1000 RING sales/month → 50 RING
 *    distributed across all stakers by stake percentage.
 *    ⚠ DIVERGENCE FROM LEGACY: DAARDistributor counted ALL transfers between
 *    token holders. The Ring port MUST fund the pool only from STORE SALES
 *    settled in native token — hook: features/store/services/settlement.ts
 *    (commission pipeline, `calculateCommission`). Do NOT tax generic transfers.
 *
 * 2. APR staking
 *    Legacy EVM reference: daarion/daarion-token/contracts/APRStaking.sol
 *    Fixed-APR staking paid out in native token (accRewardPerShare accounting,
 *    scaled 1e12, APR cap in basis points). On the Solana native chain this
 *    product is NFT-COLLECTION staking: NFTs of a configured collection (sold
 *    for native token) are staked and accrue native-token rewards at a fixed
 *    APR over the NFT's face value.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STRUCTURAL DRIFT-PREVENTION RULES (enforced by this module):
 * - Pool ids are CLOSED literal unions derived from `as const` arrays. Runtime
 *   guards and compile-time exhaustiveness derive from the SAME source array —
 *   a new pool id must be added here first, or nothing compiles.
 * - This module imports NOTHING from ./adapters/* or @/lib/ring-config-* —
 *   adapters depend on types, never the reverse (kills the historic
 *   lib/ring-config-chain ⇄ features/staking import cycle).
 * - All staking failures are typed `StakingError`s with machine-readable codes,
 *   so UI agents can map codes → i18n keys without string matching.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Pool identifiers (closed unions — single source for both type & runtime)
// ─────────────────────────────────────────────────────────────────────────────

/** EVM (Polygon, chainId 137) legacy pools — DAAR/DAARION deployments. */
export const EVM_STAKING_POOLS = [
  'DAAR_APR',              // APRStaking.sol — stakeDAAR/unstakeDAAR, 20% APR (2000 bps)
  'DAARION_APR',           // APRStaking.sol — stakeDAARION/unstakeDAARION, 4% APR (400 bps)
  'DAARION_DISTRIBUTOR',   // DAARDistributor.sol — epoch-based sales-commission sharing
] as const
export type EvmStakingPool = (typeof EVM_STAKING_POOLS)[number]

/** Solana (native chain) pools — Ring Anchor programs (see adapters/solana.ts specs). */
export const SOLANA_STAKING_POOLS = [
  'NATIVE_SALES_DISTRIBUTOR', // stake native SPL token (RING) → share of sales commission per epoch
  'NATIVE_NFT_APR',           // stake NFTs of configured collection → fixed APR in native token
] as const
export type SolanaStakingPool = (typeof SOLANA_STAKING_POOLS)[number]

export type StakingPool = EvmStakingPool | SolanaStakingPool

// ─────────────────────────────────────────────────────────────────────────────
// Token symbols
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Token symbols are strings validated at config-build time against the chain
 * slot's token registry (see buildEvmStakingConfigFromSSOT /
 * buildSolanaStakingConfigFromSSOT). `(string & {})` keeps literal
 * autocompletion for the known legacy symbols while allowing clone-specific
 * symbols (e.g. 'RING') that are validated at runtime, not compile time.
 */
export type EvmStakingToken = 'DAAR' | 'DAARION' | (string & {})
export type SolanaStakingToken = 'RING' | (string & {})
export type StakingToken = EvmStakingToken | SolanaStakingToken

// ─────────────────────────────────────────────────────────────────────────────
// Positions & results
// ─────────────────────────────────────────────────────────────────────────────

export type StakingPosition = {
  pool: StakingPool
  token: StakingToken
  /** Symbol of the reward token (native token for both products). */
  rewardToken?: string
  /** Human-readable decimal amounts (formatted, NOT raw base units). */
  stakedAmount: string
  pendingRewards: string
  /** APR in percent (e.g. 20 for 20%). Distributor pools omit (variable). */
  apr?: number
  totalStaked?: string
  /** Unix ms timestamp of the next distributor epoch, when known. */
  nextEpochTime?: number
  lastUpdateTime?: number
  /** NFT APR staking only: mints of the user's staked NFTs. */
  nftMints?: string[]
}

export interface StakeTxResult {
  /** Chain tx signature/hash. Empty string ⇒ nothing to submit (auto-distributed pool). */
  txHash: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter contract — implemented by adapters/evm.ts and adapters/solana.ts
// ─────────────────────────────────────────────────────────────────────────────

export interface StakingAdapter {
  /** Read positions for a wallet address (chain-native address string). */
  getPositions(address: string): Promise<StakingPosition[]>

  /** Fungible-token staking (both products stake native/ERC20 tokens by symbol). */
  stake(token: StakingToken, amount: string): Promise<StakeTxResult>
  unstake(token: StakingToken, amount: string): Promise<StakeTxResult>
  claimRewards(token: StakingToken): Promise<StakeTxResult>

  /** Pool-scoped wrappers for pool-facing UIs (mapping via config.poolToToken). */
  stakeByPool(pool: StakingPool, amount: string): Promise<StakeTxResult>
  unstakeByPool(pool: StakingPool, amount: string): Promise<StakeTxResult>
  claimByPool(pool: StakingPool): Promise<StakeTxResult>

  /** NFT APR staking (Solana NATIVE_NFT_APR pool). Optional — EVM adapter omits. */
  stakeNft?(pool: StakingPool, nftMint: string): Promise<StakeTxResult>
  unstakeNft?(pool: StakingPool, nftMint: string): Promise<StakeTxResult>
}

// ─────────────────────────────────────────────────────────────────────────────
// Runtime guards (derived from the same `as const` arrays — cannot drift)
// ─────────────────────────────────────────────────────────────────────────────

export function isEvmStakingPool(pool: unknown): pool is EvmStakingPool {
  return typeof pool === 'string' && (EVM_STAKING_POOLS as readonly string[]).includes(pool)
}
export function isSolanaStakingPool(pool: unknown): pool is SolanaStakingPool {
  return typeof pool === 'string' && (SOLANA_STAKING_POOLS as readonly string[]).includes(pool)
}
export function isStakingPool(pool: unknown): pool is StakingPool {
  return isEvmStakingPool(pool) || isSolanaStakingPool(pool)
}
/** Token symbols are open sets validated against chain config at build time. */
export function isEvmStakingToken(token: unknown): token is EvmStakingToken {
  return typeof token === 'string' && token.length > 0
}
export function isSolanaStakingToken(token: unknown): token is SolanaStakingToken {
  return typeof token === 'string' && token.length > 0
}

/** Compile-time exhaustiveness helper for pool routing switches. */
export function assertNeverPool(pool: never): never {
  throw new StakingError('POOL_UNKNOWN', `Unhandled staking pool: ${String(pool)}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Typed errors — fail fast, machine-readable, i18n-mappable
// ─────────────────────────────────────────────────────────────────────────────

export type StakingErrorCode =
  | 'CONFIG_INVALID'        // config/slot shape validation failed (fail-fast at build)
  | 'CHAIN_DISABLED'        // chain not enabled in ring-config
  | 'POOL_UNKNOWN'          // pool id not whitelisted / no pool→token mapping
  | 'TOKEN_UNKNOWN'         // token symbol not in the validated token registry
  | 'NOT_DEPLOYED'          // on-chain program/contract not configured yet
  | 'WALLET_NOT_CONNECTED'  // signer/sendTransaction unavailable
  | 'AMOUNT_INVALID'        // non-positive/NaN amount
  | 'METHOD_UNAVAILABLE'    // resolved contract method missing on ABI at runtime
  | 'NFT_NOT_IN_COLLECTION' // NFT mint fails collection verification

export class StakingError extends Error {
  constructor(public readonly code: StakingErrorCode, message: string) {
    super(`[staking:${code}] ${message}`)
    this.name = 'StakingError'
  }
}

export class StakingConfigError extends StakingError {
  constructor(message: string) {
    super('CONFIG_INVALID', message)
    this.name = 'StakingConfigError'
  }
}

export class StakingNotDeployedError extends StakingError {
  constructor(what: string) {
    super('NOT_DEPLOYED', `${what} is not deployed/configured yet — see adapter spec comments for the implementation contract`)
    this.name = 'StakingNotDeployedError'
  }
}
