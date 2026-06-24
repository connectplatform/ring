// ============================================================================
// UNIFIED ensureWallet — config-driven multi-chain orchestrator (Solana native)
// ============================================================================

import { auth } from '@/auth'
import { Wallet } from '@/features/auth/types'
import { UserRole } from '@/features/auth/user-role'
import { getChainAdapter } from '@/features/wallet/chains/registry'
import { getRingChainConfig } from '@/lib/ring-config-chain'
import type { RingNativeChain } from '@/lib/ring-config-types'
import { encryptWalletSecret } from '@/lib/wallet/encrypt-wallet-secret'
import {
  appendWalletIfMissing,
  getUserWallets,
  setUserWallets,
} from '@/lib/wallet/user-wallet-db'
import { selectDefaultWallet } from './utils'

export type EnsureWalletResult = {
  native: Wallet
  wallets: Wallet[]
}

function requireEncryptionKey(): string {
  const encryptionKey = process.env.WALLET_ENCRYPTION_KEY
  if (!encryptionKey) {
    console.error('🚨 CRITICAL: WALLET_ENCRYPTION_KEY is not set in environment variables.')
    throw new Error('Wallet encryption key is not set. Check server logs for setup instructions.')
  }
  return encryptionKey
}

function sortChainsNativeFirst(enabled: RingNativeChain[], native: RingNativeChain): RingNativeChain[] {
  const rest = enabled.filter((c) => c !== native)
  return [native, ...rest]
}

async function provisionChainWallet(
  userId: string,
  chain: RingNativeChain,
  encryptionKey: string,
  isDefault: boolean,
): Promise<Wallet> {
  const adapter = getChainAdapter(chain)
  const generated = await adapter.generate()

  const wallet: Wallet = {
    chain,
    address: generated.address,
    encryptedPrivateKey: encryptWalletSecret(generated.secret, encryptionKey),
    createdAt: new Date().toISOString(),
    label: generated.label,
    isDefault,
    balance: '0',
  }

  await appendWalletIfMissing(userId, wallet)
  return wallet
}

/**
/**
 * Ensures that the authenticated user has at least one wallet for each enabled chain (prioritizing the native chain).
 *
 * For Google/Apple sign-in users, creates and securely stores a wallet for each supported blockchain.
 *
 * CRITICAL SECURITY FLOW:
 * 1. User signs in with Google/Apple (no seed phrase knowledge required).
 * 2. System creates chain wallet(s), encrypts private keys with environment-based encryption (e.g., PIN/PASS).
 * 3. Private keys are stored securely in the database and are never sent to the client.
 * 4. Client uses libraries (e.g., Wagmi) for blockchain operations without exposure to private keys.
 * 5. PIN or environment key allows emergency fund recovery, never exposing actual secret to the client.
 *
 * @returns {Promise<EnsureWalletResult>} A promise that resolves to the user's primary (native) wallet and all provisioned wallets.
 * @throws {Error} If the user is not authenticated, or an error occurs during provisioning.
 */

export async function ensureWallets(
  userOverride?: { id: string; role: string },
): Promise<EnsureWalletResult> {
  console.log('🔐 Services: ensureWallets - Starting unified wallet ensure')

  let userId: string
  let userRole: string

  if (userOverride) {
    userId = userOverride.id
    userRole = userOverride.role
  } else {
    const session = await auth()
    if (!session?.user) {
      throw new Error('Unauthorized: Please log in to ensure wallet')
    }
    userId = session.user.id
    userRole = session.user.role
  }

  if (userRole === UserRole.visitor) {
    throw new Error('Access denied: Visitors cannot have wallets')
  }

  const encryptionKey = requireEncryptionKey()
  const { native, enabled } = getRingChainConfig()
  const nativeChain = native ?? 'solana'
  const chains = sortChainsNativeFirst(enabled ?? [nativeChain], nativeChain)

  let wallets = await getUserWallets(userId)

  for (const chain of chains) {
    const existing = selectDefaultWallet(wallets, chain)
    if (existing) {
      continue
    }

    const isDefault = chain === nativeChain
    const created = await provisionChainWallet(userId, chain, encryptionKey, isDefault)
    wallets = await getUserWallets(userId)
    if (!wallets.some((w) => w.address === created.address)) {
      wallets.push(created)
    }
  }

  // Native chain is sole default
  const normalized = wallets.map((w) => ({
    ...w,
    isDefault: (w.chain ?? 'evm') === nativeChain,
  }))

  if (normalized.some((w, i) => w.isDefault !== (wallets[i]?.isDefault ?? false))) {
    await setUserWallets(userId, normalized)
    wallets = normalized
  }

  const nativeWallet = selectDefaultWallet(wallets, nativeChain)
  if (!nativeWallet) {
    throw new Error(`Failed to provision native ${nativeChain} wallet`)
  }

  try {
    const { initializeOnChain } = await import('@/features/wallet/services/onchain-init')
    if (typeof initializeOnChain === 'function') {
      await initializeOnChain(nativeWallet)
    }
  } catch {
    // optional hook
  }

  console.log(`🔐 Services: ensureWallets - Native wallet: ${nativeWallet.address} (${nativeChain})`)
  return { native: nativeWallet, wallets }
}

/**
 * Single public entry — returns native (Solana-first) wallet for backward compatibility.
 */
export async function ensureWallet(userOverride?: { id: string; role: string }): Promise<Wallet> {
  const result = await ensureWallets(userOverride)
  return result.native
}

/**
 * Decrypts the private key of a wallet using PIN-based authentication (EVM emergency recovery).
 */
export async function decryptPrivateKeyWithPin(encryptedPrivateKey: string, pin: string): Promise<string> {
  console.log('🔐 Services: decryptPrivateKeyWithPin - Starting PIN-based decryption')

  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    throw new Error('PIN must be exactly 4 digits')
  }

  try {
    const encryptionKey = process.env.WALLET_ENCRYPTION_KEY
    if (!encryptionKey) {
      throw new Error('Wallet encryption key is not configured')
    }

    const parts = encryptedPrivateKey.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted private key format')
    }

    const [ivHex, encryptedHex, authTagHex] = parts
    const crypto = await import('crypto')
    const combinedKey = `${encryptionKey}_${pin}`
    const key = crypto.scryptSync(combinedKey, 'salt', 32)

    const iv = Buffer.from(ivHex, 'hex')
    const encrypted = Buffer.from(encryptedHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted, undefined, 'utf8')
    decrypted += decipher.final('utf8')

    if (!decrypted.startsWith('0x') || decrypted.length !== 66) {
      throw new Error('Invalid decrypted private key format')
    }

    return decrypted
  } catch (error) {
    console.error('🔐 Services: decryptPrivateKeyWithPin - Decryption failed:', error)
    throw new Error('PIN authentication failed or decryption error')
  }
}

export async function createPinAccessToken(
  userId: string,
  pin: string,
): Promise<{ accessToken: string; walletAddress: string }> {
  const wallet = await ensureWallet({ id: userId, role: 'USER' })

  try {
    await decryptPrivateKeyWithPin(wallet.encryptedPrivateKey, pin)
  } catch {
    throw new Error('PIN verification failed')
  }

  const crypto = await import('crypto')
  const accessToken = crypto.randomBytes(32).toString('hex')

  return {
    accessToken,
    walletAddress: wallet.address,
  }
}
