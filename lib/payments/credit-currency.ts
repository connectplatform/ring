import { getFiatCurrency } from '@/lib/payments/payment.config'

/** Server-side label for project fiat credit balance (not on-chain RING). */
export function getCreditCurrencyCode(): string {
  return getFiatCurrency()
}

/** Display string e.g. "USD credit" for API messages. */
export function formatCreditAmount(amount: string | number, currency?: string): string {
  const code = currency ?? getFiatCurrency()
  const value = typeof amount === 'number' ? amount.toFixed(2) : amount
  return `${value} ${code}`
}
