/**
 * Calculator FX / credit rates — SSOT from ring-config (not hardcoded Settler RNG).
 *
 * The calculator catalog is priced in **credit balance units** (label default `points`).
 * Display conversions:
 *   main currency = creditBalanceUnit × creditBalanceUnitToMainCurrency  → store.mainCurrency
 *   native token  = creditBalanceUnit ÷ creditBalanceUnitPerNativeToken  → tokens.nativeToken
 *
 * Chainlink is deliberately absent here: it only prices allowlisted EVM tokens for
 * treasury swaps from externally connected wallets, never the catalog display FX.
 */

import { getCreditUnitPerNativeToken } from '@/lib/ring-config-chain'
import {
  getCreditUnitLabel,
  getCreditUnitToMainCurrencyRate,
  getMainCurrencySymbol,
  getNativeTokenSymbol,
} from '@/lib/ring-config-core'

export type CalculatorDisplayUnit = 'main_currency' | 'native_token'

export interface CalculatorRates {
  /** credit.creditBalanceUnitToMainCurrency — credit balance unit → store.mainCurrency */
  creditBalanceUnitToMainCurrency: number
  /** credit.desk.creditBalanceUnitPerNativeToken — credit balance units per 1 native token */
  creditBalanceUnitPerNativeToken: number
  /** store.mainCurrency (e.g. USD) */
  mainCurrency: string
  /** tokens.nativeToken symbol (e.g. RING) */
  nativeTokenSymbol: string
  /** credit.creditBalanceUnitLabel (e.g. points) */
  creditBalanceUnitLabel: string
}

export function resolveCalculatorRates(): CalculatorRates {
  return {
    creditBalanceUnitToMainCurrency: getCreditUnitToMainCurrencyRate(),
    creditBalanceUnitPerNativeToken: getCreditUnitPerNativeToken(),
    mainCurrency: getMainCurrencySymbol(),
    nativeTokenSymbol: getNativeTokenSymbol(),
    creditBalanceUnitLabel: getCreditUnitLabel(),
  }
}

export function creditBalanceUnitToMainCurrency(
  creditBalanceUnit: number,
  rates: CalculatorRates,
): number {
  const rate = rates.creditBalanceUnitToMainCurrency > 0 ? rates.creditBalanceUnitToMainCurrency : 1
  return Math.round(creditBalanceUnit * rate * 100) / 100
}

export function creditBalanceUnitToNativeToken(
  creditBalanceUnit: number,
  rates: CalculatorRates,
): number {
  const perNative =
    rates.creditBalanceUnitPerNativeToken > 0 ? rates.creditBalanceUnitPerNativeToken : 100
  return Math.round((creditBalanceUnit / perNative) * 1e6) / 1e6
}

/** Convert a main-currency catalog price into credit balance units. */
export function mainCurrencyToCreditBalanceUnit(
  mainCurrencyAmount: number,
  rates: CalculatorRates,
): number {
  const rate = rates.creditBalanceUnitToMainCurrency > 0 ? rates.creditBalanceUnitToMainCurrency : 1
  return Math.round((mainCurrencyAmount / rate) * 100) / 100
}

export function formatDisplayAmount(
  creditBalanceUnit: number,
  unit: CalculatorDisplayUnit,
  rates: CalculatorRates,
): string {
  if (unit === 'native_token') {
    const native = creditBalanceUnitToNativeToken(creditBalanceUnit, rates)
    return `${native.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${rates.nativeTokenSymbol}`
  }
  const main = creditBalanceUnitToMainCurrency(creditBalanceUnit, rates)
  return `${rates.mainCurrency} ${main.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}
