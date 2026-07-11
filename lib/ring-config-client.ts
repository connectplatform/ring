/**
 * Client-safe ring-config accessors (reads ring-config.json via ring-config-core).
 * Use instead of hardcoding USD / RING in wallet UI components.
 *
 * NOTE: The following accessors are designed to provide safe and convenient retrieval
 *       of config values for frontend consumption.
 *
 * TODO:
 *   - Consider leveraging React 19's new use() hook and Next 16's Server Actions
 *     for config loading/state, if/when codebase migrates to full React/Next support.
 *   - See: https://react.dev/reference/react/use
 *   - Consider transforming module-level accessors into composable hooks or Server Components (future refactor).
 */

import { getDefaultStoreCurrencySymbol, getSystemConfigSnapshot } from '@/lib/ring-config-core'
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
 * Returns the configured fiat currency for credits in the system,
 * preferring 'fiatUnit', then 'unit', then defaulting to 'USD'
 * 
 * // TODO: This function is marked for potential refactor or deprecation.
 *         Consider removing or integrating into a composable context/hook.
 *         - Check all usage for type safety and server/client boundaries.
 */
export function getClientCreditFiatCurrency(): string {
  const credits = getSystemConfigSnapshot().credits
  return credits?.fiatUnit ?? credits?.unit ?? 'USD'
}

/** Display label for platform credit points (ring-config.json → credit.creditUnitLabel). */
export function getClientCreditUnitLabel(): string {
  const snapshot = getSystemConfigSnapshot() as { credit?: { creditUnitLabel?: string } }
  return snapshot.credit?.creditUnitLabel ?? 'points'
}

/**
 * Client-side desk buy preview: points → native token.
 * Prefer live quote from `/api/wallet/desk/quote`; this is a fallback estimate.
 * Formula matches desk-service: nativeOut = points / ringPerUsd (rate 100 → 100 points = 1 RING).
 */
export function previewNativeTokenFromCreditPoints(
  points: number,
  ringPerUsd = Number(process.env.NEXT_PUBLIC_RING_ORACLE_DEFAULT_RATE ?? 100),
): string {
  if (points <= 0 || !Number.isFinite(ringPerUsd) || ringPerUsd <= 0) return '0'
  const ringUi = points / ringPerUsd
  return ringUi.toFixed(8).replace(/\.?0+$/, '')
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
  const fiat = getDefaultStoreCurrencySymbol()
  // Get the current native token symbol from ring-config-chain abstraction
  const token = getNativeTokenSymbol()
  // Return two options for UI select/dropdown etc.
  return [
    { value: fiat, label: fiat },
    { value: token, label: token },
  ]
}
