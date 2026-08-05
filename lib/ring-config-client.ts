/**
 * Client-safe ring-config accessors (reads ring-config.json via ring-config-core).
 * Use instead of hardcoding USD / RING in wallet UI components.
 *
 * ## React `use()` guidance (legiox react_19_specialist + RSC architect)
 * Ring-config snapshot accessors are **synchronous** (imported JSON / cached
 * getters). Do **NOT** wrap them in `use()` — `use()` is for Promises/context.
 * Prefer:
 * - Server Components: call accessors directly (or `cache()`-wrapped helpers)
 * - Client islands: call sync getters as today; for async desk rates use
 *   Suspense + server-fetched props or `use()` only around a real Promise
 *   (e.g. fetch desk quote once). Prefer `@/lib/ring-oracle`
 *   on the server for FX — never block desktop nav on wagmi.
 *
 * TODO:
 *   - Prefer Suspense-streamed server props over client useEffect for balances
 *   - Keep useActionState + Zod for mutative forms
 */

import {
  getCreditUnitLabel,
  getCreditUnitToMainCurrencyRate,
  getMainCurrencySymbol,
  getSystemConfigSnapshot,
} from '@/lib/ring-config-core'
import type { SupportedCurrencies } from '@/lib/ring-config-core'
import { getNativeTokenSymbol, isNativeTokenOnrampEnabled as isNativeTokenOnrampEnabledServer } from '@/lib/ring-config-chain'

/**
 * Returns the current native token symbol from config, or defaults to 'RING'
 */
export function getClientNativeTokenSymbol(): string {
  return getNativeTokenSymbol()
}

/**
 * Client/UI gate for BuyNativeViaCard tabs.
 * Prefers NEXT_PUBLIC_CONFIDENTIAL_TOKEN_ONRAMP; falls through to ring-config-chain SSOT.
 */
export function isNativeTokenOnrampEnabled(): boolean {
  const pub = process.env.NEXT_PUBLIC_CONFIDENTIAL_TOKEN_ONRAMP?.trim().toLowerCase()
  if (pub === 'true') return true
  if (pub === 'false') return false
  return isNativeTokenOnrampEnabledServer()
}

/**
 * Project main currency symbol for client surfaces.
 * SSOT: ring-config.json → `store.mainCurrency` (same value as the server accessor).
 */
export function getClientMainCurrency(): SupportedCurrencies {
  return getMainCurrencySymbol()
}

/** Display label for the credit balance unit (ring-config.json → credit.creditBalanceUnitLabel). */
export function getClientCreditUnitLabel(): string {
  return getCreditUnitLabel()
}

/**
 * Client-side desk buy preview: points → native token.
 * Prefer live quote from `/api/wallet/desk/quote`; this is a fallback estimate.
 * Matches desk-service: nativeOut = (points × creditBalanceUnitToMainCurrency) / nativePerMainCurrency.
 * SSOT: 100 points × 0.1 USD/point / $10/RING = 1 RING.
 */
export function previewNativeTokenFromCreditPoints(
  points: number,
  nativePerMainCurrency = getClientNativePerMainCurrencyDefault(),
): string {
  if (points <= 0 || !Number.isFinite(nativePerMainCurrency) || nativePerMainCurrency <= 0) return '0'
  const unit = getCreditUnitToMainCurrencyRate()
  const mainCurrencyAmount = points * (unit > 0 ? unit : 0.1)
  const nativeUi = mainCurrencyAmount / nativePerMainCurrency
  return nativeUi.toFixed(8).replace(/\.?0+$/, '')
}

/**
 * Points → main-currency fiat via ring-config `credit.creditBalanceUnitToMainCurrency`
 * (same rate as `@/lib/ring-oracle` `getCreditUnitToMainCurrencyRate` — client-safe path).
 * Never uses desk/Chainlink oracle.
 */
export function previewMainCurrencyFromCreditPoints(points: number): string {
  if (!Number.isFinite(points) || points < 0) return '0.00'
  const rate = getCreditUnitToMainCurrencyRate()
  const main = points * (rate > 0 && Number.isFinite(rate) ? rate : 0.1)
  if (!Number.isFinite(main)) return '0.00'
  return main.toFixed(2)
}

/**
 * Resolve display fiat for credit points. Prefer recomputing from SSOT rate when
 * stored ledger `main_currency_equivalent` is missing, NaN, or non-finite (legacy corruption).
 */
export function resolveCreditMainCurrencyEquivalent(
  points: string | number | null | undefined,
  storedEquivalent?: string | null,
): string {
  const pts = typeof points === 'number' ? points : Number.parseFloat(String(points ?? '0'))
  const safePoints = Number.isFinite(pts) ? pts : 0
  const computed = previewMainCurrencyFromCreditPoints(safePoints)

  if (storedEquivalent == null || storedEquivalent === '') return computed
  const stored = Number.parseFloat(String(storedEquivalent).replace(/,/g, ''))
  if (!Number.isFinite(stored) || String(storedEquivalent).toLowerCase().includes('nan')) {
    return computed
  }
  // Prefer SSOT recompute so UI matches current creditBalanceUnitToMainCurrency
  return computed
}

/**
 * Returns the configured name of the native token, or a human readable default.
 */
export function getClientNativeTokenName(): string {
  // Return native token name, fallback to human-description string as default.
  return getSystemConfigSnapshot().tokens?.nativeToken?.tokenName ?? 'RING Governance Token'
}

/**
 * Returns the number of decimals for the native token, using per-chain config if available.
 * - If 'solana', prefer config.chains.solana, else token global, else default 8.
 * - If 'evm', prefer config.chains.evm, else default 18.
 * - Otherwise, fallback on token-level config or default.
 */
export function getClientNativeTokenDecimals(chain?: 'solana' | 'evm'): number {
  const config = getSystemConfigSnapshot()

  if (chain === 'solana') {
    // Prefer chain-specific decimals, fallback to top-level, then sensible protocol default.
    return config.chains?.solana?.tokenDecimals ?? config.tokens?.nativeToken?.tokenDecimals ?? 8
  }
  if (chain === 'evm') {
    // EVM default is 18, unless chain config overrides.
    return config.chains?.evm?.tokenDecimals ?? 18
  }
  // If no chain specified, fallback to token-level or protocol default.
  return config.tokens?.nativeToken?.tokenDecimals ?? 8
}

/**
 * Client-safe treasury swap allowlist (chains.evm.treasurySwapAllowlist).
 */
export function getClientTreasurySwapAllowlist(): Array<{
  tokenAddress: `0x${string}`
  address: `0x${string}`
  symbol: string
  decimals: number
  enabled: boolean
  chainlinkFeed?: string
}> {
  const evm = getSystemConfigSnapshot().chains?.evm as
    | {
        treasurySwapAllowlist?: Array<{
          address?: string
          symbol?: string
          decimals?: number
          enabled?: boolean
          chainlinkFeed?: string
        }>
      }
    | undefined
  const list = Array.isArray(evm?.treasurySwapAllowlist) ? evm.treasurySwapAllowlist : []
  return list
    .filter((e) => e.enabled !== false && Boolean(e.address) && Boolean(e.symbol))
    .map((e) => {
      const address = e.address as `0x${string}`
      return {
        tokenAddress: address,
        address,
        symbol: e.symbol!,
        decimals: typeof e.decimals === 'number' ? e.decimals : 18,
        enabled: true,
        chainlinkFeed: e.chainlinkFeed,
      }
    })
}

export function getClientEvmTreasuryAddress(): string | null {
  const fromConfig = (getSystemConfigSnapshot().chains?.evm as { treasuryAddress?: string } | undefined)
    ?.treasuryAddress
    ?.trim()
  const fromPublic = process.env.NEXT_PUBLIC_EVM_TREASURY_ADDRESS?.trim()
  const addr = fromConfig || fromPublic
  if (!addr || addr === '0x0000000000000000000000000000000000000000') return null
  return addr
}

/** Fiat → credit points via card (wallet_topup). SSOT: payment.cardPaymentProcessor + gateways. */
export function isClientFiatCardTopupEnabled(): boolean {
  const payment = getSystemConfigSnapshot().payment as
    | {
        cardPaymentProcessor?: string
        gateways?: Record<string, { enabled?: boolean }>
      }
    | undefined
  const proc = (payment?.cardPaymentProcessor ?? 'wayforpay').toLowerCase()
  if (proc === 'wayforpay') return payment?.gateways?.wayforpay?.enabled !== false
  if (proc === 'stripe') return payment?.gateways?.stripe?.enabled === true
  return Boolean(payment?.gateways?.[proc]?.enabled)
}

/** Fiat onramp umbrella (card rails available for wallet credit top-up). */
export function isClientFiatOnrampEnabled(): boolean {
  return isClientFiatCardTopupEnabled()
}

/** PayPal → credit when gateway enabled and fiat onramp is on. */
export function isClientFiatPaypalTopupEnabled(): boolean {
  if (!isClientFiatOnrampEnabled()) return false
  const payment = getSystemConfigSnapshot().payment as
    | { gateways?: Record<string, { enabled?: boolean }> }
    | undefined
  return payment?.gateways?.paypal?.enabled === true
}

/** Hosted checkout brand for card top-up copy. */
export function getClientWalletTopupProcessorLabel(): string {
  const payment = getSystemConfigSnapshot().payment as
    | { cardPaymentProcessor?: string }
    | undefined
  const proc = (payment?.cardPaymentProcessor ?? 'wayforpay').toLowerCase()
  if (proc === 'stripe') return 'Stripe'
  if (proc === 'paypal') return 'PayPal'
  return 'WayForPay'
}

/** Card PSP for store/membership checkout. SSOT: payment.cardPaymentProcessor. */
export function getClientCardPaymentProcessor(): 'wayforpay' | 'stripe' {
  const payment = getSystemConfigSnapshot().payment as
    | { cardPaymentProcessor?: string }
    | undefined
  const proc = (payment?.cardPaymentProcessor ?? 'wayforpay').toLowerCase()
  return proc === 'stripe' ? 'stripe' : 'wayforpay'
}

/**
 * Default native-token price in main-currency units (main per 1 native).
 * SSOT: exchangeRates[nativeTokenSymbol] → NEXT_PUBLIC_RING_ORACLE_DEFAULT_RATE → 10.
 */
export function getClientNativePerMainCurrencyDefault(): number {
  const rates = getSystemConfigSnapshot().exchangeRates as Record<string, number> | undefined
  const fromConfig = rates?.[getNativeTokenSymbol()]
  if (typeof fromConfig === 'number' && Number.isFinite(fromConfig) && fromConfig > 0) {
    return fromConfig
  }
  const fromEnv = Number(process.env.NEXT_PUBLIC_RING_ORACLE_DEFAULT_RATE ?? NaN)
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 10
}

export type ClientStorePaymentRailId = 'card' | 'credit_balance' | 'native_token' | 'paypal'

export interface ClientStorePaymentRail {
  id: ClientStorePaymentRailId
  /** API path under /api/store/payments/ */
  api: 'card' | 'credit_balance' | 'native_token' | 'paypal'
  enabled: boolean
  recommended?: boolean
}

/**
 * Store checkout rails for UI — mirrors PaymentConductor store_order rails.
 * Card always on. Credit/token/paypal gated by env + payment.gateways.
 */
export function getClientStorePaymentRails(): ClientStorePaymentRail[] {
  const payment = getSystemConfigSnapshot().payment as
    | {
        gateways?: Record<string, { enabled?: boolean }>
      }
    | undefined
  const gateways = payment?.gateways ?? {}

  // Store rails: PaymentConductor isRailEnabled + payment.gateways (not membership.supportedMethods).
  const creditEnabled =
    process.env.NEXT_PUBLIC_PAYMENT_STORE_ALLOW_CREDIT !== 'false' &&
    gateways.credit_balance?.enabled !== false

  const tokenEnabled =
    process.env.NEXT_PUBLIC_PAYMENT_STORE_ALLOW_TOKEN === 'true' &&
    gateways.native_token?.enabled !== false

  const paypalEnabled =
    process.env.NEXT_PUBLIC_PAYMENT_STORE_ALLOW_PAYPAL === 'true' &&
    gateways.paypal?.enabled === true

  const cardProcessor = getClientCardPaymentProcessor()
  const cardEnabled = gateways[cardProcessor]?.enabled !== false

  return [
    { id: 'card', api: 'card', enabled: cardEnabled, recommended: true },
    { id: 'credit_balance', api: 'credit_balance', enabled: creditEnabled },
    { id: 'native_token', api: 'native_token', enabled: tokenEnabled },
    { id: 'paypal', api: 'paypal', enabled: paypalEnabled },
  ]
}

/**
 * Returns array of currencies for opportunity budget (select input: fiat & token).
 * Model: [{ value: symbol, label: symbol }, ...]
 *
 * // STUB: This can be extended in the future for multi-fiat and multiple tokens:
 * //       - Load and join all available fiat symbols from config.
 * //       - Load and join all relevant token symbols from config.
 * // TODO: Optionally derive currencies and labels from i18n or config metadata,
 *          or return sorted unique currencies for more robust select experience.
 */
/** Whitelabel site / project display name (e.g. "Ring Platform"). */
export function getClientSiteName(): string {
  return getSystemConfigSnapshot().seo?.siteName
    ?? getSystemConfigSnapshot().clone?.displayName
    ?? 'Ring Platform'
}

export function getClientOpportunityBudgetCurrencies(): Array<{ value: string; label: string }> {
  // Get the default (store) fiat symbol from config
  const fiat = getMainCurrencySymbol()
  // Get the current native token symbol from ring-config-chain abstraction
  const token = getNativeTokenSymbol()
  // Return two options for UI select/dropdown etc.
  return [
    { value: fiat, label: fiat },
    { value: token, label: token },
  ]
}
