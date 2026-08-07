/** Client-side mirror of WALLET_BALANCE_CACHE_TTL_MS default (60s). */
export const WALLET_BALANCE_CACHE_TTL_MS = 60_000

export function isWalletBalanceStale(balanceUpdatedAt?: number): boolean {
  if (!balanceUpdatedAt) return true
  return Date.now() - balanceUpdatedAt > WALLET_BALANCE_CACHE_TTL_MS
}

export function formatNativeBalance(value?: string | number): string {
  const n = typeof value === 'number' ? value : parseFloat(value || '0')
  if (Number.isNaN(n)) return '0.00'
  return n.toFixed(2)
}
