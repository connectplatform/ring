import type { Wallet } from '@/features/auth/types'
import type { SupportedChains } from '@/lib/ring-config-chain'
import { DEFAULT_WALLET_CHAIN } from '@/features/wallet/types/wallet'

/**
 * Select the user's default wallet.
 *
 * SSOT contract (2026-07-03):
 *   - Wallets lacking a `chain` field are treated as DEFAULT_WALLET_CHAIN ('evm')
 *     — this matches the pre-Solana era when wallets predated the chain field.
 *   - When a chain filter is given, returns the default wallet for that chain.
 *   - When no filter, returns the first wallet marked isDefault, or the first
 *     wallet in the array.
 *
 * React 19: this is a pure server function, no client memoisation needed at
 * this layer. Components that call this in render can wrap in React.cache() at
 * the call site if they need request-scoped memoisation.
 */
export function selectDefaultWallet(
  wallets: Wallet[] | undefined | null,
  chain?: SupportedChains,
): Wallet | null {
  if (!wallets || wallets.length === 0) return null

  // Resolve the filter target: use the given chain, or the SSOT default
  // for legacy chainless rows. Note: when chain is undefined we still
  // want to expose legacy chainless wallets, so we don't filter on chain
  // in that case.
  const target = chain

  const pool = target
    ? wallets.filter((w) => (w.chain ?? DEFAULT_WALLET_CHAIN) === target)
    : wallets

  if (pool.length === 0) return null
  return pool.find((w) => w.isDefault) || pool[0]
}

/**
 * Infer the chain for a given wallet. SSOT default for chainless rows.
 */
export function inferWalletChain(wallet: Wallet): SupportedChains {
  return (wallet.chain ?? DEFAULT_WALLET_CHAIN) as SupportedChains
}
