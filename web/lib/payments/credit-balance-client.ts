'use client'

import { getMainCurrencySymbol } from '@/lib/ring-config-core'

/**
 * Client-safe fiat credit currency code.
 * Prefer NEXT_PUBLIC_PAYMENT_MAIN_CURRENCY; else store.mainCurrency from ring-config.
 */
export function getClientCreditCurrencyCode(): string {
  const fromEnv = process.env.NEXT_PUBLIC_PAYMENT_MAIN_CURRENCY?.toUpperCase().trim()
  if (fromEnv) return fromEnv
  return getMainCurrencySymbol()
}

export function formatClientCreditAmount(amount: string | number, currency?: string): string {
  const code = currency ?? getClientCreditCurrencyCode()
  const value = typeof amount === 'number' ? amount.toFixed(2) : amount
  return `${value} ${code}`
}
