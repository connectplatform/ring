/**
 * Native token oracle — desk + Chainlink bridge implementation.
 *
 * **Callers: import from `@/lib/ring-oracle`** (finance-rate SSOT facade).
 *
 * Vocabulary (no USD/RING aliases in public API):
 * - **credit balance** — project core denomination (points ledger)
 * - **main currency** — project fiat (`store.mainCurrency`)
 * - **native token** — project token (e.g. RING)
 *
 * Layers:
 * 1. **Desk oracle** — admin-overridable main-currency units per 1 native
 *    (`platform_settings.web3.oracle.nativePerMainCurrency`)
 *    Default derivation: creditBalanceUnitPerNativeToken × credit.creditBalanceUnitToMainCurrency
 * 2. **Display FX** — main ↔ native UI for membership, desk, store, referrals
 * 3. **Chainlink feeds** — live allowlisted EVM token **USD** prices, then
 *    bridged to main via `getMainCurrencyToUsdRate()` (not for native DEX pools)
 */

import 'server-only'

import { createHmac, timingSafeEqual } from 'crypto'
import { db, initializeDatabase } from '@/lib/database'
import { getTokenDeskConfig, getNativeTokenSymbol } from '@/lib/ring-config-chain'
import {
  getMainCurrencySymbol,
  getExchangeRates,
  getMainCurrencyToUsdRate,
} from '@/lib/ring-config-core'
import { getMembershipMainCurrencyPerNativeToken } from '@/lib/membership/pricing'

const WEB3_NAMESPACE = 'web3'
const PLATFORM_SETTINGS_COLLECTION = 'platform_settings'

/** Desk/oracle default: exchangeRates[native] → env → membership desk SSOT → 10. */
function defaultNativePerMainCurrency(): string {
  if (process.env.NATIVE_TOKEN_ORACLE_DEFAULT_RATE?.trim()) {
    return process.env.NATIVE_TOKEN_ORACLE_DEFAULT_RATE.trim()
  }
  if (process.env.RING_ORACLE_DEFAULT_RATE?.trim()) {
    return process.env.RING_ORACLE_DEFAULT_RATE.trim()
  }
  try {
    const rates = getExchangeRates()
    const symbol = getNativeTokenSymbol()
    const keyed = rates?.[symbol]
    if (typeof keyed === 'number' && Number.isFinite(keyed) && keyed > 0) {
      return String(keyed)
    }
  } catch {
    // config unavailable during early boot
  }
  try {
    const sync = getMembershipMainCurrencyPerNativeToken()
    if (Number.isFinite(sync) && sync > 0) return String(sync)
  } catch {
    // pricing unavailable
  }
  return '10'
}

const DEFAULT_NATIVE_PER_MAIN = defaultNativePerMainCurrency()
const MAX_DEVIATION_BPS = 500

const ROW_META_KEYS = new Set([
  'id',
  'secrets',
  'updatedBy',
  'updatedAt',
  'createdAt',
  'version',
])

function quoteSecret(): string {
  const secret = process.env.ORACLE_QUOTE_SECRET || process.env.WALLET_ENCRYPTION_KEY
  if (!secret) {
    throw new Error('ORACLE_QUOTE_SECRET or WALLET_ENCRYPTION_KEY required for desk quotes')
  }
  return secret
}

type OracleData = {
  oracle?: {
    /**
     * Main-currency units per 1 native token UI unit.
     */
    nativePerMainCurrency?: string
    updatedAt?: string
    updatedBy?: string
  }
  audit?: Array<{
    at: string
    by: string
    oldRate?: string
    newRate: string
  }>
}

function extractOracleData(row: Record<string, unknown>): OracleData {
  const data = Object.fromEntries(
    Object.entries(row).filter(([key]) => !ROW_META_KEYS.has(key)),
  )
  return (data as OracleData) ?? {}
}

function resolveStoredRate(data: OracleData): string {
  return (
    data.oracle?.nativePerMainCurrency ??
    DEFAULT_NATIVE_PER_MAIN
  )
}

async function readWeb3Settings(): Promise<OracleData> {
  if (process.env.PLATFORM_SETTINGS_DISABLE_DB === 'true') {
    return {
      oracle: {
        nativePerMainCurrency: DEFAULT_NATIVE_PER_MAIN,
      },
    }
  }

  await initializeDatabase()
  const result = await db().readDoc<Record<string, unknown>>(
    PLATFORM_SETTINGS_COLLECTION,
    WEB3_NAMESPACE,
  )
  if (!result.success || !result.data) {
    return {
      oracle: {
        nativePerMainCurrency: DEFAULT_NATIVE_PER_MAIN,
      },
    }
  }

  const data = extractOracleData(result.data)
  const rate = resolveStoredRate(data)
  return data.oracle
    ? data
    : {
        oracle: {
          nativePerMainCurrency: rate,
        },
        ...data,
      }
}

async function writeWeb3Settings(data: OracleData, updatedBy: string): Promise<void> {
  if (process.env.PLATFORM_SETTINGS_DISABLE_DB === 'true') {
    throw new Error('Platform settings DB writes are disabled')
  }

  await initializeDatabase()
  const payload = {
    ...data,
    updatedBy,
  }

  const existing = await db().readDoc<Record<string, unknown>>(
    PLATFORM_SETTINGS_COLLECTION,
    WEB3_NAMESPACE,
  )
  if (existing.success && existing.data) {
    const update = await db().updateDoc(PLATFORM_SETTINGS_COLLECTION, WEB3_NAMESPACE, payload)
    if (!update.success) {
      throw update.error || new Error('Failed to update web3 platform settings')
    }
    return
  }

  const create = await db().createDoc(PLATFORM_SETTINGS_COLLECTION, payload, {
    id: WEB3_NAMESPACE,
  })
  if (!create.success) {
    throw create.error || new Error('Failed to create web3 platform settings')
  }
}

// ============================================================================
// 1. SYSTEM / DESK RATE — main currency per 1 native token
// ============================================================================

/**
 * Live desk oracle: **main currency** major units per 1 native token UI unit.
 * Example: `"10"` means 10 USD (if main=USD) buys 1 RING.
 */
export async function getNativeTokenPerMainCurrencyRate(): Promise<string> {
  const settings = await readWeb3Settings()
  return resolveStoredRate(settings)
}

export async function setNativeTokenPerMainCurrencyRate(
  newRate: string,
  updatedBy: string,
): Promise<{ nativePerMainCurrency: string }> {
  const parsed = parseFloat(newRate)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Oracle rate must be a positive number')
  }

  const settings = await readWeb3Settings()
  const oldRate = resolveStoredRate(settings)
  const oldNum = parseFloat(oldRate)
  if (oldNum > 0) {
    const deviationBps = Math.abs((parsed - oldNum) / oldNum) * 10_000
    if (deviationBps > MAX_DEVIATION_BPS) {
      throw new Error(`Rate change exceeds max deviation (${MAX_DEVIATION_BPS} bps)`)
    }
  }

  const now = new Date().toISOString()
  const next: OracleData = {
    ...settings,
    oracle: {
      nativePerMainCurrency: newRate,
      updatedAt: now,
      updatedBy,
    },
    audit: [
      ...(settings.audit ?? []).slice(-49),
      { at: now, by: updatedBy, oldRate, newRate },
    ],
  }

  await writeWeb3Settings(next, updatedBy)
  return { nativePerMainCurrency: newRate }
}

export async function getOracleAuditLog() {
  const settings = await readWeb3Settings()
  return settings.audit ?? []
}

// ============================================================================
// 2. DISPLAY FX (membership / desk / store / referrals)
// ============================================================================

export type NativeFiatRateResult = {
  /** Main-currency units per 1 native token. */
  nativePerMainCurrency: number
  mainCurrency: string
  source: 'desk_oracle' | 'ring_config'
  /** Native token symbol from config (not hardcoded). */
  nativeSymbol: string
}

/** Sync config-derived native↔main rate (no DB). Safe in RSC / cold paths. */
export function getNativeTokenToMainCurrencyRateSync(): number {
  return getMembershipMainCurrencyPerNativeToken()
}

/** Async desk oracle rate; falls back to sync config SSOT. */
export async function getNativeTokenToMainCurrencyRate(): Promise<NativeFiatRateResult> {
  const mainCurrency = getMainCurrencySymbol()
  const nativeSymbol = getNativeTokenSymbol()
  try {
    const raw = Number(await getNativeTokenPerMainCurrencyRate())
    if (Number.isFinite(raw) && raw > 0) {
      return {
        nativePerMainCurrency: raw,
        mainCurrency,
        source: 'desk_oracle',
        nativeSymbol,
      }
    }
  } catch {
    // fall through
  }
  const sync = getNativeTokenToMainCurrencyRateSync()
  return {
    nativePerMainCurrency: sync,
    mainCurrency,
    source: 'ring_config',
    nativeSymbol,
  }
}

/** mainMajor / nativePerMainCurrency → native UI amount string. */
export async function mainCurrencyToNativeTokenUi(mainCurrency: number): Promise<string> {
  const { nativePerMainCurrency } = await getNativeTokenToMainCurrencyRate()
  if (!Number.isFinite(mainCurrency) || mainCurrency <= 0 || nativePerMainCurrency <= 0) {
    throw new Error('Invalid fiat→native conversion inputs')
  }
  return (mainCurrency / nativePerMainCurrency).toFixed(8)
}

/** nativeUi × nativePerMainCurrency → main-currency major units. */
export async function mainTokenToMainCurrencyUi(nativeUi: string | number): Promise<number> {
  const { nativePerMainCurrency } = await getNativeTokenToMainCurrencyRate()
  const n = typeof nativeUi === 'number' ? nativeUi : parseFloat(String(nativeUi))
  if (!Number.isFinite(n) || n <= 0 || nativePerMainCurrency <= 0) {
    throw new Error('Invalid native→fiat conversion inputs')
  }
  return Number((n * nativePerMainCurrency).toFixed(2))
}

// ============================================================================
// 3. SIGNED DESK / TREASURY-SWAP QUOTES
// ============================================================================

export type SignedQuotePayload = {
  /** Desk: buy|sell. Wagmi treasury swap: treasury_swap_in (ERC-20 → custodial native). */
  side: 'buy' | 'sell' | 'treasury_swap_in'
  /** Native token amount (raw integer string). */
  ringAmountRaw: string
  /**
   * Desk buy: credit-balance points to spend.
   * Treasury swap: unused (`'0'`); see mainCurrencyNotional.
   */
  creditBalanceAmount: string
  /** Main-currency units per 1 native (desk SSOT). */
  rate: string
  discountBps: number
  expiresAt: number
  /** treasury_swap_in: main-currency notional of allowlisted token-in. */
  mainCurrencyNotional?: string
  fromTokenAddress?: string
  amountInRaw?: string
  /**
   * Chainlink TOKEN/USD answer for allowlisted inbound token.
   * USD kept in the name — AggregatorV3 feeds are USD-quoted (Q6).
   */
  tokenChainlinkUsdPrice?: string
  signInAddress?: string
  chainId?: number
}

function encodeQuote(payload: SignedQuotePayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

function decodeQuote(token: string): SignedQuotePayload {
  const json = Buffer.from(token.split('.')[0] ?? '', 'base64url').toString('utf8')
  return JSON.parse(json) as SignedQuotePayload
}

export function signQuote(
  payload: Omit<SignedQuotePayload, 'expiresAt'> & { expiresAt?: number },
) {
  const desk = getTokenDeskConfig()
  const ttlSeconds = (desk.quoteTtlSeconds ?? 60) as number
  const full: SignedQuotePayload = {
    ...payload,
    expiresAt: payload.expiresAt ?? Date.now() + ttlSeconds * 1000,
  }
  const body = encodeQuote(full)
  const sig = createHmac('sha256', quoteSecret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyQuoteToken(quoteToken: string): SignedQuotePayload {
  const [body, sig] = quoteToken.split('.')
  if (!body || !sig) {
    throw new Error('Invalid quote token')
  }

  const expected = createHmac('sha256', quoteSecret()).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Quote signature mismatch')
  }

  const payload = decodeQuote(quoteToken)
  if (Date.now() > payload.expiresAt) {
    throw new Error('Quote expired')
  }

  return payload
}

export async function assertQuoteSlippage(payload: SignedQuotePayload): Promise<void> {
  const desk = getTokenDeskConfig()
  const maxSlippageBps = (desk.maxSlippageBps ?? 100) as number
  const liveRate = parseFloat(await getNativeTokenPerMainCurrencyRate())
  const quotedRate = parseFloat(payload.rate)
  if (!liveRate || !quotedRate) return

  const deviationBps = (Math.abs(liveRate - quotedRate) / liveRate) * 10_000
  if (deviationBps > maxSlippageBps) {
    throw new Error('Oracle rate moved beyond slippage tolerance — request a new quote')
  }
}

// ============================================================================
// 4. CHAINLINK ALLOWLIST FEEDS — USD read + bridge to main currency
// ============================================================================

/**
 * Allowlisted EVM token price in **main currency** units.
 *
 * Pipeline: Chainlink TOKEN/USD → ÷ `getMainCurrencyToUsdRate()` → main per 1 token.
 * Native-token FX remains desk SSOT only (no DEX listing).
 */
export async function getMainCurrencyPriceFromFeed(
  feedAddress: string,
  chainId?: number,
  options?: { maxAgeMs?: number },
) {
  const { nativeTokenChainlinkOracleService } = await import(
    '@/features/wallet/services/native-token-chainlink-oracle'
  )
  const usd = await nativeTokenChainlinkOracleService.getChainlinkUsdPriceFromFeed(
    feedAddress,
    chainId,
    options,
  )
  const mainToUsd = getMainCurrencyToUsdRate()
  const usdPrice = parseFloat(usd.price)
  if (!Number.isFinite(usdPrice) || usdPrice <= 0 || mainToUsd <= 0) {
    throw new Error('main_currency_price_bridge_invalid')
  }
  return {
    ...usd,
    price: (usdPrice / mainToUsd).toFixed(8),
    quoteCurrency: getMainCurrencySymbol(),
    chainlinkUsdPrice: usd.price,
    mainCurrencyToUsd: mainToUsd,
  }
}

/**
 * Native token display price for UI (desk SSOT, not Chainlink).
 */
export async function getNativeTokenDisplayPrice(chainId?: number) {
  const rate = await getNativeTokenToMainCurrencyRate()
  return {
    price: String(rate.nativePerMainCurrency),
    timestamp: Date.now(),
    source: rate.source === 'desk_oracle' ? 'desk_oracle' : 'ring_config',
    confidence: rate.source === 'desk_oracle' ? 0.95 : 0.85,
    chainId,
    mainCurrency: rate.mainCurrency,
    nativeSymbol: rate.nativeSymbol,
  }
}
