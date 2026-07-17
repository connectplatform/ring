import { getDefaultStoreCurrencySymbol } from '@/lib/payments/payment.config'
import {
  getCreditUnitToDefaultCurrencyRateString,
  getSystemConfigSnapshot,
} from '@/lib/ring-config-core'

/**
 * Credit balance denomination label (ring-config `credit.creditUnitLabel`).
 * Default: `points`. This is what `users.credit_balance` stores — not USD, not RING.
 */
export function getCreditUnitLabel(): string {
  const label = getSystemConfigSnapshot().credit?.creditUnitLabel
  return typeof label === 'string' && label.trim() ? label.trim() : 'points'
}

/**
 * Store defaultCurrency code (e.g. USD) used when converting credit units → fiat
 * via `getFiatCreditAccountingRate()` / `credit.unitToDefaultCurrency`.
 * Not the ledger denomination — that is `getCreditUnitLabel()`.
 */
export function getCreditCurrencyCode(): string {
  return getDefaultStoreCurrencySymbol()
}

/** Display string for API messages, e.g. "25 points". */
export function formatCreditAmount(amount: string | number, unit?: string): string {
  const code = unit ?? getCreditUnitLabel()
  const value = typeof amount === 'number' ? amount.toFixed(2) : amount
  return `${value} ${code}`
}

/**
 * Credit-unit → store.defaultCurrency accounting rate (string).
 * SSOT: `ring-config.json` → `credit.unitToDefaultCurrency` via
 * `getCreditUnitToDefaultCurrencyRateString()`. Never native-token oracle.
 */
export function getFiatCreditAccountingRate(): string {
  return getCreditUnitToDefaultCurrencyRateString()
}
