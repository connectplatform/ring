import crypto from 'crypto'

import { UserRolesArray } from '@/features/auth/user-role'
import { db } from '@/lib/database'
import {
  normalizeWalletStorageId,
  toChecksumAddress,
} from '@/features/wallet/services/verify-wallet-signature'

// TODO: Consider refactoring database interactions to use native Next.js server actions (app directory and server components) or React server actions when possible, to improve type safety and data mutation patterns in future versions.
// TODO: Switch to using Date.now() with an explicit UTC ISOTimestamp for expires to avoid potential time zone issues.

export async function generateNonce(publicAddress: string): Promise<{ nonce: string; expires: number }> {
  // Ensure a public address has been provided
  if (!publicAddress) {
    throw new Error('Public address is required')
  }

  // Generate a normalized storage ID for the wallet record (ensures uniqueness and lookup consistency)
  const storageId = normalizeWalletStorageId(publicAddress)
  // Standardize the provided address to checksum format (case-sensitive format for Ethereum addresses)
  const checksumAddress = toChecksumAddress(publicAddress)

  // Generate a 256-bit cryptographically secure random nonce, as a 64-character hex string
  // This nonce will be used as a challenge for authentication (wallet signature)
  const nonce = crypto.randomBytes(32).toString('hex')
  // Set the expiry timestamp to 1 hour from now (in ms since epoch)
  // TODO: Consider using ISO string for consistent storage and futureproofing.
  const expires = Date.now() + 3600000

  // Fetch user document from the 'users' collection using the normalized storage ID
  const userResult = await db().findDocById<Record<string, unknown>>('users', storageId)

  // If the DB returned an error specifically during initialization, surface a clear error
  // STUB: db().findDocById should guarantee proper operation or surface more granular errors (improve error handling model)
  if (!userResult.success && userResult.metadata?.operation === 'initialize') {
    throw new Error('Database initialization failed')
  }

  // Determine if user already exists in the database
  const existing = userResult.success && userResult.data ? userResult.data : null

  // Prepare payload that will be stored in the DB: nonce, expiry, and standardized wallet address
  const noncePayload = {
    nonce,
    nonceExpires: expires,
    walletAddress: checksumAddress,
  }

  if (existing) {
    // If a user record already exists, update it with the new nonce details
    const updateResult = await db().updateDoc('users', storageId, noncePayload)
    // If the update fails, throw an error
    // STUB: db().updateDoc should provide more granular failure causes as error codes or custom Error classes
    if (!updateResult.success) {
      throw new Error('Failed to store nonce in database')
    }
  } else {
    // If user doesn't exist, create a new user record (with default fields and the nonce payload)
    const now = new Date().toISOString() // Use UTC ISO string for createdAt/lastLogin
    // NOTE: role assignment as "subscriber" is opinionated; if multi-role, refactor accordingly.
    // STUB: db().createDoc should validate incoming fields and allow partial user schema creation as needed
    const createResult = await db().createDoc(
      'users',
      {
        role: UserRolesArray.subscriber as UserRolesArray,
        email: '',
        name: null,
        isVerified: false,
        createdAt: now,
        lastLogin: now,
        ...noncePayload,
      },
      { id: storageId }
    )
    // Surface a clear error if creation fails
    if (!createResult.success) {
      throw new Error('Failed to create wallet user for nonce')
    }
  }

  // Return the newly generated nonce and its expiry time to the caller
  return { nonce, expires }
}
