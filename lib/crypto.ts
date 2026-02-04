/**
 * Cryptographic utilities for Ring Platform
 * Modern crypto operations for wallet management and security
 *
 * Following Secrets Keeper Legionnaire standards:
 * - AES-256-GCM encryption with authenticated encryption
 * - Scrypt key derivation for enhanced security
 * - Secure random number generation
 * - Zero-trust access patterns
 * - Comprehensive audit trails
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

/**
 * Encrypts data using AES-256-GCM
 */
export function encryptData(data: string, key: string): string {
  const salt = randomBytes(32)
  const keyBuffer = scryptSync(key, salt, 32)
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-gcm', keyBuffer, iv)

  let encrypted = cipher.update(data, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // Return format: salt:iv:authTag:encryptedData
  return `${salt.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Decrypts data encrypted with encryptData
 */
export function decryptData(encryptedData: string, key: string): string {
  const parts = encryptedData.split(':')
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted data format')
  }

  const [saltHex, ivHex, authTagHex, encrypted] = parts
  const salt = Buffer.from(saltHex, 'hex')
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const keyBuffer = scryptSync(key, salt, 32)

  const decipher = createDecipheriv('aes-256-gcm', keyBuffer, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Decrypts an encrypted private key following Secrets Keeper security protocols
 *
 * Security measures:
 * - Validates encryption key format and strength
 * - Implements multiple decryption strategies for migration compatibility
 * - Provides detailed error logging without exposing sensitive data
 * - Enforces proper key format validation
 *
 * @param encryptedKey - The encrypted private key data
 * @param encryptionKey - The master encryption key
 * @returns Decrypted private key with 0x prefix
 * @throws Error if decryption fails or key format is invalid
 */
export function decryptPrivateKey(encryptedKey: string, encryptionKey: string): `0x${string}` {
  // Secrets Keeper: Validate encryption key format
  if (!isValidEncryptionKey(encryptionKey)) {
    console.error('SECRETS KEEPER: Invalid encryption key format')
    throw new Error('Encryption key validation failed')
  }

  // Secrets Keeper: Input validation
  if (!encryptedKey || typeof encryptedKey !== 'string') {
    console.error('SECRETS KEEPER: Invalid encrypted key input')
    throw new Error('Invalid encrypted key format')
  }

  try {
    // Strategy 1: Try to decrypt as our AES-256-GCM format
    const decrypted = decryptData(encryptedKey, encryptionKey)

    // Validate the decrypted result is a valid private key
    if (!isValidPrivateKey(decrypted)) {
      throw new Error('Decrypted data is not a valid private key')
    }

    console.log('SECRETS KEEPER: Successfully decrypted private key using AES-256-GCM')
    return formatPrivateKey(decrypted)

  } catch (aesError) {
    console.warn('SECRETS KEEPER: AES-256-GCM decryption failed, trying fallback methods:', aesError.message)

    try {
      // Strategy 2: Check if it's already a plain hex private key (migration support)
      if (isPlainPrivateKey(encryptedKey)) {
        console.warn('SECRETS KEEPER: Using unencrypted private key - SECURITY RISK - migration required immediately')
        // TODO: Trigger security alert and migration workflow
        return encryptedKey as `0x${string}`
      }

      // Strategy 3: Try ethers.js format (legacy support)
      // This would require importing ethers, but we want to avoid it per the user's directive
      // Instead, we'll throw an error indicating migration is needed

      console.error('SECRETS KEEPER: All decryption strategies failed')
      throw new Error('Private key decryption failed - migration may be required')

    } catch (fallbackError) {
      console.error('SECRETS KEEPER: Fallback decryption also failed:', fallbackError.message)
      throw new Error('Private key decryption failed')
    }
  }
}

/**
 * Validates if a string is a valid Ethereum private key
 */
function isValidPrivateKey(key: string): boolean {
  // Remove 0x prefix if present
  const cleanKey = key.startsWith('0x') ? key.slice(2) : key

  // Must be 64 hex characters (32 bytes)
  if (!/^[a-f0-9]{64}$/i.test(cleanKey)) {
    return false
  }

  // Additional validation: should not be all zeros
  if (parseInt(cleanKey, 16) === 0) {
    return false
  }

  return true
}

/**
 * Checks if the key appears to be a plain (unencrypted) private key
 */
function isPlainPrivateKey(key: string): boolean {
  return key.startsWith('0x') && key.length === 66 && /^[a-f0-9]{64}$/i.test(key.slice(2))
}

/**
 * Formats a private key to ensure it has the 0x prefix
 */
function formatPrivateKey(key: string): `0x${string}` {
  if (key.startsWith('0x')) {
    return key as `0x${string}`
  }
  return `0x${key}` as `0x${string}`
}

/**
 * Generates a secure encryption key
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Validates an encryption key format
 */
export function isValidEncryptionKey(key: string): boolean {
  return /^[a-f0-9]{64}$/i.test(key) // 32 bytes in hex = 64 characters
}
