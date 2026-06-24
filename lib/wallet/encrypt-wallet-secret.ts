import 'server-only'

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

/**
 * AES-256-GCM encrypt custodial wallet secrets (EVM hex or Solana base58).
 * Format: iv:encrypted:authTag (hex segments).
 */
export function encryptWalletSecret(secret: string, encryptionKey: string): string {
  const algorithm = 'aes-256-gcm'
  const key = scryptSync(encryptionKey, 'salt', 32)
  const iv = randomBytes(16)

  const cipher = createCipheriv(algorithm, key, iv)
  let encrypted = cipher.update(secret, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`
}

export function decryptWalletSecret(encryptedPrivateKey: string, encryptionKey: string): string {
  const parts = encryptedPrivateKey.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted private key format')
  }

  const [ivHex, encryptedHex, authTagHex] = parts
  const key = scryptSync(encryptionKey, 'salt', 32)
  const iv = Buffer.from(ivHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')

  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, undefined, 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}
