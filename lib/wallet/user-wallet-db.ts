import 'server-only'

import { cache } from 'react'
import type { Wallet } from '@/features/auth/types'
import { db } from '@/lib/database'
import type { WalletChain } from '@/features/wallet/types'
import { selectDefaultWallet } from '@/features/wallet/services/utils'
import { DEFAULT_WALLET_CHAIN } from '@/features/wallet/types/wallet'
import {
  encryptWalletSecret,
  isLegacyV1Format,
  reencryptLegacyWallet,
} from '@/lib/wallet/encrypt-wallet-secret'

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
    (w) => (w.chain ?? DEFAULT_WALLET_CHAIN) === (wallet.chain ?? DEFAULT_WALLET_CHAIN) && w.address === wallet.address,
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
 *
 * RACE NOTE: callers should avoid calling this concurrently for the same
 * userId — the ensureWallets() orchestrator serialises provisioning into
 * a single in-memory map and a single setUserWallets() write, so this
 * function is only called from sequential code paths.
 */
export async function appendWalletIfMissing(userId: string, wallet: Wallet): Promise<Wallet[]> {
  const wallets = await getUserWallets(userId)
  const chain = wallet.chain ?? DEFAULT_WALLET_CHAIN
  const exists = wallets.some((w) => (w.chain ?? DEFAULT_WALLET_CHAIN) === chain)

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

// ----------------------------------------------------------------------------
// Phase 1b: PIN migration helpers
// ----------------------------------------------------------------------------

/**
 * Result of a per-user PIN migration attempt.
 */
export interface PinMigrationResult {
  scanned: number
  reencrypted: number
  skipped: number
  failed: number
  errors: Array<{ address: string; chain?: string; reason: string }>
}

/**
 * Re-encrypt every legacy (v1) wallet for a user with the given PIN.
 * Idempotent: v2 wallets are left untouched. Designed to be called from a
 * Server Action after the user sets a PIN.
 *
 * TODO: Wire to a background worker that processes all users in batches
 * (e.g. a one-off migration script + on-demand re-encryption on first
 * PIN-verified withdrawal). Track in AI-CONTEXT under "pin-migration".
 */
export async function migrateUserWalletsToPin(
  userId: string,
  pin: string,
): Promise<PinMigrationResult> {
  const encryptionKey = process.env.WALLET_ENCRYPTION_KEY
  if (!encryptionKey) {
    throw new Error('WALLET_ENCRYPTION_KEY is not configured')
  }
  const wallets = await getUserWallets(userId)
  const result: PinMigrationResult = { scanned: wallets.length, reencrypted: 0, skipped: 0, failed: 0, errors: [] }

  const migrated: Wallet[] = []
  for (const w of wallets) {
    if (!isLegacyV1Format(w.encryptedPrivateKey)) {
      result.skipped++
      migrated.push(w)
      continue
    }
    try {
      const newEnvelope = reencryptLegacyWallet(w.encryptedPrivateKey, encryptionKey, pin)
      migrated.push({ ...w, encryptedPrivateKey: newEnvelope })
      result.reencrypted++
    } catch (err) {
      result.failed++
      result.errors.push({
        address: w.address,
        chain: w.chain,
        reason: err instanceof Error ? err.message : String(err),
      })
      // Preserve the original wallet row (we never delete user data on partial failure)
      migrated.push(w)
    }
  }

  if (result.reencrypted > 0) {
    await setUserWallets(userId, migrated)
  }

  return result
}

/**
 * Provision a brand-new wallet and immediately wrap it with the user's PIN.
 * Used by /wallet/import and future "rotate wallet" flows.
 */
export async function createPinWrappedWallet(
  userId: string,
  chain: WalletChain,
  pin: string,
  secret: string,
  symbol: string,
  label: string,
  isDefault = false,
): Promise<Wallet> {
  const encryptionKey = process.env.WALLET_ENCRYPTION_KEY
  if (!encryptionKey) {
    throw new Error('WALLET_ENCRYPTION_KEY is not configured')
  }
  const wallet: Wallet = {
    symbol,
    chain,
    address: '', // populated by caller post-generate
    encryptedPrivateKey: encryptWalletSecret(secret, encryptionKey, { pin }),
    createdAt: new Date(),
    label,
    isDefault,
    balance: '0',
  }
  await appendWalletIfMissing(userId, wallet)
  return wallet
}
