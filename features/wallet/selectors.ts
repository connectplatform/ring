import type { WalletBalances } from './types'

export function selectTotalBalance(balances: WalletBalances | null): string {
  if (!balances) return '0'
  // Domain-specific aggregation can be implemented here if tokens share units
  // For now, return DAAR as canonical balance when present
  return balances.DAAR ?? balances.DAARION ?? balances.USDT ?? '0'
}


