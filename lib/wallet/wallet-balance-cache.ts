import 'server-only'

/**
 * wallet-balance-cache.ts — DB read-through cache for per-wallet on-chain balances.
 *
 * Architecture:
 *   1. Every Wallet carries `balance` (string) + `balanceUpdatedAt` (ms timestamp).
 *   2. On read, check TTL: within TTL → return DB-cached value (no chain call).
 *   3. Outside TTL → fetch on-chain, write `balance` + `balanceUpdatedAt` to DB,
 *      return fresh value.
 *   4. `refreshWalletBalance()` bypasses TTL — used by user-triggered "Refresh" button.
 *
 * TTL default: 60 000 ms (60 s) — matches the User Story specification.
 * Configurable via WALLET_BALANCE_CACHE_TTL_MS env var for ops flexibility.
 */

import type { Wallet } from '@/features/auth/types'
import type { WalletChain } from '@/features/wallet/types'
import {
  getUserWallets,
  setUserWallets,
  getWalletForChain,
} from '@/lib/wallet/user-wallet-db'
import { getEvmTokenBalance } from '@/features/wallet/chains/evm/evm-token-transfer'
import { getNativeTokenBalance } from '@/features/wallet/chains/solana/native-token-transfer'
import { logger } from '@/lib/logger'

// ─────────────────────────────────────────────────────────────────────────────
// TTL resolution
// ─────────────────────────────────────────────────────────────────────────────

function cacheTtlMs(): number {
  const env = process.env.WALLET_BALANCE_CACHE_TTL_MS
  if (env) {
    const parsed = parseInt(env, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return 60_000 // 60 seconds default
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-chain on-chain fetchers (resolved by wallet.chain)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchFromChain(wallet: Wallet): Promise<string> {
  const chain = wallet.chain as string
  switch (chain) {
    case 'solana':
      return getNativeTokenBalance(wallet.address)
    case 'evm':
    case 'base':
      return getEvmTokenBalance(wallet.address)
    default:
      throw new Error(`Unsupported chain "${chain}" for balance fetch`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache freshness check
// ─────────────────────────────────────────────────────────────────────────────

function isStale(wallet: Wallet): boolean {
  if (!wallet.balanceUpdatedAt) return true
  return Date.now() - wallet.balanceUpdatedAt > cacheTtlMs()
}

// ─────────────────────────────────────────────────────────────────────────────
// Core: fetch balance for ONE wallet with DB read-through
// ─────────────────────────────────────────────────────────────────────────────

export interface BalanceCacheResult {
  /** Fresh or cached balance (formatted string). */
  balance: string
  /** Whether the value came from cache (no chain call). */
  fromCache: boolean
}

/**
 * Fetch the on-chain balance for a user's wallet with DB read-through caching.
 *
 * If within TTL: returns DB-cached `wallet.balance` — zero on-chain provider calls.
 * If outside TTL or uncached: fetches on-chain, writes back to DB, returns fresh.
 *
 * NOTE: When called for multiple wallets concurrently, use getCachedBalancesForUser()
 * to avoid JSONB read-modify-write races. This single-wallet variant does its own
 * read+write and is safe for one-at-a-time callers.
 */
export async function getCachedWalletBalance(
  userId: string,
  wallet: Wallet,
): Promise<BalanceCacheResult> {
  if (!isStale(wallet)) {
    return { balance: wallet.balance || '0', fromCache: true }
  }

  try {
    const fresh = await fetchFromChain(wallet)

    // Atomic single-wallet update: read entire wallets array, replace entry, write back.
    const wallets = await getUserWallets(userId)
    const idx = wallets.findIndex(
      (w) => (w.chain ?? 'evm') === (wallet.chain ?? 'evm') && w.address === wallet.address,
    )
    if (idx >= 0) {
      wallets[idx] = { ...wallets[idx], balance: fresh, balanceUpdatedAt: Date.now() }
      await setUserWallets(userId, wallets)
    }

    return { balance: fresh, fromCache: false }
  } catch (error) {
    logger.error('Failed to fetch on-chain wallet balance — returning stale/zero', {
      userId, address: wallet.address, chain: wallet.chain, error,
    })
    return { balance: wallet.balance || '0', fromCache: true }
  }
}

/**
 * Force-refresh a wallet's balance (bypass TTL). Used by the user "Refresh" button.
 * Always fetches on-chain and writes back to DB.
 */
export async function refreshWalletBalance(
  userId: string,
  wallet: Wallet,
): Promise<BalanceCacheResult> {
  try {
    const fresh = await fetchFromChain(wallet)
    const updated: Wallet = {
      ...wallet,
      balance: fresh,
      balanceUpdatedAt: Date.now(),
    }
    const wallets = await getUserWallets(userId)
    const idx = wallets.findIndex(
      (w) => (w.chain ?? 'evm') === (wallet.chain ?? 'evm') && w.address === wallet.address,
    )
    if (idx >= 0) {
      wallets[idx] = updated
      await setUserWallets(userId, wallets)
    }
    return { balance: fresh, fromCache: false }
  } catch (error) {
    logger.error('Failed to refresh wallet balance', {
      userId,
      address: wallet.address,
      chain: wallet.chain,
      error,
    })
    return { balance: wallet.balance || '0', fromCache: true }
  }
}

/**
 * Fetch cached balances for ALL wallets of a user.
 *
 * Reads the user's wallets array ONCE, computes all stale balances in parallel,
 * then writes back ONCE — eliminates JSONB read-modify-write races that would
 * occur when per-wallet getCachedWalletBalance() is called concurrently.
 */
export async function getCachedBalancesForUser(
  userId: string,
): Promise<Map<string, BalanceCacheResult>> {
  const wallets = await getUserWallets(userId)
  const results = new Map<string, BalanceCacheResult>()
  let dirty = false

  // Fetch all stale balances in parallel (chain RPC calls are independent)
  const fetched = await Promise.all(
    wallets.map(async (wallet) => {
      if (!isStale(wallet)) {
        return { wallet, fresh: null }
      }
      try {
        const fresh = await fetchFromChain(wallet)
        return { wallet, fresh }
      } catch {
        return { wallet, fresh: null }
      }
    }),
  )

  // Apply fetched balances to the wallets array (in memory only for now)
  for (const { wallet, fresh } of fetched) {
    if (fresh !== null) {
      const idx = wallets.findIndex(
        (w) => (w.chain ?? 'evm') === (wallet.chain ?? 'evm') && w.address === wallet.address,
      )
      if (idx >= 0) {
        wallets[idx] = { ...wallets[idx], balance: fresh, balanceUpdatedAt: Date.now() }
        results.set(wallet.address, { balance: fresh, fromCache: false })
        dirty = true
      } else {
        results.set(wallet.address, { balance: wallet.balance || '0', fromCache: true })
      }
    } else {
      results.set(wallet.address, { balance: wallet.balance || '0', fromCache: true })
    }
  }

  // Single atomic write — no race
  if (dirty) {
    await setUserWallets(userId, wallets)
  }

  return results
}

/**
 * Force-refresh balances for ALL user wallets (bypass TTL).
 * Reads wallets once, fetches all on-chain, writes once. Race-free.
 * Used by the Refresh button path.
 */
export async function refreshBalancesForUser(
  userId: string,
): Promise<Map<string, BalanceCacheResult>> {
  const wallets = await getUserWallets(userId)
  const results = new Map<string, BalanceCacheResult>()
  let dirty = false

  const fetched = await Promise.all(
    wallets.map(async (wallet) => {
      try {
        const fresh = await fetchFromChain(wallet)
        return { wallet, fresh, ok: true as const }
      } catch (error) {
        logger.error('refreshBalancesForUser: chain fetch failed', {
          userId, address: wallet.address, chain: wallet.chain, error,
        })
        return { wallet, fresh: null, ok: false as const }
      }
    }),
  )

  for (const { wallet, fresh, ok } of fetched) {
    if (ok && fresh !== null) {
      const idx = wallets.findIndex(
        (w) => (w.chain ?? 'evm') === (wallet.chain ?? 'evm') && w.address === wallet.address,
      )
      if (idx >= 0) {
        wallets[idx] = { ...wallets[idx], balance: fresh, balanceUpdatedAt: Date.now() }
        results.set(wallet.address, { balance: fresh, fromCache: false })
        dirty = true
      } else {
        results.set(wallet.address, { balance: wallet.balance || '0', fromCache: true })
      }
    } else {
      results.set(wallet.address, { balance: wallet.balance || '0', fromCache: true })
    }
  }

  if (dirty) {
    await setUserWallets(userId, wallets)
    const { publishWalletListUpdate } = await import('@/lib/wallet/publish-wallet-list')
    await publishWalletListUpdate(userId, 'refreshed')
  }

  return results
}
