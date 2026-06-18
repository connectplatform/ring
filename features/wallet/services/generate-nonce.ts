import crypto from 'crypto'

import { UserRole } from '@/features/auth/user-role'
import { db } from '@/lib/database'
import {
  normalizeWalletStorageId,
  toChecksumAddress,
} from '@/features/wallet/services/verify-wallet-signature'

export async function generateNonce(publicAddress: string): Promise<{ nonce: string; expires: number }> {
  if (!publicAddress) {
    throw new Error('Public address is required')
  }

  const storageId = normalizeWalletStorageId(publicAddress)
  const checksumAddress = toChecksumAddress(publicAddress)

  const nonce = crypto.randomBytes(32).toString('hex')
  const expires = Date.now() + 3600000

  const userResult = await db().findDocById<Record<string, unknown>>('users', storageId)
  if (!userResult.success && userResult.metadata?.operation === 'initialize') {
    throw new Error('Database initialization failed')
  }

  const existing = userResult.success && userResult.data ? userResult.data : null

  const noncePayload = {
    nonce,
    nonceExpires: expires,
    walletAddress: checksumAddress,
  }

  if (existing) {
    const updateResult = await db().updateDoc('users', storageId, noncePayload)
    if (!updateResult.success) {
      throw new Error('Failed to store nonce in database')
    }
  } else {
    const now = new Date().toISOString()
    const createResult = await db().createDoc(
      'users',
      {
        role: UserRole.subscriber,
        email: '',
        name: null,
        isVerified: false,
        createdAt: now,
        lastLogin: now,
        ...noncePayload,
      },
      { id: storageId }
    )
    if (!createResult.success) {
      throw new Error('Failed to create wallet user for nonce')
    }
  }

  return { nonce, expires }
}
