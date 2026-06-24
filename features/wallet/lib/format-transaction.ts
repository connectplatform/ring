import type { CreditTransaction } from '@/lib/zod/credit-schemas'

export function isCreditDebit(tx: CreditTransaction): boolean {
  return tx.amount.startsWith('-') || parseFloat(tx.amount) < 0
}

export function formatCreditAmount(tx: CreditTransaction): string {
  const raw = tx.amount.replace(/^-/, '')
  const num = parseFloat(raw)
  if (Number.isNaN(num)) return `${tx.amount} RING`
  const prefix = isCreditDebit(tx) ? '-' : '+'
  return `${prefix}${num.toFixed(2)} RING`
}

export function formatRelativeTime(timestamp: number, locale = 'en'): string {
  const diffMs = timestamp - Date.now()
  const diffSec = Math.round(diffMs / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  const absSec = Math.abs(diffSec)
  if (absSec < 60) return rtf.format(diffSec, 'second')
  const diffMin = Math.round(diffSec / 60)
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute')
  const diffHour = Math.round(diffMin / 60)
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, 'hour')
  const diffDay = Math.round(diffHour / 24)
  if (Math.abs(diffDay) < 30) return rtf.format(diffDay, 'day')
  const diffMonth = Math.round(diffDay / 30)
  return rtf.format(diffMonth, 'month')
}
