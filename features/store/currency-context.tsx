'use client'

/**
 * Store display currency SSOT.
 * - Base/list prices: store.defaultCurrency (via getDefaultStoreCurrencySymbol)
 * - Rail toggle: preferred fiat (supported currencies) ↔ native token (RING)
 * - Rates: ring-config.exchangeRates relative to defaultCurrency
 * PaymentConductor is checkout/PSP orchestration — not used for catalog price display.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { SupportedCrypto, SupportedCurrencies } from '@/lib/ring-config-types'
import {
  getDefaultStoreCurrencySymbol,
  getExchangeRates,
  getNativeTokenSymbol,
  getSupportedCurrencies,
} from '@/lib/ring-config-core'

export type StoreCurrency = SupportedCrypto | SupportedCurrencies | string

export const DEFAULT_CURRENCY: StoreCurrency = getDefaultStoreCurrencySymbol()
export const NATIVE_TOKEN_CURRENCY: StoreCurrency = getNativeTokenSymbol()
export const EXCHANGE_RATES: Record<string, number> = getExchangeRates()

/** Fiat codes from ring-config.currencies (user-preferred pool). */
const FIAT_CURRENCIES: StoreCurrency[] = getSupportedCurrencies()

/**
 * Legacy GreenFood token codes that may linger in localStorage carts / seeded DB rows.
 * Map to this clone's native token when no explicit exchange rate exists.
 */
const LEGACY_CLONE_TOKEN_ALIASES: Record<string, StoreCurrency> = {
  DAAR: NATIVE_TOKEN_CURRENCY,
  DAARION: NATIVE_TOKEN_CURRENCY,
}

/**
 * Resolve a product/list currency code to one that exists in exchangeRates.
 * Unknown / empty / legacy clone tokens → defaultCurrency (or native via alias).
 */
export function resolveStorePriceCurrency(
  code?: string | null,
): StoreCurrency {
  const raw = (code || '').trim().toUpperCase()
  if (!raw) return DEFAULT_CURRENCY
  if (typeof EXCHANGE_RATES[raw] === 'number') return raw
  const aliased = LEGACY_CLONE_TOKEN_ALIASES[raw]
  if (aliased && typeof EXCHANGE_RATES[aliased] === 'number') return aliased
  return DEFAULT_CURRENCY
}

/**
 * Currencies the rail may display: all supported fiats + native token.
 * Only codes with a numeric exchange rate are included.
 */
function buildDisplayCurrencies(): StoreCurrency[] {
  const ordered: StoreCurrency[] = []
  const push = (code: StoreCurrency) => {
    if (!code || ordered.includes(code)) return
    if (typeof EXCHANGE_RATES[code] !== 'number') return
    ordered.push(code)
  }
  push(DEFAULT_CURRENCY)
  for (const c of FIAT_CURRENCIES) push(c)
  push(NATIVE_TOKEN_CURRENCY)
  if (ordered.length === 0) ordered.push('USD')
  return ordered
}

const DISPLAY_CURRENCIES: StoreCurrency[] = buildDisplayCurrencies()

function isDisplayCurrency(code: string | null | undefined): code is StoreCurrency {
  return Boolean(code && DISPLAY_CURRENCIES.includes(code))
}

interface StoreCurrencyContextType {
  currency: StoreCurrency
  setCurrency: (currency: StoreCurrency) => void
  /** Toggle between current fiat preference and native token (or cycle fiats when already on token). */
  toggleCurrency: () => void
  convertPrice: (amount: number, from: StoreCurrency, to: StoreCurrency) => number
  formatPrice: (amount: number, currency: StoreCurrency) => string
  displayPrice: (amount: number, fromCurrency?: StoreCurrency) => string
  /** Secondary reference currency for ≈ row (native ↔ default fiat). */
  equivalentCurrency: StoreCurrency
  defaultCurrency: StoreCurrency
  nativeTokenCurrency: StoreCurrency
  displayCurrencies: StoreCurrency[]
}

const StoreCurrencyContext = createContext<StoreCurrencyContextType | null>(null)

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CAD: '$',
  AUD: '$',
  BTC: '₿',
  ETH: 'Ξ',
  INR: '₹',
  UAH: '₴',
  RING: 'Ⓡ',
}

export function StoreCurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<StoreCurrency>(DEFAULT_CURRENCY)
  const [mounted, setMounted] = useState(false)
  /** Last selected fiat — used so rail toggle returns to user preference, not always default. */
  const lastFiatRef = React.useRef<StoreCurrency>(DEFAULT_CURRENCY)

  useEffect(() => {
    setMounted(true)
    if (typeof window === 'undefined') return

    const savedCurrency = localStorage.getItem('ring-currency')
    const cookieCurrency = document.cookie
      .split('; ')
      .find((row) => row.startsWith('ring-currency='))
      ?.split('=')[1]

    let preferred: StoreCurrency = DEFAULT_CURRENCY
    if (isDisplayCurrency(cookieCurrency)) preferred = cookieCurrency
    else if (isDisplayCurrency(savedCurrency)) preferred = savedCurrency

    if (preferred !== NATIVE_TOKEN_CURRENCY) {
      lastFiatRef.current = preferred
    }
    setCurrencyState(preferred)
  }, [])

  const persistCurrencyPreference = (newCurrency: StoreCurrency) => {
    if (typeof window === 'undefined') return
    localStorage.setItem('ring-currency', newCurrency)
    document.cookie = `ring-currency=${newCurrency}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
  }

  const setCurrency = useCallback((newCurrency: StoreCurrency) => {
    if (!isDisplayCurrency(newCurrency)) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[StoreCurrency] Unsupported currency "${newCurrency}"`)
      }
      return
    }
    if (newCurrency !== NATIVE_TOKEN_CURRENCY) {
      lastFiatRef.current = newCurrency
    }
    setCurrencyState(newCurrency)
    persistCurrencyPreference(newCurrency)
  }, [])

  const toggleCurrency = useCallback(() => {
    // Binary toggle: fiat preference ↔ native token (matches left-rail UX).
    if (currency === NATIVE_TOKEN_CURRENCY) {
      const fiat =
        lastFiatRef.current !== NATIVE_TOKEN_CURRENCY && isDisplayCurrency(lastFiatRef.current)
          ? lastFiatRef.current
          : DEFAULT_CURRENCY
      setCurrency(fiat)
      return
    }
    setCurrency(NATIVE_TOKEN_CURRENCY)
  }, [currency, setCurrency])

  const convertPrice = useCallback(
    (amount: number, from: StoreCurrency, to: StoreCurrency): number => {
      const fromCode = resolveStorePriceCurrency(from)
      const toCode = resolveStorePriceCurrency(to)

      if (typeof amount !== 'number' || Number.isNaN(amount)) {
        throw new Error('[convertPrice] Amount must be a number')
      }
      if (fromCode === toCode) return amount

      const fromRate = EXCHANGE_RATES[fromCode]
      const toRate = EXCHANGE_RATES[toCode]
      if (typeof fromRate !== 'number' || typeof toRate !== 'number') {
        // Should be unreachable after resolveStorePriceCurrency — soft-fail for cart safety.
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[convertPrice] Exchange rate missing: from=${fromCode}, to=${toCode}`)
        }
        return amount
      }

      const baseAmount = amount / fromRate
      const result = baseAmount * toRate
      if (!(result >= 0)) {
        throw new Error(`[convertPrice] Computed result invalid: ${result}`)
      }
      return result
    },
    [],
  )

  const formatPrice = useCallback((amount: number, currencyArg: StoreCurrency): string => {
    const locale = (typeof window !== 'undefined' && navigator.language) || 'en'
    const code = currencyArg || DEFAULT_CURRENCY
    const symbol = CURRENCY_SYMBOLS[code] || code

    // Native / non-ISO codes — avoid Intl currency style throwing.
    if (code === NATIVE_TOKEN_CURRENCY || !/^[A-Z]{3}$/.test(code)) {
      const digits = Math.abs(amount) < 1e-2 || Math.abs(amount) > 1e6 ? 8 : 2
      return `${amount.toFixed(digits)} ${symbol === code ? code : symbol}`
    }

    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: code,
        currencyDisplay: 'symbol',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount)
    } catch {
      return `${symbol}${amount.toFixed(2)}`
    }
  }, [])

  const displayPrice = useCallback(
    (amount: number, fromCurrency: StoreCurrency = DEFAULT_CURRENCY): string => {
      const from = fromCurrency || DEFAULT_CURRENCY
      if (!mounted) {
        return formatPrice(amount, DEFAULT_CURRENCY)
      }
      const price = convertPrice(amount, from, currency)
      return formatPrice(price, currency)
    },
    [convertPrice, formatPrice, currency, mounted],
  )

  const equivalentCurrency: StoreCurrency =
    currency === NATIVE_TOKEN_CURRENCY ? DEFAULT_CURRENCY : NATIVE_TOKEN_CURRENCY

  const value: StoreCurrencyContextType = {
    currency,
    setCurrency,
    toggleCurrency,
    formatPrice,
    convertPrice,
    displayPrice,
    equivalentCurrency,
    defaultCurrency: DEFAULT_CURRENCY,
    nativeTokenCurrency: NATIVE_TOKEN_CURRENCY,
    displayCurrencies: DISPLAY_CURRENCIES,
  }

  return (
    <StoreCurrencyContext.Provider value={value}>{children}</StoreCurrencyContext.Provider>
  )
}

export function useStoreCurrency(): StoreCurrencyContextType {
  const ctx = useContext(StoreCurrencyContext)
  if (!ctx) throw new Error('useStoreCurrency must be used within StoreCurrencyProvider')
  return ctx
}

export function useOptionalStoreCurrency(): StoreCurrencyContextType | null {
  return useContext(StoreCurrencyContext)
}

export function useDisplayPrice(amount: number, fromCurrency?: StoreCurrency): string {
  const currencyContext = useOptionalStoreCurrency()
  const [mounted, setMounted] = React.useState(typeof window === 'undefined' ? false : true)
  React.useEffect(() => {
    setMounted(true)
  }, [])
  const display = React.useMemo(
    () =>
      currencyContext
        ? currencyContext.displayPrice(amount, fromCurrency)
        : `${amount.toFixed(2)}`,
    [amount, currencyContext, fromCurrency],
  )
  return mounted ? display : `${amount.toFixed(2)}`
}
