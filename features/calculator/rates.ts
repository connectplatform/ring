/**
 * Calculator FX / credit rates — SSOT from ring-config (not hardcoded Settler RNG).
 *
 * Credit points are the internal unit. Display:
 *   fiat   = points × unitToDefaultCurrency  → store.defaultCurrency
 *   native = points ÷ pointsPerNativeToken   → nativeToken symbol
 */

import { getPointsPerNativeToken } from '@/lib/ring-config-chain'
import {
  getCreditUnitToDefaultCurrencyRate,
  getDefaultStoreCurrencySymbol,
  getNativeTokenSymbol,
  getSystemConfigSnapshot,
} from '@/lib/ring-config-core'

export type CalculatorDisplayUnit = 'fiat' | 'native'

export interface CalculatorRates {
  /** credit.unitToDefaultCurrency — points → store.defaultCurrency */
  unitToDefaultCurrency: number
  /** credit.desk.pointsPerNativeToken — points per 1 native token */
  pointsPerNativeToken: number
  /** store.defaultCurrency (e.g. USD) */
  defaultCurrency: string
  /** tokens.nativeToken symbol (e.g. RING) */
  nativeTokenSymbol: string
  /** credit.creditUnitLabel */
  creditUnitLabel: string
}

export function resolveCalculatorRates(): CalculatorRates {
  const snapshot = getSystemConfigSnapshot()
  const label = snapshot.credit?.creditUnitLabel
  return {
    unitToDefaultCurrency: getCreditUnitToDefaultCurrencyRate(),
    pointsPerNativeToken: getPointsPerNativeToken(),
    defaultCurrency: getDefaultStoreCurrencySymbol(),
    nativeTokenSymbol: getNativeTokenSymbol(),
    creditUnitLabel: typeof label === 'string' && label.trim() ? label.trim() : 'points',
  }
}

export function pointsToFiat(points: number, rates: CalculatorRates): number {
  const rate = rates.unitToDefaultCurrency > 0 ? rates.unitToDefaultCurrency : 1
  return Math.round(points * rate * 100) / 100
}

export function pointsToNative(points: number, rates: CalculatorRates): number {
  const ppt = rates.pointsPerNativeToken > 0 ? rates.pointsPerNativeToken : 100
  return Math.round((points / ppt) * 1e6) / 1e6
}

/** Convert a USD-denominated catalog price into credit points. */
export function usdCatalogToPoints(usd: number, rates: CalculatorRates): number {
  const rate = rates.unitToDefaultCurrency > 0 ? rates.unitToDefaultCurrency : 1
  return Math.round((usd / rate) * 100) / 100
}

export function formatDisplayAmount(
  points: number,
  unit: CalculatorDisplayUnit,
  rates: CalculatorRates,
): string {
  if (unit === 'native') {
    const n = pointsToNative(points, rates)
    return `${n.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${rates.nativeTokenSymbol}`
  }
  const fiat = pointsToFiat(points, rates)
  return `${rates.defaultCurrency} ${fiat.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}
