/**
 * Ring Oracle — Single Source of Truth for all finance rates.
 *
 * Import surface for codebase-wide rate resolution. Implementations stay in
 * their modules; callers must prefer `@/lib/ring-oracle` over deep imports.
 *
 * ValueDenomination triad (`lib/value-denomination.ts`):
 * - `credit_balance` — project-owned ledger unit (label often "points")
 * - `native_token` — project token (`tokens.nativeToken.symbol`)
 * - `main_currency` — project fiat (`store.mainCurrency`)
 *
 * Four rate families:
 * 1. **Desk** — admin-overridable main-currency units per 1 native token
 * 2. **Chainlink** — allowlisted EVM token USD feeds, bridged to main
 * 3. **Fiat FX** — NBU / open.er-api / frankfurter presentment feeds
 * 4. **Credit** — credit-balance unit ↔ main (never consults desk/Chainlink)
 *
 * Legacy env: `RING_ORACLE_DEFAULT_RATE` (and `NATIVE_TOKEN_ORACLE_DEFAULT_RATE`)
 * still feed the desk default inside native-token-oracle.
 */

import 'server-only'

export type { ValueDenomination } from '@/lib/value-denomination'
export {
  VALUE_DENOMINATIONS,
  isValueDenomination,
  normalizeValueDenomination,
} from '@/lib/value-denomination'

// ---------------------------------------------------------------------------
// 1. Desk oracle — native ↔ main + signed quotes
// ---------------------------------------------------------------------------

export {
  getNativeTokenPerMainCurrencyRate,
  setNativeTokenPerMainCurrencyRate,
  getOracleAuditLog,
  getNativeTokenToMainCurrencyRateSync,
  getNativeTokenToMainCurrencyRate,
  mainCurrencyToNativeTokenUi,
  mainTokenToMainCurrencyUi,
  signQuote,
  verifyQuoteToken,
  assertQuoteSlippage,
  getNativeTokenDisplayPrice,
  type NativeFiatRateResult,
  type SignedQuotePayload,
} from '@/features/wallet/services/native-token-oracle'

import {
  getNativeTokenToMainCurrencyRate,
  mainCurrencyToNativeTokenUi as deskMainCurrencyToNativeTokenUi,
  mainTokenToMainCurrencyUi,
} from '@/features/wallet/services/native-token-oracle'
import { getMainCurrencySymbol } from '@/lib/ring-config-core'

/**
 * Desk rate snapshot for public-pool / jar flows.
 * Replaces the former `public-pool-desk-fx` wrapper.
 */
export async function getDeskOracleNativeTokenPerMainCurrency(): Promise<{
  nativePerMainCurrency: number
  mainCurrency: string
}> {
  const { nativePerMainCurrency, mainCurrency } = await getNativeTokenToMainCurrencyRate()
  return {
    nativePerMainCurrency,
    mainCurrency: mainCurrency || getMainCurrencySymbol(),
  }
}

/**
 * Main-currency amount → native UI + rate metadata (desk SSOT).
 */
export async function mainCurrencyToNativeTokenUiWithMeta(mainCurrencyAmount: number): Promise<{
  nativeUi: string
  nativePerMainCurrency: number
  mainCurrency: string
}> {
  if (!Number.isFinite(mainCurrencyAmount) || mainCurrencyAmount <= 0) {
    throw new Error('Invalid main currency amount')
  }
  const { nativePerMainCurrency, mainCurrency } = await getDeskOracleNativeTokenPerMainCurrency()
  return {
    nativeUi: await deskMainCurrencyToNativeTokenUi(mainCurrencyAmount),
    nativePerMainCurrency,
    mainCurrency,
  }
}

/**
 * Native UI amount → main-currency major units + rate metadata (desk SSOT).
 */
export async function nativeTokenUiToMainCurrencyWithMeta(
  nativeUi: string | number,
): Promise<{
  mainCurrencyAmount: number
  nativePerMainCurrency: number
  mainCurrency: string
}> {
  const { nativePerMainCurrency, mainCurrency } = await getDeskOracleNativeTokenPerMainCurrency()
  return {
    mainCurrencyAmount: await mainTokenToMainCurrencyUi(nativeUi),
    nativePerMainCurrency,
    mainCurrency,
  }
}

// ---------------------------------------------------------------------------
// 2. Chainlink — external EVM token USD → main bridge
// ---------------------------------------------------------------------------

export {
  getMainCurrencyPriceFromFeed,
} from '@/features/wallet/services/native-token-oracle'

export {
  NativeTokenChainlinkOracleService,
  nativeTokenChainlinkOracleService,
  type PriceData,
} from '@/features/wallet/services/native-token-chainlink-oracle'

// ---------------------------------------------------------------------------
// 3. Fiat FX — presentment feeds + convert helpers
// ---------------------------------------------------------------------------

export {
  ensureFxFeedFresh,
  refreshFxFeed,
  resolveFxFeedConfig,
  getMemoryFxFeedRates,
  getMemoryFxFetchedAt,
  type FxFeedCache,
} from '@/lib/fx/fx-feed-service'

export {
  getFxOverlayRates,
  getFxOverlayFetchedAt,
  getFxOverlayMeta,
} from '@/lib/fx/fx-rates-overlay'

export {
  getExchangeRates,
  convertToMainCurrency,
  convertFromMainCurrency,
  getMainCurrencyToUsdRate,
  getMainCurrencySymbol,
  getNativeTokenSymbol,
} from '@/lib/ring-config-core'

// ---------------------------------------------------------------------------
// 4. Credit balance — accounting rates (never desk/Chainlink)
// ---------------------------------------------------------------------------

export {
  getCreditUnitToMainCurrencyRate,
  getCreditUnitToMainCurrencyRateString,
  getCreditUnitLabel,
} from '@/lib/ring-config-core'

export { getCreditUnitPerNativeToken } from '@/lib/ring-config-chain'

export {
  formatCreditAmount,
  getMainCurrencyCreditAccountingRate,
} from '@/lib/payments/credit-balance'
