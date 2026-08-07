import type { CreditTransaction } from '@/lib/zod/credit-schemas'
import {
  getClientCreditUnitLabel,
  getClientNativeTokenSymbol,
} from '@/lib/ring-config-client'

const POISONED_SYMBOLS = new Set(['solana', 'evm', 'base', 'ethereum', 'polygon', 'pol'])

function sanitizeSymbol(value?: string | null): string | null {
  if (!value) return null
  if (value.startsWith('Undefined')) return null
  if (POISONED_SYMBOLS.has(value.toLowerCase())) return null
  return value
}

export function isCreditDebit(tx: CreditTransaction): boolean {
  if (tx.metadata?.direction === 'out') return true
  if (tx.metadata?.direction === 'in') return false
  return tx.amount.startsWith('-') || parseFloat(tx.amount) < 0
}

export function formatCreditAmount(tx: CreditTransaction): string {
  const raw = tx.amount.replace(/^-/, '')
  const num = parseFloat(raw)
  const source = tx.metadata?.source
  const kind = String(tx.type)
  const isCreditLedger =
    source === 'credit' ||
    [
      'payment',
      'purchase',
      'membership_fee',
      'penalty',
      'desk_buy',
      'desk_sell',
      'desk_refund',
      'top_up',
      'credit_topup',
      'bonus',
      'reward_credit_add',
      'reimbursement',
      'refund',
    ].includes(kind)

  const currency =
    sanitizeSymbol(typeof tx.metadata?.currency === 'string' ? tx.metadata.currency : null) ||
    sanitizeSymbol(
      typeof tx.metadata?.tokenSymbol === 'string' ? tx.metadata.tokenSymbol : null,
    ) ||
    (isCreditLedger
      ? (typeof tx.metadata?.creditBalanceUnit === 'string' && tx.metadata.creditBalanceUnit) ||
        getClientCreditUnitLabel()
      : getClientNativeTokenSymbol())
  if (Number.isNaN(num)) return `${tx.amount} ${currency}`
  const prefix = isCreditDebit(tx) ? '-' : '+'
  return `${prefix}${num.toFixed(2)} ${currency}`
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
