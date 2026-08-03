/**
 * Credit-balance denomination facade.
 *
 * Vocabulary (SSOT):
 * - **credit balance unit** — core denomination of `users.credit_balance` (label default `points`)
 * - **main currency** — project fiat (`store.mainCurrency`)
 *
 * All values resolve through `@/lib/ring-config-core` (and are re-exported from
 * `@/lib/ring-oracle` for server callers). The desk/Chainlink oracle is never
 * consulted for credit accounting rates.
 */

import {
  getCreditUnitLabel,
  getCreditUnitToMainCurrencyRate,
  getCreditUnitToMainCurrencyRateString,
} from '@/lib/ring-config-core'

export { getCreditUnitLabel, getCreditUnitToMainCurrencyRate }

/** Display string for API messages, e.g. "25 points". */
export function formatCreditAmount(amount: string | number, unit?: string): string {
  const code = unit ?? getCreditUnitLabel()
  const value = typeof amount === 'number' ? amount.toFixed(2) : amount
  return `${value} ${code}`
}

/**
 * Credit balance unit → main currency accounting rate (string form).
 * SSOT: `ring-config.json` → `credit.creditBalanceUnitToMainCurrency`.
 */
export function getMainCurrencyCreditAccountingRate(): string {
  return getCreditUnitToMainCurrencyRateString()
}
