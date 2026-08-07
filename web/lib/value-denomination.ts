/**
 * Value denomination triad — SSOT for every amount the platform quotes.
 *
 * - `credit_balance` — the core denomination of project-owned value
 *   (`credit.creditBalanceUnitLabel`, default `points`)
 * - `native_token` — the project's own token (`tokens.nativeToken.symbol`)
 * - `main_currency` — the project fiat currency (`store.mainCurrency`)
 *
 * Task budgets, referral rewards, escrow holds and desk quotes all denominate
 * in one of these three. Never introduce a fourth unit or a hardcoded code.
 */
export type ValueDenomination = 'credit_balance' | 'native_token' | 'main_currency'

export const VALUE_DENOMINATIONS: readonly ValueDenomination[] = [
  'credit_balance',
  'native_token',
  'main_currency',
] as const

export function isValueDenomination(value: unknown): value is ValueDenomination {
  return typeof value === 'string' && (VALUE_DENOMINATIONS as readonly string[]).includes(value)
}

/**
 * Validate an untrusted value against the triad, falling back when it is not a
 * denomination. There are deliberately no aliases: the triad is the only
 * vocabulary, so anything else is a caller bug rather than an older spelling.
 */
export function normalizeValueDenomination(
  value: unknown,
  fallback: ValueDenomination = 'main_currency',
): ValueDenomination {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return isValueDenomination(raw) ? raw : fallback
}
