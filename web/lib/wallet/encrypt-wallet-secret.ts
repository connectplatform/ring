import 'server-only'

/**
 * Wallet secret encryption — versioned, PIN-aware, AES-256-GCM.
 *
 * ============================================================================
 * FORMAT SPECIFICATION (v2 — current)
 * ============================================================================
 *   v2:<scryptSaltHex>:<ivHex>:<encryptedHex>:<authTagHex>[:<pinHashHex>]
 *
 *   - "v2"                 — version prefix (allows future migration)
 *   - scryptSaltHex        — per-secret random scrypt salt (32 bytes hex)
 *   - ivHex                — AES-GCM IV (12 bytes recommended; we use 16)
 *   - encryptedHex         — AES-256-GCM ciphertext of the secret
 *   - authTagHex           — AES-GCM authentication tag
 *   - pinHashHex (optional) — sha256(pin) when PIN-wrapped, for fast reject
 *
 * FORMAT SPECIFICATION (v1 — legacy, read-only)
 * ============================================================================
 *   <ivHex>:<encryptedHex>:<authTagHex>
 *
 *   - 3 colon-separated hex segments
 *   - scrypt derivation uses env encryptionKey with fixed "salt"
 *   - Decryptable via decryptWalletSecretLegacy() during migration
 *
 * KEY DERIVATION
 * ============================================================================
 *   v2 (no PIN):   scrypt( encryptionKey, randomSalt, 32 )
 *   v2 (with PIN): scrypt( encryptionKey + ":" + sha256(pin), randomSalt, 32 )
 *
 *   The PIN hash is stored alongside the ciphertext so we can detect a wrong
 *   PIN in O(1) without running the expensive scrypt derivation.
 *
 * PIN POLICY
 * ============================================================================
 *   - Exactly 4 numeric digits (defence in depth — server-side, but lets us
 *     reject obviously bad PINs early)
 *   - PIN is sha256-hashed before being mixed into scrypt input
 *   - PIN is NEVER stored in plaintext anywhere; only its hash is co-located
 *     with the ciphertext for fast reject
 *
 * MIGRATION
 * ============================================================================
 *   On first successful PIN check (decryptSecretWithPin), the caller is
 *   responsible for re-encrypting the secret using encryptWalletSecretV2()
 *   with the user's PIN and writing it back via setUserWallets(). This is
 *   a one-time, per-wallet migration. We expose a helper isLegacyV1Format()
 *   for the caller to detect when migration is needed.
 * ============================================================================
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 16
const SALT_BYTES = 32
const KEY_BYTES = 32
const V1_FIXED_SALT = 'salt' // matches the legacy v1 format
const V2_PREFIX = 'v2'

// ----------------------------------------------------------------------------
// PIN policy — server-side defence in depth. Strictly 4 numeric digits.
// ----------------------------------------------------------------------------
export const PIN_REGEX = /^\d{4}$/

export function isValidPin(pin: string): boolean {
  return typeof pin === 'string' && pin.length === 4 && PIN_REGEX.test(pin)
}

function hashPin(pin: string): Buffer {
  return createHash('sha256').update(pin, 'utf8').digest()
}

// ----------------------------------------------------------------------------
// v2: PIN-aware encryption
// ----------------------------------------------------------------------------
export interface EncryptOptions {
  /** Optional 4-digit PIN. If provided, the secret is wrapped with the PIN. */
  pin?: string
}

export function encryptWalletSecret(
  secret: string,
  encryptionKey: string,
  options: EncryptOptions = {},
): string {
  if (!encryptionKey) {
    throw new Error('WALLET_ENCRYPTION_KEY is required for wallet encryption')
  }

  const scryptSalt = randomBytes(SALT_BYTES)
  const iv = randomBytes(IV_BYTES)
  const key = deriveKeyV2(encryptionKey, scryptSalt, options.pin)

  const cipher = createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(secret, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()

  const parts = [
    V2_PREFIX,
    scryptSalt.toString('hex'),
    iv.toString('hex'),
    encrypted,
    authTag.toString('hex'),
  ]
  if (options.pin) parts.push(hashPin(options.pin).toString('hex'))
  return parts.join(':')
}

// ----------------------------------------------------------------------------
// v2: PIN-aware decryption. Throws on:
//   - malformed v2 envelope
//   - wrong PIN (fast reject via pinHash, no scrypt work)
//   - AES-GCM auth failure (tamper detection)
//   - missing WALLET_ENCRYPTION_KEY
// ----------------------------------------------------------------------------
export function decryptSecretWithPin(
  encryptedPrivateKey: string,
  pin: string,
): string {
  if (!isValidPin(pin)) {
    throw new Error('PIN must be exactly 4 digits')
  }
  if (isLegacyV1Format(encryptedPrivateKey)) {
    throw new Error('Legacy v1 wallet detected — re-encrypt required (call reencryptLegacyWallet)')
  }
  return decryptV2WithPin(encryptedPrivateKey, pin)
}

function decryptV2WithPin(envelope: string, pin: string): string {
  const parts = envelope.split(':')
  if (parts.length !== 6 && parts.length !== 5) {
    throw new Error('Invalid v2 encrypted private key format')
  }
  if (parts[0] !== V2_PREFIX) {
    throw new Error('Invalid v2 encrypted private key format (version prefix)')
  }

  const [, scryptSaltHex, ivHex, encryptedHex, authTagHex, pinHashHex] = parts
  const encryptionKey = process.env.WALLET_ENCRYPTION_KEY
  if (!encryptionKey) {
    throw new Error('WALLET_ENCRYPTION_KEY is not configured')
  }

  // Fast reject: if envelope has a PIN hash and it doesn't match, fail
  // immediately without running scrypt. Constant-time compare.
  if (pinHashHex) {
    const provided = hashPin(pin)
    const expected = Buffer.from(pinHashHex, 'hex')
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
      throw new Error('PIN authentication failed')
    }
  }

  const scryptSalt = Buffer.from(scryptSaltHex, 'hex')
  const iv = Buffer.from(ivHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')

  const key = deriveKeyV2(encryptionKey, scryptSalt, pin)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(encrypted, undefined, 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

// ----------------------------------------------------------------------------
// Key derivation — v2 with optional PIN
// ----------------------------------------------------------------------------
function deriveKeyV2(encryptionKey: string, salt: Buffer, pin?: string): Buffer {
  // Compose the scrypt password: env key, optionally suffixed with pin hash
  const password = pin
    ? `${encryptionKey}:${hashPin(pin).toString('hex')}`
    : encryptionKey
  return scryptSync(password, salt, KEY_BYTES)
}

// ----------------------------------------------------------------------------
// v1 LEGACY — read-only path used during migration
// ----------------------------------------------------------------------------
export function isLegacyV1Format(encryptedPrivateKey: string): boolean {
  const parts = encryptedPrivateKey.split(':')
  return parts.length === 3 && parts.every((p) => /^[0-9a-f]+$/i.test(p))
}

/**
 * Decrypt a v1 (legacy) wallet secret. Used by the migration tool ONLY.
 * New code should never call this — prefer decryptSecretWithPin + re-encrypt.
 */
export function decryptWalletSecretLegacy(
  encryptedPrivateKey: string,
  encryptionKey: string,
): string {
  const parts = encryptedPrivateKey.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid v1 encrypted private key format')
  }
  const [ivHex, encryptedHex, authTagHex] = parts
  const key = scryptSync(encryptionKey, V1_FIXED_SALT, KEY_BYTES)
  const iv = Buffer.from(ivHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(encrypted, undefined, 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

/**
 * One-shot migration helper. Reads a legacy v1 wallet secret, re-encrypts it
 * to v2 with the user's PIN, and returns the new envelope. Caller is
 * responsible for writing it back to the user record (typically via
 * setUserWallets in lib/wallet/user-wallet-db.ts).
 */
export function reencryptLegacyWallet(
  legacyEnvelope: string,
  encryptionKey: string,
  pin: string,
): string {
  if (!isValidPin(pin)) throw new Error('PIN must be exactly 4 digits')
  const secret = decryptWalletSecretLegacy(legacyEnvelope, encryptionKey)
  return encryptWalletSecret(secret, encryptionKey, { pin })
}

// ----------------------------------------------------------------------------
// Back-compat shim: legacy callers passing only (secret, envKey) get a v2
// envelope without PIN. This keeps existing provisioning paths working
// while we migrate user PINs lazily (on first PIN-based withdrawal).
//
// TODO: Once ALL users have a PIN set, switch to require explicit PIN and
// add a "setPinForWallet" flow that re-encrypts existing keys. Track in
// AI-CONTEXT under "pin-migration-milestone".
// ----------------------------------------------------------------------------
export function decryptWalletSecret(
  encryptedPrivateKey: string,
  encryptionKey: string,
): string {
  if (isLegacyV1Format(encryptedPrivateKey)) {
    return decryptWalletSecretLegacy(encryptedPrivateKey, encryptionKey)
  }
  // v2 without PIN — we cannot use decryptSecretWithPin (no PIN provided)
  // so we expose a no-PIN path for legacy call sites only.
  const parts = encryptedPrivateKey.split(':')
  if (parts.length === 5 && parts[0] === V2_PREFIX) {
    const [, scryptSaltHex, ivHex, encryptedHex, authTagHex] = parts
    const scryptSalt = Buffer.from(scryptSaltHex, 'hex')
    const iv = Buffer.from(ivHex, 'hex')
    const encrypted = Buffer.from(encryptedHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const key = deriveKeyV2(encryptionKey, scryptSalt)
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    let decrypted = decipher.update(encrypted, undefined, 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  }
  throw new Error('Invalid encrypted private key format')
}
