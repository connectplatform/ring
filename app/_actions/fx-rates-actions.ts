'use server'

/**
 * Client-safe FX hydration — pulls live rates through ring-oracle SSOT.
 * Used by StorePaymentMethodsProvider so browser convertPrice matches server.
 */

import {
  ensureFxFeedFresh,
  getExchangeRates,
  getFxOverlayFetchedAt,
  getFxOverlayMeta,
  getMainCurrencySymbol,
} from '@/lib/ring-oracle'

export type LiveExchangeRatesPayload = {
  rates: Record<string, number>
  mainCurrency: string
  fetchedAt: string | null
  provider: string | null
}

export async function getLiveExchangeRates(): Promise<LiveExchangeRatesPayload> {
  try {
    await ensureFxFeedFresh()
  } catch {
    /* static exchangeRates still apply */
  }
  const meta = getFxOverlayMeta()
  return {
    rates: getExchangeRates(),
    mainCurrency: getMainCurrencySymbol(),
    fetchedAt: getFxOverlayFetchedAt(),
    provider: meta?.provider ?? null,
  }
}
