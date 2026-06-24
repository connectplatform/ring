import 'server-only'

import { cache } from 'react'
import bs58 from 'bs58'
import type { Wallet } from '@/features/auth/types'
import { db } from '@/lib/database'
import type { WalletChain } from '@/features/wallet/services/utils'
import { selectDefaultWallet } from '@/features/wallet/services/utils'

type UserWalletRow = {
  wallets?: Wallet[]
}

export async function getUserWallets(userId: string): Promise<Wallet[]> {
  const result = await db().findDocById<UserWalletRow>('users', userId)
  if (!result.success || !result.data?.wallets) {
    return []
  }
  return result.data.wallets
}

export const getUserWalletsCached = cache(getUserWallets)

export async function setUserWallets(userId: string, wallets: Wallet[]): Promise<void> {
  const result = await db().updateDoc('users', userId, { wallets })
  if (!result.success) {
    throw new Error(result.error?.message ?? 'Failed to persist user wallets')
  }
}

export async function upsertUserWallet(userId: string, wallet: Wallet): Promise<void> {
  const wallets = await getUserWallets(userId)
  const index = wallets.findIndex(
    (w) => (w.chain ?? 'evm') === (wallet.chain ?? 'evm') && w.address === wallet.address,
  )

  if (index >= 0) {
    wallets[index] = { ...wallets[index], ...wallet }
  } else {
    wallets.push(wallet)
  }

  await setUserWallets(userId, wallets)
}

/**
 * Append wallet for chain if missing. Idempotent per (userId, chain).
 */
export async function appendWalletIfMissing(userId: string, wallet: Wallet): Promise<Wallet[]> {
  const wallets = await getUserWallets(userId)
  const chain = wallet.chain ?? 'evm'
  const exists = wallets.some((w) => (w.chain ?? 'evm') === chain)

  if (exists) {
    return wallets
  }

  const updated = [...wallets, wallet]
  await setUserWallets(userId, updated)
  return updated
}

export async function getWalletForChain(
  userId: string,
  chain: WalletChain,
): Promise<Wallet | null> {
  const wallets = await getUserWallets(userId)
  return selectDefaultWallet(wallets, chain)
}

export async function getNativeWallet(userId: string, nativeChain: WalletChain): Promise<Wallet | null> {
  return getWalletForChain(userId, nativeChain)
}
