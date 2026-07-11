import { getDefaultStoreCurrencySymbol } from '@/lib/payments/payment.config'
import { getCreditUnitToDefaultCurrencyRateString } from '@/lib/ring-config-core'

/** Server-side label for project fiat credit balance (not on-chain RING). */
export function getCreditCurrencyCode(): string {
  return getDefaultStoreCurrencySymbol()
}

/** Display string e.g. "USD credit" for API messages. */
export function formatCreditAmount(amount: string | number, currency?: string): string {
  const code = currency ?? getDefaultStoreCurrencySymbol()
  const value = typeof amount === 'number' ? amount.toFixed(2) : amount
  return `${value} ${code}`
}

/**
 * Fiat ledger rate for spend/top-up accounting (points → defaultCurrency).
 * Re-exports ring-config SSOT — never native-token oracle.
 */
export function getFiatCreditAccountingRate(): string {
  return getCreditUnitToDefaultCurrencyRateString()
}
