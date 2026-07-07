/**
 * features/staking/adapters/solana.ts — Solana (native chain) staking adapter.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BIG PICTURE — two staking products on the Solana native chain (RING):
 *
 * 1. SALES DISTRIBUTOR staking — pool 'NATIVE_SALES_DISTRIBUTOR'
 *    Port of daarion/daarion-token/contracts/DAARDistributor.sol semantics:
 *    users stake the native SPL token (RING); a configured share
 *    (salesCommissionBps) of every STORE SALE PAID IN NATIVE TOKEN funds the
 *    distributor pool; each epoch the pool is shared pro-rata by stake weight.
 *    ⚠ DIVERGENCE FROM LEGACY (by design): the legacy EVM contract taxed ALL
 *    holder-to-holder transfers. The Ring port funds the pool ONLY from store
 *    sales settled in native token — the funding hook lives in
 *    features/store/services/settlement.ts (commission pipeline), which
 *    transfers the commission to the distributor vault and calls `fund`.
 *    ⚠ ACCOUNTING UPGRADE (by design): legacy distributeRewards() is an
 *    owner-pushed O(n) transfer loop. The Solana program uses PULL-BASED
 *    claims with acc_reward_per_share accounting (ported from APRStaking.sol,
 *    scaled 1e12) — same economics, no owner crank over all recipients.
 *
 * 2. NFT APR staking — pool 'NATIVE_NFT_APR'
 *    Port of daarion/daarion-token/contracts/APRStaking.sol semantics to NFT
 *    collection staking: NFTs of a configured Metaplex collection (sold for
 *    native token on the native chain) are staked into a vault PDA and accrue
 *    native-token rewards at a fixed APR (nftAprBps) over the NFT face value:
 *      pending = face_value * apr_bps * elapsed / (10_000 * SECONDS_PER_YEAR)
 *    Rewards are paid from a treasury-funded reward vault — NOT minted
 *    (fee-credits framing per LegioX truth lens solana-staking-ring-module:
 *    no inflationary mint without governance approval).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ANCHOR PROGRAM SPEC (for the on-chain implementing agent)
 * ─────────────────────────────────────────────────────────────────────────────
 * Program A: ring_sales_distributor
 *   State:
 *     DistributorState PDA seeds = [b"distributor", native_mint]
 *       { authority: Pubkey (Squads vault), native_mint: Pubkey,
 *         epoch_duration: i64, last_epoch_ts: i64,
 *         total_staked: u64, acc_reward_per_share: u128 (1e12-scaled),
 *         vault_bump: u8, bump: u8 }
 *     StakeRecord PDA seeds = [b"stake", distributor_state, owner]
 *       { owner: Pubkey, amount: u64, reward_debt: u128, reward_credit: u64, bump: u8 }
 *     Vault = ATA(native_mint, owner = DistributorState PDA)
 *   Instructions:
 *     initialize(epoch_duration)             — authority-gated, once
 *     stake(amount)                          — transferChecked user ATA → vault;
 *                                              settle pending into reward_credit;
 *                                              amount += ; reward_debt = amount * acc / 1e12
 *     unstake(amount)                        — require!(amount <= record.amount);
 *                                              settle pending; transferChecked back
 *     fund(amount)                           — PERMISSIONLESS deposit (settlement crank):
 *                                              transferChecked funder ATA → vault;
 *                                              acc_reward_per_share += amount * 1e12 / total_staked;
 *                                              if total_staked == 0 → hold in undistributed buffer
 *     claim()                                — pending = amount * acc / 1e12 - reward_debt
 *                                              + reward_credit; pay from vault; reset debt/credit
 *   Security (per solana-anchor-program-security lens): seeds+bump constraints on
 *   every account, require! balance checks, upgrade authority → Squads before
 *   mainnet, IDL published & pinned, malicious-account-substitution tests.
 *
 * Program B: ring_nft_apr_staking
 *   State:
 *     NftAprConfig PDA seeds = [b"nft_config", collection_mint]
 *       { authority: Pubkey (Squads), collection_mint: Pubkey,
 *         reward_mint: Pubkey (native), apr_bps: u16, face_value: u64, bump: u8 }
 *     NftStakeRecord PDA seeds = [b"nft_stake", owner, nft_mint]
 *       { owner: Pubkey, nft_mint: Pubkey, staked_ts: i64, face_value: u64,
 *         claimed: u64, bump: u8 }
 *     RewardVault = ATA(reward_mint, owner = NftAprConfig PDA) — treasury-funded
 *   Instructions:
 *     stake_nft(nft_mint)   — VERIFY Metaplex metadata: collection.verified == true
 *                             && collection.key == collection_mint, else
 *                             NFT_NOT_IN_COLLECTION; transfer NFT to vault ATA
 *                             owned by NftStakeRecord PDA; record staked_ts + face_value
 *     claim(nft_mint)       — pending = face_value * apr_bps * (now - staked_ts_or_last_claim)
 *                             / (10_000 * SECONDS_PER_YEAR); transferChecked from RewardVault
 *     unstake_nft(nft_mint) — auto-claim, return NFT to owner ATA, close record (rent → owner)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CLIENT IMPLEMENTATION SPEC (for the wallet-page implementing agent)
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Config: server components call buildSolanaStakingConfigFromSSOT() (reads
 *    ring-config via getNativeChainConfig). Client components MUST receive the
 *    built config (or the chainSlot) as serializable props — do not read
 *    ring-config-core from the client bundle.
 * 2. Execution: once the Anchor programs are deployed, implement a
 *    SolanaStakingTxExecutor (Anchor Program client + IDL) and inject it via
 *    config.executeTx. The adapter validates intents and routes; the executor
 *    builds/signs/sends. Until then adapter methods throw
 *    StakingNotDeployedError — surface as "coming soon" UI, never a crash.
 * 3. Wallets:
 *    - Self-custody: @solana/wallet-adapter — executor calls
 *      wallet.sendTransaction(tx, connection).
 *    - Ring custodial/sponsored path (per truth lens: user holds zero SOL):
 *      server route partially signs with getFeePayerKeypair()
 *      (features/wallet/chains/solana/solana-client.ts), user key signs via
 *      lib/wallet/decrypt-user-wallet.ts, server submits. Sponsor pays SOL fees.
 * 4. Funding crank: extend features/store/services/settlement.ts — after a
 *    native-token order settles, transfer salesCommissionBps of the sale to the
 *    distributor vault ATA and invoke `fund(amount)` with the sponsor fee payer.
 * 5. Positions: implement a server reader (mirror of
 *    features/staking/server/read-positions.ts) that fetches StakeRecord /
 *    NftStakeRecord PDAs via connection.getProgramAccounts + Anchor coder, and
 *    inject through overrides.readPositions.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type {
  StakingAdapter,
  StakingPosition,
  StakingPool,
  StakingToken,
  StakeTxResult,
  SolanaStakingPool,
} from '../types'
import {
  StakingError,
  StakingConfigError,
  StakingNotDeployedError,
  isSolanaStakingPool,
  assertNeverPool,
} from '../types'
import { getNativeChainConfig } from '@/lib/ring-config-chain'
import type { SolanaChainConfig } from '@/lib/ring-config-chain'

// ─────────────────────────────────────────────────────────────────────────────
// Address / IDL brands + runtime guards
// ─────────────────────────────────────────────────────────────────────────────

/** Solana address — base58 string, 32–44 chars (brand prevents raw-string mixups). */
export type SolanaAddress = string & { readonly __solanaAddressBrand: unique symbol }

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
/** Placeholder sentinels found in scaffolded ring-config.json → "not deployed". */
const PLACEHOLDER_RE = /^(?:0x0+|0+|)$/

export function isSolanaAddress(addr: unknown): addr is SolanaAddress {
  return typeof addr === 'string' && BASE58_RE.test(addr)
}

export function asSolanaAddress(addr: string): SolanaAddress {
  if (!isSolanaAddress(addr)) {
    throw new StakingConfigError(`Invalid Solana address (expected base58 32-44 chars): "${addr}"`)
  }
  return addr
}

/**
 * Normalize a raw config value into a deployed address or undefined.
 * - null / undefined / '' / zero-placeholders ("0x000...", "000...") → undefined
 * - valid base58 → branded address
 * - anything else → fail fast (misconfiguration must never pass silently)
 */
function deployedAddressOrUndefined(value: unknown, field: string): SolanaAddress | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value !== 'string') {
    throw new StakingConfigError(`${field} must be a base58 string or null, got ${typeof value}`)
  }
  if (PLACEHOLDER_RE.test(value.trim())) return undefined
  return asSolanaAddress(value.trim())
}

/** Solana "ABI" — an Anchor IDL JSON object (kept as `SolanaAbi` for back-compat). */
export type SolanaAbi = Readonly<Record<string, unknown>>
export function asSolanaAbi(idl: unknown): SolanaAbi {
  if (typeof idl !== 'object' || idl === null || Array.isArray(idl)) {
    throw new StakingConfigError('Invalid Solana IDL: expected a JSON object')
  }
  return idl as SolanaAbi
}

function isBps(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10_000
}

// ─────────────────────────────────────────────────────────────────────────────
// Raw slot shape (UNTRUSTED — chains.solana.staking in ring-config.json)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Expected ring-config.json layout (documented for the config agent):
 * "chains": { "solana": { "staking": {
 *   "programs": {
 *     "salesDistributor": "<base58 program id or null>",
 *     "nftAprStaking":    "<base58 program id or null>"
 *   },
 *   "salesCommissionBps":   500,        // 5% of native-token store sales
 *   "epochDurationSeconds": 2592000,    // 30-day distribution epochs
 *   "nftCollectionMint":    "<base58 collection mint or null>",
 *   "nftAprBps":            2000,       // 20% APR on NFT face value
 *   "poolToToken": {
 *     "NATIVE_SALES_DISTRIBUTOR": "RING",
 *     "NATIVE_NFT_APR":           "RING"
 *   }
 * }}}
 * Legacy alias: contracts.{aprStaking,feeDistributor} map to
 * programs.{nftAprStaking,salesDistributor} respectively.
 */
export interface SolanaStakingSlotConfig {
  programs?: {
    salesDistributor?: string | null
    nftAprStaking?: string | null
  }
  salesCommissionBps?: number
  epochDurationSeconds?: number
  nftCollectionMint?: string | null
  nftAprBps?: number
  poolToToken?: Readonly<Record<string, string>>
  /** Legacy aliases (scaffolded configs) — normalized by the builder. */
  contracts?: {
    aprStaking?: unknown
    feeDistributor?: unknown
    erc20?: unknown
  }
  methods?: unknown
}

// ─────────────────────────────────────────────────────────────────────────────
// Built (TRUSTED) config — produced only by the validating builder
// ─────────────────────────────────────────────────────────────────────────────

export interface SolanaNativeTokenInfo {
  symbol: string
  mint: SolanaAddress
  decimals: number
}

export interface SolanaSalesDistributorConfig {
  programId: SolanaAddress
  /** bps of every native-token store sale routed to the distributor pool. */
  commissionBps: number
  epochDurationSeconds: number
}

export interface SolanaNftAprConfig {
  programId: SolanaAddress
  /** Metaplex collection mint whose verified members are stakeable. */
  collectionMint: SolanaAddress
  /** Fixed APR in basis points over NFT face value, paid in native token. */
  aprBps: number
}

/** Typed intents — the adapter validates & routes; the executor builds/sends. */
export type SolanaStakingIntent =
  | { kind: 'stake'; pool: 'NATIVE_SALES_DISTRIBUTOR'; owner: SolanaAddress; amountRaw: bigint }
  | { kind: 'unstake'; pool: 'NATIVE_SALES_DISTRIBUTOR'; owner: SolanaAddress; amountRaw: bigint }
  | { kind: 'claim'; pool: SolanaStakingPool; owner: SolanaAddress }
  | { kind: 'stakeNft'; pool: 'NATIVE_NFT_APR'; owner: SolanaAddress; nftMint: SolanaAddress }
  | { kind: 'unstakeNft'; pool: 'NATIVE_NFT_APR'; owner: SolanaAddress; nftMint: SolanaAddress }

export type SolanaStakingTxExecutor = (
  intent: SolanaStakingIntent,
  config: SolanaStakingConfig
) => Promise<StakeTxResult>

export interface SolanaStakingConfig {
  /** Resolved RPC endpoint (server resolves env; client receives the value). */
  rpcUrl: string
  commitment: 'processed' | 'confirmed' | 'finalized'
  nativeToken: SolanaNativeTokenInfo
  /** Present only when the program id is configured (deployed). */
  salesDistributor?: SolanaSalesDistributorConfig
  nftApr?: SolanaNftAprConfig
  poolToToken: Readonly<Partial<Record<StakingPool, string>>>
  /** Connected wallet address provider — injected by the ring-wallet slot. */
  getOwnerAddress: () => Promise<SolanaAddress | null>
  /** Anchor tx executor — injected once programs are deployed (see CLIENT SPEC). */
  executeTx?: SolanaStakingTxExecutor
  /** Server-side/cached position reader (see CLIENT SPEC §5). */
  readPositions?: (address: string) => Promise<StakingPosition[]>
}

// ─────────────────────────────────────────────────────────────────────────────
// SSOT config builder — mirrors buildEvmStakingConfigFromSSOT hardening:
// deep validation, fail-fast, cross-validation, frozen output.
// ─────────────────────────────────────────────────────────────────────────────

export interface BuildSolanaStakingConfigOverrides {
  getOwnerAddress: () => Promise<SolanaAddress | null>
  /** Injectable slot for tests/client; defaults to live ring-config chains.solana. */
  chainSlot?: SolanaChainConfig
  /** Resolved RPC endpoint override (client passes the server-resolved value). */
  rpcUrl?: string
  /** Allowlist of token symbols valid on this chain (ring-config tokens.supported). */
  knownTokenSymbols?: readonly string[]
  executeTx?: SolanaStakingTxExecutor
  readPositions?: (address: string) => Promise<StakingPosition[]>
}

export function buildSolanaStakingConfigFromSSOT(
  overrides: BuildSolanaStakingConfigOverrides
): SolanaStakingConfig {
  const slot = overrides.chainSlot ?? getNativeChainConfig().solana

  // ---- Slot presence & enablement ----
  if (!slot || typeof slot !== 'object') {
    throw new StakingConfigError('Solana chain slot is missing — check ring-config chains.solana')
  }
  if (slot.enabled === false) {
    throw new StakingError('CHAIN_DISABLED', 'Solana chain is not enabled in ring-config')
  }

  // ---- Native token fields — exhaustive shape check ----
  const mint = deployedAddressOrUndefined(slot.tokenAddress, 'chains.solana.tokenAddress')
  if (!mint) {
    throw new StakingConfigError('chains.solana.tokenAddress (native SPL mint) is not configured — staking requires a deployed native token')
  }
  const decimals = slot.tokenDecimals
  if (typeof decimals !== 'number' || !Number.isInteger(decimals) || decimals < 0 || decimals > 12) {
    throw new StakingConfigError(`chains.solana.tokenDecimals invalid: ${String(decimals)} (expected integer 0..12)`)
  }
  const symbol = typeof slot.tokenSymbol === 'string' && slot.tokenSymbol.trim().length > 0
    ? slot.tokenSymbol.trim()
    : undefined
  if (!symbol) {
    throw new StakingConfigError('chains.solana.tokenSymbol missing')
  }
  if (overrides.knownTokenSymbols && !overrides.knownTokenSymbols.includes(symbol)) {
    throw new StakingError(
      'TOKEN_UNKNOWN',
      `Solana tokenSymbol "${symbol}" is not in the known token registry [${overrides.knownTokenSymbols.join(', ')}]`
    )
  }

  // ---- RPC resolution (server resolves env var; client passes value) ----
  const rpcUrl =
    overrides.rpcUrl ??
    (typeof slot.rpcUrlEnv === 'string' ? process.env[slot.rpcUrlEnv] : undefined) ??
    process.env.SOLANA_RPC_URL ??
    'https://api.devnet.solana.com'
  const commitment = slot.commitment ?? 'confirmed'
  if (!['processed', 'confirmed', 'finalized'].includes(commitment)) {
    throw new StakingConfigError(`chains.solana.commitment invalid: "${String(commitment)}"`)
  }

  if (typeof overrides.getOwnerAddress !== 'function') {
    throw new StakingConfigError('getOwnerAddress must be a function returning Promise<SolanaAddress | null>')
  }

  // ---- Staking section (tolerates legacy contract aliases, validates deeply) ----
  const raw: SolanaStakingSlotConfig =
    slot.staking && typeof slot.staking === 'object' ? (slot.staking as SolanaStakingSlotConfig) : {}

  // Legacy alias normalization: contracts.feeDistributor → programs.salesDistributor,
  // contracts.aprStaking → programs.nftAprStaking (only when programs absent).
  const salesDistributorId = deployedAddressOrUndefined(
    raw.programs?.salesDistributor ?? raw.contracts?.feeDistributor,
    'chains.solana.staking.programs.salesDistributor'
  )
  const nftAprProgramId = deployedAddressOrUndefined(
    raw.programs?.nftAprStaking ?? raw.contracts?.aprStaking,
    'chains.solana.staking.programs.nftAprStaking'
  )

  // ---- Sales distributor product ----
  let salesDistributor: SolanaSalesDistributorConfig | undefined
  if (salesDistributorId) {
    const commissionBps = raw.salesCommissionBps ?? 500
    const epochDurationSeconds = raw.epochDurationSeconds ?? 30 * 24 * 60 * 60
    if (!isBps(commissionBps)) {
      throw new StakingConfigError(`staking.salesCommissionBps invalid: ${String(raw.salesCommissionBps)} (expected integer 0..10000)`)
    }
    if (typeof epochDurationSeconds !== 'number' || !Number.isInteger(epochDurationSeconds) || epochDurationSeconds <= 0) {
      throw new StakingConfigError(`staking.epochDurationSeconds invalid: ${String(raw.epochDurationSeconds)} (expected positive integer)`)
    }
    salesDistributor = Object.freeze({ programId: salesDistributorId, commissionBps, epochDurationSeconds })
  }

  // ---- NFT APR product (cross-validation: program requires collection mint) ----
  let nftApr: SolanaNftAprConfig | undefined
  if (nftAprProgramId) {
    const collectionMint = deployedAddressOrUndefined(raw.nftCollectionMint, 'chains.solana.staking.nftCollectionMint')
    if (!collectionMint) {
      throw new StakingConfigError('staking.nftCollectionMint is required when programs.nftAprStaking is configured')
    }
    const aprBps = raw.nftAprBps ?? 2000
    if (!isBps(aprBps)) {
      throw new StakingConfigError(`staking.nftAprBps invalid: ${String(raw.nftAprBps)} (expected integer 0..10000)`)
    }
    nftApr = Object.freeze({ programId: nftAprProgramId, collectionMint, aprBps })
  }

  // ---- poolToToken: whitelist keys against the CLOSED solana pool union,
  //      cross-validate token symbols against the validated native token ----
  const poolToTokenBuilt: Partial<Record<StakingPool, string>> = {}
  const rawPoolToToken = raw.poolToToken ?? {
    NATIVE_SALES_DISTRIBUTOR: symbol,
    NATIVE_NFT_APR: symbol,
  }
  for (const [poolId, tokenSymbol] of Object.entries(rawPoolToToken)) {
    if (!isSolanaStakingPool(poolId)) {
      throw new StakingError('POOL_UNKNOWN', `staking.poolToToken contains unknown Solana pool "${poolId}"`)
    }
    if (tokenSymbol !== symbol) {
      throw new StakingError('TOKEN_UNKNOWN', `staking.poolToToken["${poolId}"] → "${String(tokenSymbol)}" — only the native token "${symbol}" is stakeable on Solana`)
    }
    poolToTokenBuilt[poolId] = tokenSymbol
  }

  return Object.freeze({
    rpcUrl,
    commitment: commitment as 'processed' | 'confirmed' | 'finalized',
    nativeToken: Object.freeze({ symbol, mint, decimals }),
    salesDistributor,
    nftApr,
    poolToToken: Object.freeze(poolToTokenBuilt),
    getOwnerAddress: overrides.getOwnerAddress,
    executeTx: overrides.executeTx,
    readPositions: overrides.readPositions,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter factory
// ─────────────────────────────────────────────────────────────────────────────

/** Convert a decimal string into raw base units (bigint) for the native mint. */
function toRawAmount(amount: string, decimals: number): bigint {
  const n = Number(amount)
  if (!Number.isFinite(n) || n <= 0) {
    throw new StakingError('AMOUNT_INVALID', `Amount must be a positive decimal string, got "${amount}"`)
  }
  const [intPart, fracPart = ''] = amount.trim().split('.')
  const frac = (fracPart + '0'.repeat(decimals)).slice(0, decimals)
  return BigInt(`${intPart}${frac}`.replace(/^0+(?=\d)/, '') || '0')
}

export function createSolanaStakingAdapter(config: SolanaStakingConfig): StakingAdapter {
  async function requireOwner(): Promise<SolanaAddress> {
    const owner = await config.getOwnerAddress()
    if (!owner) throw new StakingError('WALLET_NOT_CONNECTED', 'Solana wallet not connected')
    return owner
  }

  function requireExecutor(): SolanaStakingTxExecutor {
    if (!config.executeTx) {
      throw new StakingNotDeployedError('Solana staking tx executor (Anchor client)')
    }
    return config.executeTx
  }

  function requireDistributor(): SolanaSalesDistributorConfig {
    if (!config.salesDistributor) {
      throw new StakingNotDeployedError('ring_sales_distributor program (chains.solana.staking.programs.salesDistributor)')
    }
    return config.salesDistributor
  }

  function requireNftApr(): SolanaNftAprConfig {
    if (!config.nftApr) {
      throw new StakingNotDeployedError('ring_nft_apr_staking program (chains.solana.staking.programs.nftAprStaking)')
    }
    return config.nftApr
  }

  function requireNativeToken(token: StakingToken): void {
    if (token !== config.nativeToken.symbol) {
      throw new StakingError('TOKEN_UNKNOWN', `Only the native token "${config.nativeToken.symbol}" is stakeable on Solana, got "${String(token)}"`)
    }
  }

  return {
    /**
     * Read staking positions (both products) for a wallet address.
     * Reads are delegated to the injected server reader (CLIENT SPEC §5);
     * without it we honestly return [] — never fabricated placeholders.
     */
    async getPositions(address: string): Promise<StakingPosition[]> {
      if (config.readPositions) return config.readPositions(address)
      return []
    },

    /** Stake native SPL token into the sales distributor pool. */
    async stake(token: StakingToken, amount: string): Promise<StakeTxResult> {
      requireNativeToken(token)
      requireDistributor()
      const owner = await requireOwner()
      const amountRaw = toRawAmount(amount, config.nativeToken.decimals)
      return requireExecutor()({ kind: 'stake', pool: 'NATIVE_SALES_DISTRIBUTOR', owner, amountRaw }, config)
    },

    async unstake(token: StakingToken, amount: string): Promise<StakeTxResult> {
      requireNativeToken(token)
      requireDistributor()
      const owner = await requireOwner()
      const amountRaw = toRawAmount(amount, config.nativeToken.decimals)
      return requireExecutor()({ kind: 'unstake', pool: 'NATIVE_SALES_DISTRIBUTOR', owner, amountRaw }, config)
    },

    /** Claim distributor rewards (pull-based — see ANCHOR SPEC Program A). */
    async claimRewards(token: StakingToken): Promise<StakeTxResult> {
      requireNativeToken(token)
      requireDistributor()
      const owner = await requireOwner()
      return requireExecutor()({ kind: 'claim', pool: 'NATIVE_SALES_DISTRIBUTOR', owner }, config)
    },

    // ---- Pool-scoped routing: exhaustive over the CLOSED solana pool union ----

    async stakeByPool(pool: StakingPool, amount: string): Promise<StakeTxResult> {
      if (!isSolanaStakingPool(pool)) {
        throw new StakingError('POOL_UNKNOWN', `Pool "${String(pool)}" is not a Solana staking pool`)
      }
      switch (pool) {
        case 'NATIVE_SALES_DISTRIBUTOR':
          return this.stake(config.nativeToken.symbol, amount)
        case 'NATIVE_NFT_APR':
          // NFTs are staked by mint, not by amount — UI must call stakeNft.
          throw new StakingError('POOL_UNKNOWN', 'NATIVE_NFT_APR stakes NFTs by mint — use stakeNft(pool, nftMint)')
        default:
          return assertNeverPool(pool)
      }
    },

    async unstakeByPool(pool: StakingPool, amount: string): Promise<StakeTxResult> {
      if (!isSolanaStakingPool(pool)) {
        throw new StakingError('POOL_UNKNOWN', `Pool "${String(pool)}" is not a Solana staking pool`)
      }
      switch (pool) {
        case 'NATIVE_SALES_DISTRIBUTOR':
          return this.unstake(config.nativeToken.symbol, amount)
        case 'NATIVE_NFT_APR':
          throw new StakingError('POOL_UNKNOWN', 'NATIVE_NFT_APR unstakes NFTs by mint — use unstakeNft(pool, nftMint)')
        default:
          return assertNeverPool(pool)
      }
    },

    async claimByPool(pool: StakingPool): Promise<StakeTxResult> {
      if (!isSolanaStakingPool(pool)) {
        throw new StakingError('POOL_UNKNOWN', `Pool "${String(pool)}" is not a Solana staking pool`)
      }
      const owner = await requireOwner()
      switch (pool) {
        case 'NATIVE_SALES_DISTRIBUTOR':
          requireDistributor()
          return requireExecutor()({ kind: 'claim', pool, owner }, config)
        case 'NATIVE_NFT_APR':
          requireNftApr()
          return requireExecutor()({ kind: 'claim', pool, owner }, config)
        default:
          return assertNeverPool(pool)
      }
    },

    // ---- NFT APR staking (pool 'NATIVE_NFT_APR') ----

    async stakeNft(pool: StakingPool, nftMint: string): Promise<StakeTxResult> {
      if (pool !== 'NATIVE_NFT_APR') {
        throw new StakingError('POOL_UNKNOWN', `stakeNft is only valid for NATIVE_NFT_APR, got "${String(pool)}"`)
      }
      requireNftApr()
      const owner = await requireOwner()
      const mint = asSolanaAddress(nftMint)
      // Collection membership is enforced ON-CHAIN (Metaplex verified collection
      // check in stake_nft) — the executor may pre-validate for better UX.
      return requireExecutor()({ kind: 'stakeNft', pool: 'NATIVE_NFT_APR', owner, nftMint: mint }, config)
    },

    async unstakeNft(pool: StakingPool, nftMint: string): Promise<StakeTxResult> {
      if (pool !== 'NATIVE_NFT_APR') {
        throw new StakingError('POOL_UNKNOWN', `unstakeNft is only valid for NATIVE_NFT_APR, got "${String(pool)}"`)
      }
      requireNftApr()
      const owner = await requireOwner()
      const mint = asSolanaAddress(nftMint)
      return requireExecutor()({ kind: 'unstakeNft', pool: 'NATIVE_NFT_APR', owner, nftMint: mint }, config)
    },
  }
}
