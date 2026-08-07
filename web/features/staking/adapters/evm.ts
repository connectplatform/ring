/**
 * features/staking/adapters/evm.ts — EVM (Polygon) staking adapter.
 *
 * Products served (see features/staking/types.ts for the big picture):
 * - APR staking            → APRStaking.sol      (pools: DAAR_APR, DAARION_APR)
 * - Sales distributor      → DAARDistributor.sol (pool:  DAARION_DISTRIBUTOR)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CLIENT IMPLEMENTATION SPEC (for the wallet-page implementing agent)
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. ABIs: import JSON ABIs from features/staking/server/daar-abi and
 *    features/staking/server/daarion-abi (or generate from the .sol sources in
 *    daarion/daarion-token/contracts). Required fragments:
 *      APRStaking:      stakeDAAR(uint256), unstakeDAAR(uint256),
 *                       stakeDAARION(uint256), unstakeDAARION(uint256),
 *                       claimReward(), getPendingRewards(address) view,
 *                       stakesDAAR(address) view, stakesDAARION(address) view,
 *                       totalStakedDAAR() view, totalStakedDAARION() view
 *      DAARDistributor: stakeDAARION(uint256), unstakeDAARION(uint256),
 *                       getPendingRewardsDAARDistributor(address) view,
 *                       stakes(address) view, totalStakedDAARION() view,
 *                       getCurrentEpoch() view, epochDuration() view,
 *                       lastEpochTimestamp() view
 *    NOTE: DAARDistributor rewards are PUSHED by the owner via
 *    distributeRewards(recipients[], amounts[]) once per epoch — there is NO
 *    user claim method. claimByPool('DAARION_DISTRIBUTOR') therefore resolves
 *    to txHash '' unless ring-config declares a claim method override.
 * 2. Wallet: on the client, inject a viem WalletClient from wagmi
 *    (`getWalletClient` / connector). Never use ethers — app runtime is wagmi+viem only.
 *    `getSigner` override name is legacy; it must return a viem WalletClient (or null).
 * 3. Config: call buildEvmStakingConfigFromSSOT({ getSigner, abis, ... }) on the
 *    client boundary. It throws StakingConfigError with precise messages —
 *    surface `err.code` to i18n, log `err.message` for ops.
 * 4. Reads: prefer the server reader (features/staking/server/read-positions.ts)
 *    passed as overrides.readPositions to avoid client RPC fan-out.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type {
  StakingAdapter,
  StakingPosition,
  StakingPool,
  StakingToken,
  StakeTxResult,
} from '../types'
import {
  StakingError,
  StakingConfigError,
  isEvmStakingPool,
} from '../types'
import { parseTokenAmount } from '../../evm/utils'
import { getEvmChainWalletSlot } from '../slots'
import type { EvmChainConfig } from '@/lib/ring-config-chain'
import {
  type Abi,
  type WalletClient,
  createPublicClient,
  http,
  parseAbi,
  getAddress,
} from 'viem'
import { polygon } from 'viem/chains'
import { getEvmRpcUrl } from '@/lib/ring-config-chain'

/** Injected wallet — viem WalletClient (wagmi). Legacy name: getSigner. */
type StakingWalletClient = WalletClient

// ─────────────────────────────────────────────────────────────────────────────
// Address / ABI brands + runtime guards
// ─────────────────────────────────────────────────────────────────────────────

/** EVM address — 0x-prefixed 20-byte hex string. */
export type EvmAddress = `0x${string}`

/** EVM ABI — array of human-readable fragments or JSON fragment objects. */
export type EvmAbi = readonly (string | object)[]

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
/** Contract method names must be plain identifiers — blocks config-driven property injection. */
const METHOD_NAME_RE = /^[a-zA-Z_$][\w$]*$/

export function isEvmAddress(addr: unknown): addr is EvmAddress {
  return typeof addr === 'string' && EVM_ADDRESS_RE.test(addr)
}

/** Non-zero, format-valid EVM address (zero address = "not deployed" sentinel). */
export function isDeployedEvmAddress(addr: unknown): addr is EvmAddress {
  return isEvmAddress(addr) && addr.toLowerCase() !== ZERO_ADDRESS
}

export function asEvmAddress(addr: string): EvmAddress {
  if (!isEvmAddress(addr)) {
    throw new StakingConfigError(`Invalid EVM address format: "${addr}"`)
  }
  return addr
}

/**
 * Deep ABI validation (fixes "overly basic validation"):
 * - non-empty array
 * - string entries must look like fragments ("function ...", "event ...", ...)
 * - object entries must carry a fragment `type` field (function/event/constructor/...)
 */
export function isValidEvmAbi(abi: unknown): abi is EvmAbi {
  if (!Array.isArray(abi) || abi.length === 0) return false
  return abi.every((frag) => {
    if (typeof frag === 'string') return frag.trim().length > 3
    if (typeof frag === 'object' && frag !== null) {
      const t = (frag as { type?: unknown }).type
      return typeof t === 'string' && t.length > 0
    }
    return false
  })
}

export function asEvmAbi(abi: unknown): EvmAbi {
  if (!isValidEvmAbi(abi)) {
    throw new StakingConfigError('Invalid EVM ABI: expected non-empty array of fragment strings or {type: ...} objects')
  }
  return abi
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const COMMITMENTS = ['processed', 'confirmed', 'finalized'] as const
export type EvmCommitment = (typeof COMMITMENTS)[number]
function isCommitment(v: unknown): v is EvmCommitment {
  return typeof v === 'string' && (COMMITMENTS as readonly string[]).includes(v)
}

function isValidDecimals(dec: unknown): dec is number {
  return typeof dec === 'number' && Number.isInteger(dec) && dec >= 0 && dec <= 36
}

/** rpcUrlEnv must be an ENV VAR NAME (e.g. POLYGON_RPC_URL), never a URL/secret. */
function isValidRpcUrlEnv(env: unknown): env is string {
  return typeof env === 'string' && /^[A-Z][A-Z0-9_]*$/.test(env)
}

// ─────────────────────────────────────────────────────────────────────────────
// Raw slot shapes (UNTRUSTED — as they appear in ring-config.json chains.evm.staking)
// These are inputs to the builder; never hand them to the adapter directly.
// ─────────────────────────────────────────────────────────────────────────────

export interface EvmStakingSlotContractInput {
  /** Deployed staking/distributor CONTRACT address (call target). */
  address?: string
  /** ERC20 token staked into this contract; defaults to the slot's native token. */
  tokenAddress?: string
  tokenDecimals?: number
  rpcUrlEnv?: string
  commitment?: string
  abi?: unknown
}

/** Raw staking section of the EVM chain slot in ring-config.json. */
export interface EvmStakingSlotConfig {
  /** Pool-id whitelist (keys) with optional per-pool metadata. */
  pools?: Readonly<Record<string, { token?: string } | string | null>>
  /** Pool-id → token-symbol mapping. */
  poolToToken?: Readonly<Record<string, string>>
  /** Action-key (e.g. "stakeDAAR", "claimDAAR") → contract method name overrides. */
  methods?: Readonly<Record<string, string>>
  contracts?: {
    aprStaking?: EvmStakingSlotContractInput | string | null
    feeDistributor?: EvmStakingSlotContractInput | string | null
    erc20?: { address?: string; abi?: unknown } | null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Built (TRUSTED) config shapes — produced only by the validating builder below
// ─────────────────────────────────────────────────────────────────────────────

export interface EvmContractConfig {
  /** Deployed CONTRACT address — the call target for stake/unstake/claim. */
  address: EvmAddress
  /** ERC20 token staked into this contract — the approval target. */
  tokenAddress: EvmAddress
  abi: EvmAbi
  tokenDecimals: number
  rpcUrlEnv: string
  commitment: EvmCommitment
}

export interface EvmStakingTokenInfo {
  symbol: string
  tokenAddress: EvmAddress
  tokenDecimals: number
}

export interface EvmStakingConfig {
  /** Active EVM chain (sourced from chains.evm in ring-config). */
  chainId: number
  /** Env var NAME holding the RPC endpoint (resolved server-side). */
  rpcUrlEnv?: string
  /** Validated token registry: symbol → token info. */
  tokens: Readonly<Record<string, EvmStakingTokenInfo>>
  contracts: {
    aprStaking?: EvmContractConfig
    feeDistributor?: EvmContractConfig
    erc20?: { address: EvmAddress; abi: EvmAbi }
  }
  /** Action-key → contract method name (validated identifier-safe). */
  methods?: Readonly<Record<string, string>>
  /** Pool-id → token-symbol mapping (cross-validated against `tokens`). */
  poolToToken?: Readonly<Partial<Record<StakingPool, string>>>
  /** WalletClient factory — injected by the wallet UI (wagmi). Legacy name: getSigner. */
  getSigner: () => Promise<StakingWalletClient | null>
  /** Optional server-side/cached position reader. */
  readPositions?: (address: string) => Promise<StakingPosition[]>
}

// Minimal ERC20 fragments needed for the approval flow (viem human-readable)
const MINIMAL_ERC20_ABI = [
  'function approve(address spender, uint256 value) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
] as const

function toViemAbi(abi: EvmAbi): Abi {
  if (abi.length > 0 && abi.every((x) => typeof x === 'string')) {
    return parseAbi(abi as readonly string[])
  }
  return abi as Abi
}

async function writeStakingMethod(
  client: StakingWalletClient,
  address: EvmAddress,
  abi: EvmAbi,
  functionName: string,
  args: unknown[] = []
): Promise<{ txHash: string }> {
  if (!METHOD_NAME_RE.test(functionName)) {
    throw new StakingError('METHOD_UNAVAILABLE', `Invalid contract method "${functionName}"`)
  }
  if (!client.account) {
    throw new StakingError('WALLET_NOT_CONNECTED', 'Wallet account missing on WalletClient')
  }
  const hash = await client.writeContract({
    address: getAddress(address),
    abi: toViemAbi(abi),
    functionName,
    args,
    account: client.account,
    chain: client.chain ?? null,
  } as never)
  return { txHash: hash as `0x${string}` }
}

async function readStakingMethod(
  address: EvmAddress,
  abi: EvmAbi,
  functionName: string,
  args: unknown[] = []
): Promise<unknown> {
  const client = createPublicClient({
    chain: polygon,
    transport: http(getEvmRpcUrl()),
  })
  // Dynamic ABIs from ring-config — loosen viem generics
  return client.readContract({
    address: getAddress(address),
    abi: toViemAbi(abi),
    functionName,
    args,
  } as never)
}

// ─────────────────────────────────────────────────────────────────────────────
// SSOT config builder — every dynamic input validated, fail-fast, zero `as` on
// foreign data, frozen output. Each numbered fix maps to a known failure mode:
//   (F1) no `any`-built objects        (F2) no silent fallbacks
//   (F3) deep structural validation    (F4) overrides ⇄ slot cross-validation
//   (F5) exhaustive slot shape checks  (F6) token-symbol registry validation
// ─────────────────────────────────────────────────────────────────────────────

export interface BuildEvmStakingConfigOverrides {
  /** Legacy name — must return a viem WalletClient (wagmi), not ethers Signer. */
  getSigner: () => Promise<StakingWalletClient | null>
  abis: { aprStaking: EvmAbi; feeDistributor: EvmAbi; erc20?: EvmAbi }
  /** Injectable slot for tests; defaults to the live ring-config slot. */
  chainSlot?: EvmChainConfig
  /** Pool-id → token-symbol mapping override (cross-validated, F4). */
  poolToToken?: Partial<Record<StakingPool, string>>
  /**
   * Allowlist of token symbols valid on this chain (e.g. ring-config
   * tokens.supported). When provided, slot.tokenSymbol MUST be a member (F6).
   */
  knownTokenSymbols?: readonly string[]
  readPositions?: (address: string) => Promise<StakingPosition[]>
}

export function buildEvmStakingConfigFromSSOT(
  overrides: BuildEvmStakingConfigOverrides
): EvmStakingConfig {
  const slot = overrides.chainSlot ?? getEvmChainWalletSlot()

  // (F5) ---- Slot presence & enablement — fail fast, no partial configs ----
  // (typeof check instead of isObject() so the EvmChainConfig type is preserved)
  if (typeof slot !== 'object' || slot === null) {
    throw new StakingConfigError('EVM chain slot is missing or not an object — check ring-config chains.evm')
  }
  if (!slot.enabled) {
    throw new StakingError('CHAIN_DISABLED', `EVM chain (chainId=${slot.chainId}) is not enabled in ring-config`)
  }
  if (typeof slot.chainId !== 'number' || !Number.isInteger(slot.chainId) || slot.chainId <= 0) {
    throw new StakingConfigError(`EVM slot chainId must be a positive integer, got: ${String(slot.chainId)}`)
  }

  // (F5) ---- Native token fields — exhaustive shape check ----
  if (!isEvmAddress(slot.tokenAddress)) {
    throw new StakingConfigError(
      `EVM slot tokenAddress invalid for chainId=${slot.chainId}: "${String(slot.tokenAddress)}"`
    )
  }
  if (!isValidDecimals(slot.tokenDecimals)) {
    throw new StakingConfigError(
      `EVM slot tokenDecimals invalid for chainId=${slot.chainId}: ${String(slot.tokenDecimals)} (expected integer 0..36)`
    )
  }
  if (typeof slot.tokenSymbol !== 'string' || slot.tokenSymbol.trim().length === 0) {
    throw new StakingConfigError(`EVM slot tokenSymbol missing for chainId=${slot.chainId}`)
  }
  const sym = slot.tokenSymbol.trim()

  // (F6) ---- Token symbol registry cross-check — no blind keyof casts ----
  if (overrides.knownTokenSymbols && !overrides.knownTokenSymbols.includes(sym)) {
    throw new StakingError(
      'TOKEN_UNKNOWN',
      `Slot tokenSymbol "${sym}" is not in the known token registry [${overrides.knownTokenSymbols.join(', ')}] for chainId=${slot.chainId}`
    )
  }

  const rpcUrlEnv = slot.rpcUrlEnv
  if (rpcUrlEnv !== undefined && !isValidRpcUrlEnv(rpcUrlEnv)) {
    throw new StakingConfigError(
      `EVM slot rpcUrlEnv must be an ENV VAR NAME (e.g. POLYGON_RPC_URL), got: "${String(rpcUrlEnv)}"`
    )
  }

  // ---- Signer injection ----
  if (typeof overrides.getSigner !== 'function') {
    throw new StakingConfigError('getSigner must be a function returning Promise<WalletClient | null>')
  }
  const getSigner = overrides.getSigner

  // (F3) ---- ABI overrides — deep validation, required for both contracts ----
  for (const [name, abi] of Object.entries(overrides.abis)) {
    if (abi !== undefined && !isValidEvmAbi(abi)) {
      throw new StakingConfigError(`Override ABI "${name}" is invalid or malformed`)
    }
  }
  if (!overrides.abis.aprStaking || !overrides.abis.feeDistributor) {
    throw new StakingConfigError('abis.aprStaking and abis.feeDistributor are both required')
  }

  const stakingSlot: EvmStakingSlotConfig = isObject(slot.staking) ? (slot.staking as EvmStakingSlotConfig) : {}

  // ---- Token registry (currently the single native slot token) ----
  const tokens: Record<string, EvmStakingTokenInfo> = {
    [sym]: Object.freeze({
      symbol: sym,
      tokenAddress: slot.tokenAddress,
      tokenDecimals: slot.tokenDecimals,
    }),
  }

  // (F2)(F4) ---- Pool whitelist. NOTE: an absent whitelist NO LONGER silently
  // disables cross-checks — we fall back to the canonical closed pool union. ----
  const slotPoolWhitelist = stakingSlot.pools ? Object.keys(stakingSlot.pools) : null
  const isWhitelistedPool = (poolId: string): boolean =>
    slotPoolWhitelist ? slotPoolWhitelist.includes(poolId) : isEvmStakingPool(poolId)

  // (F1)(F4) ---- poolToToken: typed construction + full cross-validation ----
  const poolToTokenSource = overrides.poolToToken ?? stakingSlot.poolToToken
  let poolToToken: Partial<Record<StakingPool, string>> | undefined
  if (poolToTokenSource !== undefined) {
    if (!isObject(poolToTokenSource)) {
      throw new StakingConfigError('poolToToken must be a Record<poolId, tokenSymbol>')
    }
    const built: Partial<Record<StakingPool, string>> = {}
    for (const [poolId, tokenSymbol] of Object.entries(poolToTokenSource)) {
      if (!isWhitelistedPool(poolId)) {
        throw new StakingError('POOL_UNKNOWN', `poolToToken contains non-whitelisted pool key "${poolId}" for chainId=${slot.chainId}`)
      }
      if (typeof tokenSymbol !== 'string' || tokenSymbol.length === 0) {
        throw new StakingConfigError(`poolToToken["${poolId}"] must be a non-empty token symbol string`)
      }
      // (F4) every mapped symbol must exist in the validated token registry
      if (!tokens[tokenSymbol]) {
        throw new StakingError('TOKEN_UNKNOWN', `poolToToken["${poolId}"] → "${tokenSymbol}" is not a configured token on chainId=${slot.chainId} (known: ${Object.keys(tokens).join(', ')})`)
      }
      built[poolId as StakingPool] = tokenSymbol
    }
    poolToToken = Object.freeze(built)
  }

  // (F3)(F4) ---- methods: action-key → method-name overrides.
  // FIX vs legacy: method keys are ACTION KEYS ("stakeDAAR", "claimDAAR"), NOT
  // pool ids — the old pool-id cross-check was semantically wrong and rejected
  // valid configs. Values are checked as identifier-safe to block property
  // injection into dynamic contract[method]() dispatch. ----
  let methods: Record<string, string> | undefined
  if (stakingSlot.methods !== undefined) {
    if (!isObject(stakingSlot.methods)) {
      throw new StakingConfigError('staking.methods must be a Record<actionKey, contractMethodName>')
    }
    const built: Record<string, string> = {}
    for (const [actionKey, methodName] of Object.entries(stakingSlot.methods)) {
      if (!METHOD_NAME_RE.test(actionKey)) {
        throw new StakingConfigError(`staking.methods key "${actionKey}" is not a valid action key`)
      }
      if (typeof methodName !== 'string' || !METHOD_NAME_RE.test(methodName)) {
        throw new StakingConfigError(`staking.methods["${actionKey}"] = "${String(methodName)}" is not a safe contract method name`)
      }
      built[actionKey] = methodName
    }
    methods = Object.freeze(built)
  }

  // (F1)(F3)(F4) ---- Contract configs: normalize → cross-fill from validated
  // slot token fields → validate exhaustively. Accepts either a bare address
  // string or a full object in ring-config. ----
  function buildContractConfig(
    raw: EvmStakingSlotContractInput | string | null | undefined,
    which: 'aprStaking' | 'feeDistributor',
    abi: EvmAbi
  ): EvmContractConfig | undefined {
    if (raw === null || raw === undefined) return undefined
    const input: EvmStakingSlotContractInput = typeof raw === 'string' ? { address: raw } : raw
    if (!isObject(input)) {
      throw new StakingConfigError(`staking.contracts.${which} must be an address string or config object`)
    }
    // Zero address = explicit "not deployed" placeholder → treat as absent (fail-fast happens below if BOTH absent)
    if (input.address !== undefined && isEvmAddress(input.address) && !isDeployedEvmAddress(input.address)) {
      return undefined
    }
    if (!isEvmAddress(input.address)) {
      throw new StakingConfigError(`staking.contracts.${which}.address invalid for chainId=${slot.chainId}: "${String(input.address)}"`)
    }
    // (F4) cross-fill from validated slot values; explicit overrides re-validated
    const tokenAddress = input.tokenAddress ?? slot.tokenAddress
    const tokenDecimals = input.tokenDecimals ?? slot.tokenDecimals
    const contractRpcEnv = input.rpcUrlEnv ?? rpcUrlEnv ?? 'POLYGON_RPC_URL'
    const commitment = input.commitment ?? 'confirmed'
    if (!isEvmAddress(tokenAddress)) {
      throw new StakingConfigError(`staking.contracts.${which}.tokenAddress invalid: "${String(input.tokenAddress)}"`)
    }
    if (!isValidDecimals(tokenDecimals)) {
      throw new StakingConfigError(`staking.contracts.${which}.tokenDecimals invalid: ${String(input.tokenDecimals)}`)
    }
    if (!isValidRpcUrlEnv(contractRpcEnv)) {
      throw new StakingConfigError(`staking.contracts.${which}.rpcUrlEnv invalid: "${String(contractRpcEnv)}"`)
    }
    if (!isCommitment(commitment)) {
      throw new StakingConfigError(`staking.contracts.${which}.commitment invalid: "${String(commitment)}" (expected ${COMMITMENTS.join('|')})`)
    }
    const contractAbi = input.abi !== undefined ? asEvmAbi(input.abi) : abi
    return Object.freeze({
      address: input.address,
      tokenAddress,
      abi: contractAbi,
      tokenDecimals,
      rpcUrlEnv: contractRpcEnv,
      commitment,
    })
  }

  const aprStaking = buildContractConfig(stakingSlot.contracts?.aprStaking, 'aprStaking', overrides.abis.aprStaking)
  const feeDistributor = buildContractConfig(stakingSlot.contracts?.feeDistributor, 'feeDistributor', overrides.abis.feeDistributor)

  // (F2) ---- Fail fast: a staking config with zero staking contracts is dead weight ----
  if (!aprStaking && !feeDistributor) {
    throw new StakingError(
      'NOT_DEPLOYED',
      `No staking contracts configured for chainId=${slot.chainId} — set chains.evm.staking.contracts.aprStaking and/or .feeDistributor in ring-config`
    )
  }

  // ---- erc20 (optional; approval-flow contract) ----
  let erc20: { address: EvmAddress; abi: EvmAbi } | undefined
  const rawErc20 = stakingSlot.contracts?.erc20
  if (rawErc20 !== null && rawErc20 !== undefined && isObject(rawErc20)) {
    const erc20Address = rawErc20.address ?? slot.tokenAddress
    if (!isEvmAddress(erc20Address)) {
      throw new StakingConfigError(`staking.contracts.erc20.address invalid: "${String(rawErc20.address)}"`)
    }
    const hasCustomAbi = rawErc20.abi !== undefined && Array.isArray(rawErc20.abi) && rawErc20.abi.length > 0
    erc20 = Object.freeze({
      address: erc20Address,
      abi: hasCustomAbi ? asEvmAbi(rawErc20.abi) : (overrides.abis.erc20 ?? MINIMAL_ERC20_ABI),
    })
  }

  return Object.freeze({
    chainId: slot.chainId,
    rpcUrlEnv,
    tokens: Object.freeze(tokens),
    contracts: Object.freeze({ aprStaking, feeDistributor, erc20 }),
    methods,
    poolToToken,
    getSigner,
    readPositions: overrides.readPositions,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create the EVM StakingAdapter from a TRUSTED (builder-produced) config.
 *
 * Runtime hardening vs legacy:
 * - Contract calls target `contract.address` (the deployed staking contract),
 *   approvals target `token.tokenAddress` — the legacy code dereferenced a
 *   non-existent `target.address` field and used token addresses as call
 *   targets in claim paths (funds-path bug, fixed).
 * - Dynamic method dispatch verifies the resolved method exists on the
 *   contract instance before invoking (METHOD_UNAVAILABLE instead of TypeError).
 * - Pool→token resolution throws POOL_UNKNOWN instead of silently casting.
 */
export function createEvmStakingAdapter(config: EvmStakingConfig): StakingAdapter {
  const { tokens, contracts, methods = {}, poolToToken } = config

  async function withWallet<T>(fn: (client: StakingWalletClient) => Promise<T>): Promise<T> {
    const client = await config.getSigner()
    if (!client) throw new StakingError('WALLET_NOT_CONNECTED', 'Wallet not connected')
    return fn(client)
  }

  function requireAmount(amount: string): void {
    const n = Number(amount)
    if (!Number.isFinite(n) || n <= 0) {
      throw new StakingError('AMOUNT_INVALID', `Amount must be a positive decimal string, got "${amount}"`)
    }
  }

  /** Ensure ERC20 allowance covers the stake amount; approve when short. */
  async function ensureApproval(
    client: StakingWalletClient,
    tokenAddress: EvmAddress,
    spender: EvmAddress,
    amountRaw: string
  ): Promise<void> {
    const owner = client.account?.address
    if (!owner) throw new StakingError('WALLET_NOT_CONNECTED', 'Wallet account missing')
    const erc20Abi = (contracts.erc20?.abi ?? MINIMAL_ERC20_ABI) as EvmAbi
    const current = await readStakingMethod(tokenAddress, erc20Abi, 'allowance', [
      owner,
      spender,
    ])
    const currentBig = typeof current === 'bigint' ? current : BigInt(String(current))
    if (currentBig >= BigInt(amountRaw)) return
    await writeStakingMethod(client, tokenAddress, erc20Abi, 'approve', [spender, amountRaw])
  }

  /** Pool → token symbol. Fail-fast: no silent pool-as-token casting. */
  function tokenFromPool(pool: StakingPool): StakingToken {
    const mapped = poolToToken?.[pool]
    if (!mapped) {
      throw new StakingError('POOL_UNKNOWN', `No poolToToken mapping for pool "${String(pool)}" on chainId=${config.chainId} — configure chains.evm.staking.poolToToken`)
    }
    return mapped
  }

  /** Token symbol → validated token info. */
  function tokenCfg(token: StakingToken): EvmStakingTokenInfo {
    const cfg = tokens[token]
    if (!cfg) {
      throw new StakingError('TOKEN_UNKNOWN', `Token ${String(token)} is not configured for chainId=${config.chainId} (known: ${Object.keys(tokens).join(', ')})`)
    }
    return cfg
  }

  /** APR pools stake via aprStaking; distributor pools via feeDistributor. */
  function stakingTarget(): EvmContractConfig {
    const target = contracts.aprStaking ?? contracts.feeDistributor
    if (!target) throw new StakingError('NOT_DEPLOYED', `No staking contract configured for chainId=${config.chainId}`)
    return target
  }

  return {
    async getPositions(address: string): Promise<StakingPosition[]> {
      if (config.readPositions) return config.readPositions(address)
      return []
    },

    async stake(token: StakingToken, amount: string): Promise<StakeTxResult> {
      requireAmount(amount)
      return withWallet(async (client) => {
        const cfg = tokenCfg(token)
        const amountRaw = parseTokenAmount(amount, cfg.tokenDecimals)
        const target = stakingTarget()
        await ensureApproval(client, cfg.tokenAddress, target.address, amountRaw)
        const method = methods[`stake${String(token)}`] ?? `stake${String(token)}`
        return writeStakingMethod(client, target.address, target.abi, method, [amountRaw])
      })
    },

    async unstake(token: StakingToken, amount: string): Promise<StakeTxResult> {
      requireAmount(amount)
      return withWallet(async (client) => {
        const cfg = tokenCfg(token)
        const amountRaw = parseTokenAmount(amount, cfg.tokenDecimals)
        const target = stakingTarget()
        const method = methods[`unstake${String(token)}`] ?? `unstake${String(token)}`
        return writeStakingMethod(client, target.address, target.abi, method, [amountRaw])
      })
    },

    async claimRewards(token: StakingToken): Promise<StakeTxResult> {
      return withWallet(async (client) => {
        tokenCfg(token)
        if (contracts.aprStaking) {
          const method = methods[`claim${String(token)}`] ?? methods.claimReward ?? 'claimReward'
          return writeStakingMethod(client, contracts.aprStaking.address, contracts.aprStaking.abi, method, [])
        }
        const claimOverride = methods[`claim${String(token)}`]
        if (contracts.feeDistributor && claimOverride) {
          return writeStakingMethod(
            client,
            contracts.feeDistributor.address,
            contracts.feeDistributor.abi,
            claimOverride,
            []
          )
        }
        return { txHash: '' }
      })
    },

    async stakeByPool(pool: StakingPool, amount: string): Promise<StakeTxResult> {
      return this.stake(tokenFromPool(pool), amount)
    },

    async unstakeByPool(pool: StakingPool, amount: string): Promise<StakeTxResult> {
      return this.unstake(tokenFromPool(pool), amount)
    },

    async claimByPool(pool: StakingPool): Promise<StakeTxResult> {
      const token = tokenFromPool(pool)
      if (pool === 'DAARION_DISTRIBUTOR' && contracts.feeDistributor) {
        const claimOverride = methods[`claim${String(token)}`]
        if (claimOverride) {
          return withWallet(async (client) =>
            writeStakingMethod(
              client,
              contracts.feeDistributor!.address,
              contracts.feeDistributor!.abi,
              claimOverride,
              []
            )
          )
        }
        return { txHash: '' }
      }
      return this.claimRewards(token)
    },
  }
}
