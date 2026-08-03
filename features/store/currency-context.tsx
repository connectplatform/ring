'use client'

/**
 * Store display currency SSOT.
 * - Base/list prices: store.mainCurrency (via getMainCurrencySymbol)
 * - Rail toggle: preferred fiat (SupportedCurrencies) ↔ native token
 * - Rates: live FX via getLiveExchangeRates → convertViaRates; fallback convertTo/FromMainCurrency (ring-config + overlay)
 * PaymentConductor is checkout/PSP orchestration — not used for catalog price display.
 *
 * Type: StorePaymentMethods = SupportedCurrencies | SupportedCrypto (features/store/types).
 * Distinct from PaymentRail (card | paypal | credit_balance | native_token).
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { SupportedCurrencies } from '@/lib/ring-config-types'
import type { StorePaymentMethods } from '@/features/store/types'
import {
  getMainCurrencySymbol,
  getExchangeRates,
  getNativeTokenSymbol,
  getSupportedCurrencies,
  convertToMainCurrency,
  convertFromMainCurrency,
} from '@/lib/ring-config-core'

export type { StorePaymentMethods }

export const MAIN_CURRENCY: StorePaymentMethods = getMainCurrencySymbol()
export const NATIVE_TOKEN: StorePaymentMethods = getNativeTokenSymbol()

/** Fiat presentment/display pool — typed as SupportedCurrencies, not the wider union. */
const FIAT_CURRENCIES: SupportedCurrencies[] = getSupportedCurrencies()

/**
 * Resolve a product/list currency code to one that exists in exchangeRates.
 * Unknown or empty codes fall back to the main currency.
 */
export function resolveStorePriceCurrency(
  code?: string | null,
): StorePaymentMethods {
  const raw = (code || '').trim().toUpperCase()
  if (!raw) return MAIN_CURRENCY
  const rates = getExchangeRates()
  if (typeof rates[raw] === 'number') return raw as StorePaymentMethods
  return MAIN_CURRENCY
}

/**
 * Currencies the rail may display: all supported fiats + native token.
 * Fiat codes are always listed (presentment pool); conversion soft-falls back
 * when a live feed rate is not yet on the client static exchangeRates table.
 */
function buildDisplayCurrencies(): StorePaymentMethods[] {
  const rates = getExchangeRates()
  const ordered: StorePaymentMethods[] = []
  const push = (code: StorePaymentMethods, requireRate: boolean) => {
    if (!code || ordered.includes(code)) return
    if (requireRate && typeof rates[code] !== 'number') return
    ordered.push(code)
  }
  push(MAIN_CURRENCY, false)
  for (const c of FIAT_CURRENCIES) push(c, false)
  push(NATIVE_TOKEN, true)
  if (ordered.length === 0) ordered.push(MAIN_CURRENCY)
  return ordered
}

const DISPLAY_CURRENCIES: StorePaymentMethods[] = buildDisplayCurrencies()

function isDisplayCurrency(code: string | null | undefined): code is StorePaymentMethods {
  return Boolean(code && DISPLAY_CURRENCIES.includes(code as StorePaymentMethods))
}

interface StorePaymentMethodsContextType {
  currency: StorePaymentMethods
  setCurrency: (currency: StorePaymentMethods) => void
  /** Toggle between current fiat preference and native token (or cycle fiats when already on token). */
  toggleCurrency: () => void
  convertPrice: (amount: number, from: StorePaymentMethods, to: StorePaymentMethods) => number
  formatPrice: (amount: number, currency: StorePaymentMethods) => string
  displayPrice: (amount: number, fromCurrency?: StorePaymentMethods) => string
  /** Secondary reference currency for ≈ row (native ↔ default fiat). */
  equivalentCurrency: StorePaymentMethods
  mainCurrency: StorePaymentMethods
  nativeTokenCurrency: StorePaymentMethods
  displayCurrencies: StorePaymentMethods[]
}

const StorePaymentMethodsContext = createContext<StorePaymentMethodsContextType | null>(null)

/**
 * Client-side convert mirroring ring-config-core convertTo/FromMainCurrency,
 * using a hydrated rate table (live FX feed + static + manual from ring-oracle).
 */
function convertViaRates(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>,
  main: string,
): number {
  if (!Number.isFinite(amount)) return 0
  const fromCode = (from || main).trim().toUpperCase()
  const toCode = (to || main).trim().toUpperCase()
  if (fromCode === toCode) return amount

  const mainRate = rates[main]
  const fromRate = rates[fromCode]
  const toRate = rates[toCode]
  if (
    typeof mainRate !== 'number' ||
    mainRate <= 0 ||
    typeof fromRate !== 'number' ||
    fromRate <= 0
  ) {
    return amount
  }
  const inMain = fromCode === main ? amount : (amount * mainRate) / fromRate
  if (toCode === main) return inMain
  if (typeof toRate !== 'number' || toRate <= 0) return inMain
  return (inMain * toRate) / mainRate
}

export function StorePaymentMethodsProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<StorePaymentMethods>(MAIN_CURRENCY)
  const [mounted, setMounted] = useState(false)
  /** Live FX table from ring-oracle (server action); null until hydrated. */
  const [liveRates, setLiveRates] = useState<Record<string, number> | null>(null)
  /** Last selected fiat — used so rail toggle returns to user preference, not always default. */
  const lastFiatRef = React.useRef<StorePaymentMethods>(MAIN_CURRENCY)

  useEffect(() => {
    setMounted(true)
    if (typeof window === 'undefined') return

    let cancelled = false

    const hydrate = async () => {
      const savedCurrency = localStorage.getItem('ring-currency')
      const cookieCurrency = document.cookie
        .split('; ')
        .find((row) => row.startsWith('ring-currency='))
        ?.split('=')[1]

      let preferred: StorePaymentMethods = MAIN_CURRENCY

      // Server preference wins when the user is signed in.
      try {
        const { getUserStorePreferences } = await import(
          '@/app/_actions/store-preferences-actions'
        )
        const prefs = await getUserStorePreferences()
        const serverCurrency = prefs?.preferredDisplayCurrency
        if (serverCurrency && isDisplayCurrency(serverCurrency)) {
          preferred = serverCurrency
        } else if (isDisplayCurrency(cookieCurrency)) {
          preferred = cookieCurrency
        } else if (isDisplayCurrency(savedCurrency)) {
          preferred = savedCurrency
        }
      } catch {
        if (isDisplayCurrency(cookieCurrency)) preferred = cookieCurrency
        else if (isDisplayCurrency(savedCurrency)) preferred = savedCurrency
      }

      // Live FX via ring-oracle SSOT — matches server checkout convert*.
      try {
        const { getLiveExchangeRates } = await import('@/app/_actions/fx-rates-actions')
        const live = await getLiveExchangeRates()
        if (!cancelled && live?.rates && typeof live.rates === 'object') {
          setLiveRates(live.rates)
        }
      } catch {
        /* static exchangeRates still apply */
      }

      if (cancelled) return
      if (preferred !== NATIVE_TOKEN) {
        lastFiatRef.current = preferred
      }
      setCurrencyState(preferred)
    }

    void hydrate()
    return () => {
      cancelled = true
    }
  }, [])

  const persistCurrencyPreference = (newCurrency: StorePaymentMethods) => {
    if (typeof window === 'undefined') return
    localStorage.setItem('ring-currency', newCurrency)
    document.cookie = `ring-currency=${newCurrency}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
  }

  const setCurrency = useCallback((newCurrency: StorePaymentMethods) => {
    if (!isDisplayCurrency(newCurrency)) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[StorePaymentMethods] Unsupported currency "${newCurrency}"`)
      }
      return
    }
    if (newCurrency !== NATIVE_TOKEN) {
      lastFiatRef.current = newCurrency
    }
    setCurrencyState(newCurrency)
    persistCurrencyPreference(newCurrency)

    // Persist fiat preference to the user profile when signed in.
    if (newCurrency !== NATIVE_TOKEN) {
      void import('@/app/_actions/store-preferences-actions')
        .then(({ updateDisplayCurrencyPreference }) =>
          updateDisplayCurrencyPreference(newCurrency as SupportedCurrencies),
        )
        .catch(() => {
          /* cookie/localStorage already written */
        })
    }
  }, [])

  const toggleCurrency = useCallback(() => {
    // Binary toggle: fiat preference ↔ native token (matches left-rail UX).
    if (currency === NATIVE_TOKEN) {
      const fiat =
        lastFiatRef.current !== NATIVE_TOKEN && isDisplayCurrency(lastFiatRef.current)
          ? lastFiatRef.current
          : MAIN_CURRENCY
      setCurrency(fiat)
      return
    }
    setCurrency(NATIVE_TOKEN)
  }, [currency, setCurrency])

  /**
   * Convert via main-currency bridge — same SSOT path as server convertTo/FromMainCurrency.
   * Prefer liveRates from ring-oracle when hydrated; else static convert*.
   */
  const convertPrice = useCallback(
    (amount: number, from: StorePaymentMethods, to: StorePaymentMethods): number => {
      if (typeof amount !== 'number' || Number.isNaN(amount)) {
        throw new Error('[convertPrice] Amount must be a number')
      }
      const fromCode = resolveStorePriceCurrency(from)
      const toCode = resolveStorePriceCurrency(to)
      if (fromCode === toCode) return amount

      const result = liveRates
        ? convertViaRates(amount, fromCode, toCode, liveRates, MAIN_CURRENCY)
        : convertFromMainCurrency(convertToMainCurrency(amount, fromCode), toCode)
      if (!(result >= 0) || !Number.isFinite(result)) {
        throw new Error(`[convertPrice] Computed result invalid: ${result}`)
      }
      return result
    },
    [liveRates],
  )

  const formatPrice = useCallback((amount: number, currencyArg: StorePaymentMethods): string => {
    const locale = (typeof window !== 'undefined' && navigator.language) || 'en'
    const code = currencyArg || MAIN_CURRENCY

    // Native token / non-ISO codes — Intl currency style would throw on these.
    if (code === NATIVE_TOKEN || !/^[A-Z]{3}$/.test(code)) {
      const digits = Math.abs(amount) < 1e-2 || Math.abs(amount) > 1e6 ? 8 : 2
      return `${amount.toFixed(digits)} ${code}`
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
      return `${amount.toFixed(2)} ${code}`
    }
  }, [])

  const displayPrice = useCallback(
    (amount: number, fromCurrency: StorePaymentMethods = MAIN_CURRENCY): string => {
      const from = fromCurrency || MAIN_CURRENCY
      if (!mounted) {
        return formatPrice(amount, MAIN_CURRENCY)
      }
      const price = convertPrice(amount, from, currency)
      return formatPrice(price, currency)
    },
    [convertPrice, formatPrice, currency, mounted],
  )

  const equivalentCurrency: StorePaymentMethods =
    currency === NATIVE_TOKEN ? MAIN_CURRENCY : NATIVE_TOKEN

  const value: StorePaymentMethodsContextType = {
    currency,
    setCurrency,
    toggleCurrency,
    formatPrice,
    convertPrice,
    displayPrice,
    equivalentCurrency,
    mainCurrency: MAIN_CURRENCY,
    nativeTokenCurrency: NATIVE_TOKEN,
    displayCurrencies: DISPLAY_CURRENCIES,
  }

  return (
    <StorePaymentMethodsContext.Provider value={value}>{children}</StorePaymentMethodsContext.Provider>
  )
}

export function useStorePaymentMethods(): StorePaymentMethodsContextType {
  const ctx = useContext(StorePaymentMethodsContext)
  if (!ctx) throw new Error('useStorePaymentMethods must be used within StorePaymentMethodsProvider')
  return ctx
}

export function useOptionalStorePaymentMethods(): StorePaymentMethodsContextType | null {
  return useContext(StorePaymentMethodsContext)
}

export function useDisplayPrice(amount: number, fromCurrency?: StorePaymentMethods): string {
  const currencyContext = useOptionalStorePaymentMethods()
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
