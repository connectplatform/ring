'use client'

/**
 * Client-safe fiat credit currency code (from public env; mirrors PAYMENT_FIAT_CURRENCY).
 * Set both in env.local.template: PAYMENT_FIAT_CURRENCY and NEXT_PUBLIC_PAYMENT_FIAT_CURRENCY.
 */
export function getClientCreditCurrencyCode(): string {
  return (
    process.env.NEXT_PUBLIC_PAYMENT_FIAT_CURRENCY?.toUpperCase().trim() ||
    'USD'
  )
}

export function formatClientCreditAmount(amount: string | number, currency?: string): string {
  const code = currency ?? getClientCreditCurrencyCode()
  const value = typeof amount === 'number' ? amount.toFixed(2) : amount
  return `${value} ${code}`
}
