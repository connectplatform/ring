'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, use } from 'react'

export type Currency = 'UAH' | 'DAAR'

interface CurrencyContextType {
  currency: Currency
  setCurrency: (currency: Currency) => void
  toggleCurrency: () => void
  convertPrice: (priceUAH: number) => number
  formatPrice: (price: number) => string
}

const CurrencyContext = createContext<CurrencyContextType | null>(null)

// Exchange rates - DAAR is pegged to sustainable agriculture value
const EXCHANGE_RATES = {
  UAH: 1,
  DAAR: 0.025 // 1 DAAR = 40 UAH (1 UAH = 0.025 DAAR)
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>('UAH')
  const [mounted, setMounted] = useState(false)

  // Load currency preference on mount
  useEffect(() => {
    setMounted(true)
    if (typeof window !== 'undefined') {
      const savedCurrency = localStorage.getItem('ring-currency') as Currency | null
      const cookieCurrency = document.cookie
        .split('; ')
        .find(row => row.startsWith('ring-currency='))
        ?.split('=')[1] as Currency | undefined
      
      const preferredCurrency = cookieCurrency || savedCurrency || 'UAH'
      if (preferredCurrency === 'UAH' || preferredCurrency === 'DAAR') {
        setCurrencyState(preferredCurrency)
      }
    }
  }, [])

  const setCurrency = useCallback((newCurrency: Currency) => {
    setCurrencyState(newCurrency)
    if (typeof window !== 'undefined') {
      localStorage.setItem('ring-currency', newCurrency)
      document.cookie = `ring-currency=${newCurrency}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
    }
  }, [])

  const toggleCurrency = useCallback(() => {
    const newCurrency = currency === 'UAH' ? 'DAAR' : 'UAH'
    setCurrency(newCurrency)
  }, [currency, setCurrency])

  // Convert price from UAH to current currency
  const convertPrice = useCallback((priceUAH: number): number => {
    if (currency === 'UAH') return priceUAH
    return priceUAH * EXCHANGE_RATES.DAAR
  }, [currency])

  // Format price with currency symbol
  const formatPrice = useCallback((price: number): string => {
    if (currency === 'UAH') {
      return `${price.toFixed(2)} ₴`
    }
    return `${price.toFixed(2)} DAAR`
  }, [currency])

  const value: CurrencyContextType = {
    currency,
    setCurrency,
    toggleCurrency,
    convertPrice,
    formatPrice
  }

  return (
    <CurrencyContext value={value}>
      {children}
    </CurrencyContext>
  )
}

export function useCurrency(): CurrencyContextType {
  const ctx = use(CurrencyContext)
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider')
  return ctx
}

export function useOptionalCurrency(): CurrencyContextType | null {
  return use(CurrencyContext)
}

