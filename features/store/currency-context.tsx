'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import type { SupportedCrypto, SupportedCurrencies } from '@/lib/ring-config-types'
import { getDefaultStoreCurrencySymbol, getExchangeRates, getSupportedCurrencies, getSupportedCrypto } from '@/lib/ring-config-core'

// --- Types and Basic Exports ---
export type StoreCurrency = SupportedCrypto | SupportedCurrencies

// The DEFAULT_CURRENCY is the "base currency" for exchangeRates mapping (rate == 1).
// SSOT: uses getDefaultStoreCurrencySymbol() which resolves store.defaultCurrency ?? 'USD'.
export const DEFAULT_CURRENCY: StoreCurrency = getDefaultStoreCurrencySymbol() as StoreCurrency

/**
 * All rates in EXCHANGE_RATES are relative to DEFAULT_CURRENCY (e.g., USD: 1, EUR: 1.2 if 1 USD = 1.2 EUR)
 * The symmetry and correctness of rates are not enforced here. Rates must be kept up-to-date in config!
 *
 * EXAMPLE:
 *   DEFAULT_CURRENCY = 'USD'
 *   EXCHANGE_RATES = { USD: 1, EUR: 0.95, BTC: 0.000022 }
 *
 * SSOT: uses getExchangeRates() from ring-config-core (cached, validated).
 */
export const EXCHANGE_RATES: Record<string, number> = getExchangeRates()

// SSOT: uses getSupportedCurrencies() and getSupportedCrypto() from ring-config-core.
const ALL_CURRENCIES: SupportedCurrencies[] = getSupportedCurrencies()
const ALL_TOKENS: SupportedCrypto[] = getSupportedCrypto()
// More strategic currency context shape: price conversion and formatting “from” and “to” any supported currency
interface StoreCurrencyContextType {
  // Currently selected currency
  currency: StoreCurrency;

  // Change the currency (persist and update everywhere)
  setCurrency: (currency: StoreCurrency) => void;

  // Cycle to the next supported currency in list
  toggleCurrency: () => void;

  // Convert price between any two supported currencies
  convertPrice: (amount: number, from: StoreCurrency, to: StoreCurrency) => number;

  // Format price with currency symbol (using given currency)
  formatPrice: (amount: number, currency: StoreCurrency) => string;

  // Helper: convert and then format according to current context currency
  displayPrice: (amount: number) => string;
}

const StoreCurrencyContext = createContext<StoreCurrencyContextType | null>(null)

// --- Helper: A currency symbol map with fallbacks for common codes ---
// Consider expanding this or moving to config if you add more currencies
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
};

// --- SSR/Flicker Awareness ---
// On server: always show DEFAULT_CURRENCY (hydrate-safe default), only update on client after mount.
// We use a hydration flag to skip showing any currency-specific prices until mounted, unless SSR-OK.
export function StoreCurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<StoreCurrency>(DEFAULT_CURRENCY)
  // Indicate if client hydration has occurred
  const [mounted, setMounted] = useState(false)
  // Only read storage/cookie after mount (SSR-safe hydration)
  useEffect(() => {
    setMounted(true)
    if (typeof window !== 'undefined') {
      // 
      // Persistence logic (Read order): cookie > localStorage > default
      // This is important for SSR: cookies can be set server-side, localStorage only client-side.
      //
      const savedCurrency: StoreCurrency | null = localStorage.getItem('ring-currency') as StoreCurrency | null
      const cookieCurrency: StoreCurrency | undefined = document.cookie
        .split('; ')
        .find(row => row.startsWith('ring-currency='))
        ?.split('=')[1] as StoreCurrency | undefined
      
      // Validate found against supported currencies to avoid silent bugs!
      let preferredCurrency: StoreCurrency = DEFAULT_CURRENCY
      if (cookieCurrency && ALL_CURRENCIES.includes(cookieCurrency)) {
        preferredCurrency = cookieCurrency
      } else if (savedCurrency && ALL_CURRENCIES.includes(savedCurrency)) {
        preferredCurrency = savedCurrency
      }
      setCurrencyState(preferredCurrency)
    }
  }, [])

  // Unified persistence setter (cookie + localStorage, can be made pluggable if needed)
  const persistCurrencyPreference = (newCurrency: StoreCurrency) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ring-currency', newCurrency);
      document.cookie = `ring-currency=${newCurrency}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
    }
  }

  // Set currency and persist on client
  const setCurrency = useCallback((newCurrency: StoreCurrency) => {
    if (!ALL_CURRENCIES.includes(newCurrency)) {
      if (process.env.NODE_ENV !== 'production')
        console.error(`[StoreCurrency] Attempt to set unsupported currency "${newCurrency}"`);
      return;
    }
    setCurrencyState(newCurrency)
    persistCurrencyPreference(newCurrency)
  }, [])

  // Cycle through all supported currencies in order (generalized for >2)
  const toggleCurrency = useCallback(() => {
    const idx = ALL_CURRENCIES.indexOf(currency)
    if (idx === -1) {
      setCurrency(ALL_CURRENCIES[0]) // fallback to default if corrupted
      return
    }
    const next = (idx + 1) % ALL_CURRENCIES.length
    setCurrency(ALL_CURRENCIES[next])
  }, [currency, setCurrency])

  // --- Conversion with tests/assertions ---
  // All rates are relative to DEFAULT_CURRENCY, e.g. 
  //   EXCHANGE_RATES = { USD: 1, EUR: 1.1, BTC: 0.000023 }, etc
  const convertPrice = useCallback(
    (amount: number, from: StoreCurrency, to: StoreCurrency): number => {
      if (!ALL_CURRENCIES.includes(from) || !ALL_CURRENCIES.includes(to)) {
        throw new Error(`[convertPrice] Invalid currency: from=${from}, to=${to}`);
      }
      if (typeof amount !== 'number' || isNaN(amount)) {
        throw new Error('[convertPrice] Amount must be a number');
      }
      if (from === to) return amount

      const fromRate = EXCHANGE_RATES[from]
      const toRate = EXCHANGE_RATES[to]

      if (typeof fromRate !== 'number' || typeof toRate !== 'number') {
        throw new Error(`[convertPrice] Exchange rate missing: from=${from}, to=${to}`);
      }

      // Convert any currency to DEFAULT first, then to target
      // (amount in FROM currency -> DEFAULT, then -> TO currency)
      // All rates are relative to DEFAULT_CURRENCY
      //   Example: USD -> EUR where rates are USD:1, EUR:1.1: amount / 1 * 1.1
      const baseAmount = amount / fromRate;
      const result = baseAmount * toRate;

      // Minimal testable assertion for positive rates:
      if (!(result >= 0)) throw new Error(`[convertPrice] Computed result invalid: ${result}`);

      return result
    },
    []
  );

  // --- Format price by currency, using Intl.NumberFormat if available, else fallback ---
  const formatPrice = useCallback(
    (amount: number, currencyArg: StoreCurrency): string => {
      // Detect locale, fallback to 'en'
      const locale = (typeof window !== 'undefined' && navigator.language) || 'en'
      let symbol = CURRENCY_SYMBOLS[currencyArg] || currencyArg

      try {
        // If currency code matches ISO, use native formatting
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: currencyArg,
          currencyDisplay: 'symbol',
          minimumFractionDigits: 2,
          maximumFractionDigits: 8, // For crypto support
        }).format(amount)
      } catch (e) {
        // Fallback for non-standard codes, or e.g. BTC: "₿0.00042" etc
        // Edge formatting for tiny/large values (e.g. BTC/ETH) -- show more decimals
        const digits = (Math.abs(amount) < 1e-2 || Math.abs(amount) > 1e6) ? 8 : 2
        return `${symbol}${amount.toFixed(digits)}`
      }
    }, []
  )

  // Hydration-aware: shows formatted price only after mount to avoid SSR mismatch,
  // else uses default currency as dependency
  const displayPrice = useCallback(
    (amount: number): string => {
      if (!mounted) {
        // Avoid price flash during hydration by using default
        return formatPrice(amount, DEFAULT_CURRENCY)
      }
      // Always uses context currency for both conversion and formatting.
      const fromCurrency: StoreCurrency = DEFAULT_CURRENCY; // defaults for product prices
      const price = convertPrice(amount, fromCurrency, currency);
      return formatPrice(price, currency);
    },
    [convertPrice, formatPrice, currency, mounted]
  );

  const value: StoreCurrencyContextType = {
    currency,
    setCurrency,
    toggleCurrency,
    formatPrice,
    convertPrice,
    displayPrice,
  }

  return (
    <StoreCurrencyContext.Provider value={value}>
      {children}
    </StoreCurrencyContext.Provider>
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

// Returns a display string for an amount in current context currency, SSR-safe (will only localize after mount)
export function useDisplayPrice(amount: number): string {
  const currencyContext = useOptionalStoreCurrency();
  const [mounted, setMounted] = React.useState(typeof window === 'undefined' ? false : true);
  React.useEffect(() => {
    setMounted(true)
  }, []);
  const display = React.useMemo(
    () =>
      currencyContext
        ? currencyContext.displayPrice(amount)
        : `${amount.toFixed(2)}`,
    [amount, currencyContext]
  );
  return mounted ? display : `${amount.toFixed(2)}`;
}

// DEV TESTS removed — conversion roundtrip tests were running at module
// evaluation time. Move to __tests__/features/store/currency-conversion.test.ts
// if needed. See git history for the original test logic.