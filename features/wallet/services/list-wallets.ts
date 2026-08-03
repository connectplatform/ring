import 'server-only'

import { auth } from '@/auth'
import { selectDefaultWallet } from '@/features/wallet/services/utils'
import { getUserWallets } from '@/lib/wallet/user-wallet-db'
import { getCachedBalancesForUser } from '@/lib/wallet/wallet-balance-cache'
import { getNativeTokenSymbol, SupportedChains } from '@/lib/ring-config-chain'
import { DEFAULT_WALLET_CHAIN } from '@/features/wallet/types/wallet'
import { getMainCurrencySymbol } from '@/lib/ring-config-core'
import { toIsoDate } from '@/lib/serialization/to-iso-date'
import { logger } from '@/lib/logger'

export interface WalletInfo {
  address: string
  isPrimary: boolean
  label?: string
  createdAt?: string
  /** Cached or freshly-fetched on-chain native token balance (formatted string). */
  balance?: string
  nativeTokenBalance?: string
  tokenSymbol?: string
  mainCurrency?: string
  chain?: SupportedChains
  balanceUpdatedAt?: number
}

/**
 * Lists custodial wallets for the authenticated user from users.wallets[].
 * Uses the DB read-through batch cache (lib/wallet/wallet-balance-cache.ts)
 * to avoid unnecessary on-chain RPC calls — balances within TTL are served
 * from DB. Stale balances are fetched in parallel and persisted atomically
 * (no JSONB read-modify-write race).
 */
export async function listWallets(): Promise<WalletInfo[]> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized: Please log in to list wallets')
  }

  const userId = session.user.id

  // Single call: batch-fetch all stale balances, write once
  const balanceCache = await getCachedBalancesForUser(userId)

  // Re-read wallets after the potential cache write to get latest state
  const wallets = await getUserWallets(userId)

  if (wallets.length === 0) {
    return []
  }

  const defaultWallet = selectDefaultWallet(wallets)
  const tokenSymbol = getNativeTokenSymbol()
  const mainCurrency = getMainCurrencySymbol()

  const walletsInfo = wallets.map((wallet) => {
    const chain = wallet.chain ?? DEFAULT_WALLET_CHAIN
    const cached = balanceCache.get(wallet.address)
    const nativeTokenBalance = cached?.balance ?? wallet.balance ?? '0'

    return {
      address: wallet.address,
      isPrimary: defaultWallet?.address === wallet.address,
      label: wallet.label,
      createdAt: toIsoDate(wallet.createdAt),
      balance: wallet.balance,
      nativeTokenBalance,
      tokenSymbol,
      mainCurrency,
      chain,
      balanceUpdatedAt: wallet.balanceUpdatedAt,
    }
  })

  return walletsInfo
}
