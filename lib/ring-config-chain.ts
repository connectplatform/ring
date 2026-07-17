
import { getSystemConfigSnapshot } from '@/lib/ring-config-core'
export type { EvmContractConfig, EvmStakingConfig, EvmStakingSlotConfig } from '@/features/staking/adapters/evm';
export type { SolanaStakingSlotConfig, SolanaStakingConfig } from '@/features/staking/adapters/solana';
export type { EvmStakingPool, EvmStakingToken, SolanaStakingPool, SolanaStakingToken } from '@/features/staking/types';
export type { StakingPool, StakingToken } from '@/features/staking/types';
import ringConfig from '@/ring-config.json'
import type { StakingPool, StakingToken } from '@/features/staking/types';
import { cache } from 'react';
// NOTE (import-cycle discipline): chain configs reference only the RAW slot
// shapes owned by the adapters; the BUILT configs (EvmStakingConfig etc.) are
// produced exclusively by the SSOT builders in features/staking/adapters/*.
import type { EvmStakingSlotConfig } from '@/features/staking/adapters/evm';
import type { SolanaStakingSlotConfig } from '@/features/staking/adapters/solana';
import type { BaseStakingConfig } from '@/features/staking/adapters/base';
import { RewardCreditAddEventRule, RewardCreditAddEventTrigger } from './zod/credit-reward-schemas';


export type SupportedChains = (typeof ringConfig.chains.supported)[number];
export type EnabledChains = (typeof ringConfig.chains.enabled)[number];
export type NativeChain = (typeof ringConfig.chains.native);


export type SupportedCurrencies = (typeof ringConfig.currencies)[number];
/** Runtime currency allowlist (compat export — used by features/nft-market). */
export const SUPPORTED_CURRENCIES = ringConfig.currencies;
export type SupportedCrypto = (typeof ringConfig.tokens.supported)[number];
export type NativeToken = (typeof ringConfig.tokens.nativeToken)['symbol'];

export interface NativeChainConfig {  
  native?: NativeChain                       // Default chain option
  enabled?: SupportedChains[]                    // List of enabled chains
  solana?: SolanaChainConfig                 // Subconfig for Solana
  evm?: EvmChainConfig                       // Subconfig for EVM/legacy
  base?: BaseChainConfig                     // Subconfig for Base
  tokenDecimals?: number                      // Default decimal places for native
  sponsorAllNativeTokenTransfers?: boolean   // Fee sponsorship toggle
  tokenAddress?: string                      // Native token address
  tokenSymbol?: string                       // Native token symbol 
  tokenName?: string                         // Native token name
  tokenProgram?: string                      // Native token program or smart contract address
  treasuryAddress?: string                    // Treasury address
  rpcUrlEnv?: string                         // RPC environment variable/reference
  staking?: {
    pools?: StakingPool[]
    tokens?: StakingToken[]
    poolToToken?: Record<string, StakingToken>
    contracts?: {
      aprStaking?: EvmChainConfig['tokenAddress'] | SolanaChainConfig['tokenAddress'] | BaseChainConfig['tokenAddress']
      feeDistributor?: EvmChainConfig['tokenAddress'] | SolanaChainConfig['tokenAddress'] | BaseChainConfig['tokenAddress']
      erc20?: { abi: any[] }
    }
    methods?: EvmChainConfig['tokenAddress'] | SolanaChainConfig['tokenAddress'] | BaseChainConfig['tokenAddress']
  }
  commitment?: 'processed' | 'confirmed' | 'finalized' // Blockchain tx status
  /** Deployed Membership program address (Solana only) — SSOT via ring-membership-config.ts */
  membershipProgramId?: string
  // TODO: Support dynamic chain detection via React 19 use() and Next 16 app router slots.
}

// Solana chain config
export interface SolanaChainConfig {
  network?: string                           // Named network (mainnet, dev, etc) 
  enabled?: boolean
  chainId?: number
  tokenDecimals?: number
  sponsorAllNativeTokenTransfers?: boolean   // Fee sponsorship toggle
  tokenAddress?: string                       // Native token address
  tokenSymbol?: string                         // Native token symbol
  tokenName?: string                           // Native token name
  tokenProgram?: string                        // Native token program or smart contract address
  treasuryAddress?: string                     // Treasury address (native token custody)
  rpcUrlEnv?: string                           // RPC environment variable/reference
  commitment?: 'processed' | 'confirmed' | 'finalized' // Blockchain tx status
  /** Deployed Membership program address (Solana only) — SSOT via ring-membership-config.ts */
  membershipProgramId?: string                  // Membership program address
  tokenDesk?: TokenDeskConfig
  /** Raw staking slot — validated by buildSolanaStakingConfigFromSSOT. */
  staking?: SolanaStakingSlotConfig
}

// EVM (Ethereum or compatible) chain config
export interface EvmChainConfig {
  network?: string                            // Named network (mainnet, dev, etc) 
  enabled?: boolean
  chainId?: number
  tokenDecimals?: number
  tokenAddress?: string                       // Native token address
  tokenSymbol?: string                        // Native token symbol
  tokenName?: string                          // Native token name
  tokenProgram?: string                        // Native token program or smart contract address
  treasuryAddress?: string                    // Treasury address
  rpcUrlEnv?: string                         // RPC environment variable/reference
  commitment?: 'processed' | 'confirmed' | 'finalized'
  /** Raw staking slot — validated by buildEvmStakingConfigFromSSOT. */
  staking?: EvmStakingSlotConfig
}


// BASE chain config (Coinbase L2, etc), similar structure as EVM
export interface BaseChainConfig {
  enabled?: boolean
  chainId?: number
  tokenDecimals?: number
  tokenSymbol?: string
  tokenName?: string
  tokenAddress?: string
  rpcUrlEnv?: string
  commitment?: 'processed' | 'confirmed' | 'finalized'
  staking?: BaseStakingConfig
  // MOCK CODE, TODO: Add integration with BASE API; Step 1: Research BASE playground API; Step 2: Add developer docs notes for implementors.
}

// =========================
// Token Desk (CreditBalance to NativeToken) logic
// =========================

export interface TokenDeskConfig {
  supplyPolicy?: 'treasury_transfer' | 'mint'   // Token minting vs direct transfer
  /** Greed-free policy: no desk/P2P RING tax knobs — Solana gas only via fee payer. */
  firstSettlerDiscountBps?: number             // First settler discount
  firstSettlerOneTime?: boolean                // One-time discount enable
  firstSettlerGates?: Array<'wallet' | 'username' | 'dob' | 'verified'> // Which fields gate first-settler reward
  quoteTtlSeconds?: number | null                     // How long is a quote valid
  maxSlippageBps?: number                      // Maximum allowed slippage in bps
  /**
   * When true, confidential+ may buy native token via card/PayPal
   * (PaymentConductor purpose `native_token_onramp`). Env
   * CONFIDENTIAL_TOKEN_ONRAMP / NEXT_PUBLIC_CONFIDENTIAL_TOKEN_ONRAMP overrides.
   */
  nativeTokenOnramp?: boolean
  // TODO: Migrate business logic to shared utils and hook with Next.js actions API for admin side management.
}

const SUPPORTED_CHAINS: { 
  native: NativeChain
  enabled: SupportedChains[]
  supported: SupportedChains[]
} & {
  solana: SolanaChainConfig
  evm: EvmChainConfig
  base: BaseChainConfig
  tokenDesk: TokenDeskConfig
} = {
  native: 'solana',
  enabled: ['solana', 'evm'],
  supported: ['solana', 'evm'],
  solana: {
    network: 'devnet',
    tokenDecimals: 8,
    sponsorAllNativeTokenTransfers: true,
    tokenProgram: 'spl-token',
    rpcUrlEnv: 'SOLANA_RPC_URL',
    commitment: 'confirmed',
  },
  evm: {
    enabled: true,
    chainId: 137,
    tokenDecimals: 18,
  },
  base: {
    enabled: false,
    chainId: 8453,
    tokenDecimals: 8,
  },
  tokenDesk: {
    supplyPolicy: 'treasury_transfer',
    firstSettlerDiscountBps: 2000,
    firstSettlerOneTime: true,
    firstSettlerGates: ['wallet', 'username', 'dob', 'verified'],
  },
}

/**
 * Returns the assembled native chain config for the app:
 * 1. Loads the whole ring-config.json snapshot, extracting the 'chains' property (could be undefined).
 * 2. Merges deeply with the SUPPORTED_CHAINS fallback for solana, evm, and base chains:
 *    - Each individual chain config (solana, evm, base) will always get all SUPPORTED_CHAINS values overlaid with any custom values.
 *    - If a chain config is missing in the loaded config, it falls back to SUPPORTED_CHAINS for that chain.
 * 3. The 'enabled' field is an array. It will come from `chains.enabled` if that is an array; otherwise, falls back to SUPPORTED_CHAINS.enabled.
 * 4. The 'native' field is determined by:
 *      - If `chains.solana.network` is 'mainnet' or not.
 *      - Returns 'solana' if network is 'mainnet', otherwise 'evm'.
 *    Pitfall: This logic ties the "native" chain to only `solana`'s network, so if e.g. a project wants to use evm or any OTHER chain as the native token, you must adjust this.
 * 
 * # Pitfalls and what to change for custom clones:
 * - If your ring-config.json defines the native chain explicitly (e.g. 'native': 'evm' or 'base' or a custom chain), you should use that instead of auto-detecting on Solana's network.
 * - If a custom chain is added, you also need to add its config handling here, otherwise the deep-merge/fallback will not handle the custom chain.
 * - If solana configuration is omitted (say, your platform is only evm), `chains.solana` will be undefined so SUPPORTED_CHAINS.solana is used, unless you remove solana from defaults.
 * 
 * ## To support a custom native chain field in your clone:
 * - Prefer reading `chains.native` FIRST (if defined in ring-config.json), otherwise fallback.
 *   Example logic for this:
 *     native: chains.native ?? (chains.solana?.network === 'mainnet' ? 'solana' : 'evm'),
 *
 * - Also, make sure you provide configuration for your custom chain in SUPPORTED_CHAINS if you want default values to merge.
 */
export function getNativeChainConfig(): NativeChainConfig {
  // Snapshot 'chains' is loosely typed JSON — normalize once through the
  // NativeChainConfig surface (runtime deep-merge below guards the shape).
  const chains = (getSystemConfigSnapshot().chains ?? {}) as unknown as NativeChainConfig

  return {
    ...(SUPPORTED_CHAINS as NativeChainConfig),
    ...chains,
    solana: { ...SUPPORTED_CHAINS.solana, ...(chains.solana ?? {}) },
    evm: { ...SUPPORTED_CHAINS.evm, ...(chains.evm ?? {}) },
    base: { ...SUPPORTED_CHAINS.base, ...(chains.base ?? {}) },
    enabled: Array.isArray(chains.enabled) ? chains.enabled : SUPPORTED_CHAINS.enabled,
    // Explicit chains.native in ring-config.json wins; otherwise auto-detect.
    native: chains.native ?? ((chains.solana?.network ?? SUPPORTED_CHAINS.solana.network) === 'solana' ? 'solana' : 'evm'),
  }
}

export function getNativeChain(): NativeChain {
  const chains = (getSystemConfigSnapshot().chains ?? {}) as unknown as NativeChainConfig

  // Prefer explicit native chain if provided in config
  if (chains.native) {
    return chains.native;
  }

  // FIX 2026-07-04: was `chains?.native ?? {}` — read the SOLANA sub-config,
  // not the native chain NAME string, when probing solana readiness.
  const solanaConfig = chains.solana ?? {};
  const enabledChains = Array.isArray(chains.enabled) ? chains.enabled : [];
  const solanaReady =
    Boolean(solanaConfig.tokenAddress) &&
    Boolean(process.env.SOLANA_FEE_PAYER_PRIVATE_KEY) &&
    enabledChains.includes('solana');

  const solanaNetwork = solanaConfig.network ?? SUPPORTED_CHAINS.solana.network;

  if (solanaNetwork === 'mainnet' && solanaReady) {
    return 'solana';
  }

  return 'evm';
}

/** Base L2 chain config (compat export — used by features/wallet base-adapter). */
export function getBaseChainConfig(): BaseChainConfig {
  return getNativeChainConfig().base ?? { enabled: false, chainId: 8453, tokenSymbol: 'RING' }
}

export function isChainEnabled(chain: SupportedChains): boolean {
  const { enabled } = getNativeChainConfig()
  return enabled?.includes(chain) ?? chain === 'evm'
}

export function getNativeTokenDecimals(chain?: NativeChain): number {
  const active = chain ?? getNativeChain()
  const chains = getNativeChainConfig()
  const config = getSystemConfigSnapshot()

  if (active === 'solana') {
    return chains.solana?.tokenDecimals ?? config.tokens?.nativeToken?.tokenDecimals ?? 8
  }

  return chains.evm?.tokenDecimals ?? config.tokens?.nativeToken?.tokenDecimals ?? 18
}

export function getNativeTokenMintOrAddress(chain?: NativeChain): string | null {
  const active = chain ?? getNativeChain()
  const chains = getNativeChainConfig()


  return (
    chains.evm?.tokenAddress ||
    getSystemConfigSnapshot().tokens?.nativeToken?.tokenAddress ||
    process.env.NATIVE_TOKEN_ADDRESS ||
    null
  )
}

/**
 * Returns the native token configuration object from the merged system snapshot.
 * Aligned to RingConfig.tokens.nativeToken (SSOT key in ring-config.json).
 */
export function getNativeTokenConfig() {
  return getSystemConfigSnapshot().tokens?.nativeToken ?? {}
}

/**
 * Write SSOT: credit.rewards.events
 * Read order: credit.rewards.events → credit.creditAddEvents → credits.rewards.events
 */
export function getRewardCreditRules(): Record<string, unknown> {
  const snapshot = getSystemConfigSnapshot() as {
    credits?: { rewards?: { events?: Record<string, unknown> } }
    credit?: {
      creditAddEvents?: Record<string, unknown>
      rewards?: { events?: Record<string, unknown> }
    }
  }
  return (
    snapshot.credit?.rewards?.events ??
    snapshot.credit?.creditAddEvents ??
    snapshot.credits?.rewards?.events ??
    {}
  )
}

function getCreditRewardsBlock(): {
  minRole?: string
  multipliers?: Record<string, number>
  dailyEarnCap?: Record<string, number>
} {
  const snapshot = getSystemConfigSnapshot() as {
    credit?: {
      rewards?: {
        minRole?: string
        multipliers?: Record<string, number>
        dailyEarnCap?: Record<string, number>
      }
    }
    credits?: {
      rewards?: {
        minRole?: string
        multipliers?: Record<string, number>
        dailyEarnCap?: Record<string, number>
      }
    }
  }
  return snapshot.credit?.rewards ?? snapshot.credits?.rewards ?? {}
}

export function getRewardMinRole(): string {
  return getCreditRewardsBlock().minRole?.trim() || 'subscriber'
}

export function getRewardMultiplierForRole(role: string): number {
  const map = getCreditRewardsBlock().multipliers ?? {}
  const raw = map[role]
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw
  return 1
}

export function getRewardDailyEarnCap(role: string): number {
  const map = getCreditRewardsBlock().dailyEarnCap ?? {}
  const raw = map[role]
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return raw
  return Number.POSITIVE_INFINITY
}

/** Public catalog for progress UI — amounts from enabled rules only. */
export function getPublicRewardCatalog(): Array<{
  trigger: string
  amount: number
  enabled: boolean
  idempotencyMode: string
}> {
  const rules = getRewardCreditRules()
  return Object.entries(rules).map(([trigger, raw]) => {
    const rule = (raw ?? {}) as {
      amount?: string
      enabled?: boolean
      idempotencyMode?: string
    }
    return {
      trigger,
      amount: Number(rule.amount) || 0,
      enabled: rule.enabled !== false,
      idempotencyMode: rule.idempotencyMode ?? 'once_per_user',
    }
  })
}

export function getTokenDeskConfig() {
  const snapshot = getSystemConfigSnapshot()
  return snapshot.credit?.desk ?? snapshot.tokens?.tokenDesk ?? {}
}

export function getPointsPerNativeToken(): number {
  const desk = getTokenDeskConfig() as { pointsPerNativeToken?: number }
  return desk.pointsPerNativeToken ?? 100
}

/**
 * Whether confidential+ may buy native token via card/PayPal (BuyNativeViaCard).
 * Env CONFIDENTIAL_TOKEN_ONRAMP wins; else ring-config tokenDesk.nativeTokenOnramp.
 * Client UI should prefer NEXT_PUBLIC_CONFIDENTIAL_TOKEN_ONRAMP (see ring-config-client).
 */
export function isNativeTokenOnrampEnabled(): boolean {
  const env = process.env.CONFIDENTIAL_TOKEN_ONRAMP?.trim().toLowerCase()
  if (env === 'true') return true
  if (env === 'false') return false
  const pub = process.env.NEXT_PUBLIC_CONFIDENTIAL_TOKEN_ONRAMP?.trim().toLowerCase()
  if (pub === 'true') return true
  if (pub === 'false') return false
  const desk = getTokenDeskConfig() as TokenDeskConfig
  return desk.nativeTokenOnramp === true
}

export function assertMainnetHotKeyAllowed(operation: string): void {
  const chains = getNativeChainConfig()
  if (chains.solana?.network === 'mainnet' && process.env.SOLANA_TREASURY_PRIVATE_KEY) {
    throw new Error(
      `Hot-key ${operation} blocked on Solana mainnet — use Squads multisig treasury (Phase 3)`,
    )
  }
}

/**
 * Returns configured native token symbol, with fallbacks.
 * Optionally checks supplied address (currently unused).
 */
export const getNativeTokenName = cache((tokenName?: string): string => {
  const config = getSystemConfigSnapshot()
  const native = config.tokens?.nativeToken as
    | { tokenName?: string; name?: string }
    | undefined
  return (
    tokenName ??
    process.env.NATIVE_TOKEN_NAME ??
    native?.tokenName ??
    native?.name ??
    'RING Governance Token'
  )
})
export const getNativeTokenSymbol = cache((tokenSymbol?: string): string => {
  const config = getSystemConfigSnapshot()
  const native = config.tokens?.nativeToken as
    | { tokenSymbol?: string; symbol?: string }
    | undefined
  const chainNative = getNativeChain()
  const chainSymbol =
    chainNative === 'solana'
      ? config.chains?.solana?.tokenSymbol
      : config.chains?.evm?.tokenSymbol
  // First arg is an optional *symbol override*, never a chain id.
  // Callers historically passed result.chain ("solana") and poisoned ledgers.
  const chainIds = new Set(['solana', 'evm', 'base', 'ethereum', 'polygon', 'pol'])
  const override =
    tokenSymbol && !chainIds.has(tokenSymbol.toLowerCase()) ? tokenSymbol : undefined
  return (
    override ??
    process.env.NATIVE_TOKEN_SYMBOL ??
    native?.tokenSymbol ??
    native?.symbol ??
    chainSymbol ??
    'RING'
  )
})
export const getEvmTokenSymbol = cache((): string => {
  const config = getSystemConfigSnapshot()
  return process.env.EVM_TOKEN_SYMBOL ?? config.tokens?.evmToken?.tokenSymbol ?? 'RING'
})

/**
 * Returns the current instance's native token contract address (Solana: SPL mint; EVM: ERC20).
 *
 * SSOT resolution order:
 *   1. config.tokens.nativeToken.tokenAddress (ring-config.json — deployment-specific)
 *   2. config.chains.*.tokenAddress (per-chain override from ring-config)
 *   3. env.NATIVE_TOKEN_ADDRESS (legacy override for CI/debug)
 *   4. Falls back to '' — callers must check and degrade gracefully.
 *
 * FIX 2026-07-06: was returning 'RING' (a literal string) as fallback, which
 *     callers like getNativeTokenBalance() passed to PublicKey constructor
 *     causing runtime errors. The fallback is now '' so callers can detect
 *     "not configured" and return zero.
 */
export const getNativeTokenAddress = cache((): string => {
  const snapshot = getSystemConfigSnapshot()
  const nativeToken = snapshot.tokens?.nativeToken
  if (nativeToken?.tokenAddress && nativeToken.tokenAddress !== '0x0000000000000000000000000000000000000000') {
    return nativeToken.tokenAddress
  }
  return process.env.NATIVE_TOKEN_ADDRESS ?? ''
})

/**
 * Returns current instance's native token treasury address string.
 * Falls back to symbol 'RING' if not available.
 */
export const getNativeTokenTreasuryAddress = cache((): string => {
  const config = getSystemConfigSnapshot()
  return process.env.NATIVE_TOKEN_TREASURY_ADDRESS ?? config.tokens?.nativeToken?.tokenTreasuryAddress ?? 'RING'
})


// =========================
// Tokens and Chains
// =========================

export interface EvmTokensConfig {
  [tokenSymbol: SupportedCrypto]: {
    tokenName?: string                              // Full token name/brand
    tokenDecimals?: number                          // On-chain decimals
    tokenAddress?: string                           // Blockchain token address
    rpcUrlEnv?: EvmChainConfig['rpcUrlEnv']         // Env variable to fetch endpoint
    commitment?: EvmChainConfig['commitment']       // Blockchain read consistency
  }
}
export interface SolanaTokensConfig {
  [tokenSymbol: string]: {
    tokenName?: string                              // Full token name/brand
    tokenDecimals?: number                          // On-chain decimals
    tokenAddress?: string                           // Blockchain token address
    rpcUrlEnv?: SolanaChainConfig['rpcUrlEnv']         // Env variable to fetch endpoint
    commitment?: SolanaChainConfig['commitment']       // Blockchain read consistency
  }
}
// RENAMED 2026-07-03 (Flawless Victory): was `NativeChainConfig` but collided
// with the narrower chain-only config at line 22. This is the platform-wide
// native chain + token + rewards surface, used by RingConfig.{tokens, creditUnit, ...}.
// TODO: Move chain-specific sub-configs (evmTokens, solanaTokens) to their
// respective chain feature folders per "keep chain types local" directive.
export interface NativeChainPlatformConfig {
  tokens?: {
    supported?: SupportedCrypto[]
    native?: NativeToken
  }
  evmTokens?: EvmTokensConfig
  solanaTokens?: SolanaTokensConfig
  /**
   * Configures the project's native (currently solana chain) token.
   * Example: "RING" for ring-platform.org.
   * NativeToken is a sponsored SPL token or EVM/BASE token.
   *
   * // TODO: For all fields, prefer runtime Zod validation for SSR/CSR parity!
   */
  nativeChain?: {
     enabled?: boolean            // Enable native token features
     solana?: SolanaChainConfig
     evm?: EvmChainConfig
     base?: BaseChainConfig
   }

  /**
   * Configures credit points unit (internal stable currency for user credit_balance)
   * Example: USD, UAH, etc, defaults to project fiat currency.
   * Not a blockchain token, but allows buying project token for credits (see feature flags).
   */
  creditUnit?: string            // Credit unit display name (e.g. 'USD')
  creditFiatCurrency?: string    // 3-char ISO code for main fiat
  rewards?: {                    // Config for credit reward airdrops
    credits?: {
      events?: Record<RewardCreditAddEventTrigger, RewardCreditAddEventRule> // Map of trigger actions to reward logic
    }
  }
  tokenDesk?: TokenDeskConfig    // Desk/trade/swap config for native token UX
  // TODO: Consider using Next.js static export for credits only mode (no tokens).
}

// =========================
// Public Pools Configuration
// =========================

/**
 * Install-time defaults for DAO opportunity pools (public feature-implementation jars).
 * These pools trigger opportunity objects for feature implementations, allocating RING/NativeToken,
 * describing DAO tasks to 'confidential' users, and route funds to main DAO treasury.
 */
export interface DaoPoolsConfig {
  /** Minimum machine-hours (and RING goal floor) for opportunity-pool jar contract. */
  minGoalHours?: number
  /** RING per machine-hour when deriving goal_ring from goal_hours. */
  ringPerMachineHour?: number
  /** Likes required to queue the pool (OR 100% RING pledged). */
  likeQueueThreshold?: number

  /** Chain identifier for pool funding and deployment (e.g., 'Solana', 'Ethereum'). */
  nativeChain: NativeChain;
  /**
   * Token address or unique identifier for the pool's native token.
   * This is the SPL mint address for Solana, or the ERC20 contract address for EVM chains.
   * The field should match the corresponding `nativeToken.tokenAddress` defined in the nativeChain config.
   */
  nativeTokenAddress: string;

  /** DAO identifier (for pools supporting multiple DAOs within the platform). */
  daoId: string
  /** Pool contract address (deployed jar contract address on-chain). */
  poolContractAddress?: string

  /** Whether pool is active and accepting new feature opportunities. */
  isActive?: boolean
  /** Human-facing display name for pool. */
  name: string
  /** Optional description of pool purpose/scope. */
  description?: string

  /** Maximum number of concurrent feature-implementation opportunities from this pool. */
  maxOpportunities?: number
  /**
   * Specify which user types can see/join pool opportunities.
   * E.g. ['confidential'] restricts to confidential users.
   */
  visibleToUserTypes?: string[]

  /** Opportunity object configuration template for this pool. */
  opportunityTemplate?: {
    /** Default tags or categories for new opportunities. */
    tags?: string[]
    /** Default opportunity visibility. */
    visibility?: 'confidential' | 'public' | 'dao-members'
    /** Example opportunity field customizations. */
    [key: string]: any
  }

  /** Recipient treasury contract address (where excess/unclaimed funds are sent). */
  treasuryContractAddress: string

  // Future extensibility
  /** Metadata: IPFS hash or uri of additional pool configuration/details. */
  metadataUri?: string
  /** Creation timestamp or block. */
  createdAt?: string
  /** Pool owner/admin. */
  ownerId?: string

  // TODO: Add runtime validation for economic thresholds, security gates, and user gating.
}
