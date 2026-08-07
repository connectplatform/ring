import 'server-only'

import bs58 from 'bs58'
import { decryptPrivateKey } from '@/lib/crypto'
import {
  decryptWalletSecret,
  decryptSecretWithPin,
  isLegacyV1Format,
  isValidPin,
} from '@/lib/wallet/encrypt-wallet-secret'

/**
 * Decrypt custodial wallet private keys stored on users.wallets[].
 *
 * Supports:
 *   - v1 (legacy):  iv:encrypted:authTag  (3 hex segments)
 *   - v2:           v2:scryptSalt:iv:encrypted:authTag[:pinHash]
 *
 * The returned key is normalised for the chain:
 *   - EVM: 0x-prefixed 64-hex-char (66 total)
 *   - Solana: raw 64-byte Uint8Array via decryptSolanaWalletSecretKey(), or
 *     base58 string via decryptSolanaWalletSecretBase58() for @solana/kit callers
 */
export function decryptUserWalletPrivateKey(
  encryptedPrivateKey: string,
  encryptionKey: string,
): `0x${string}` {
  if (isLegacyV1Format(encryptedPrivateKey)) {
    let decrypted = decryptWalletSecret(encryptedPrivateKey, encryptionKey)
    if (!decrypted.startsWith('0x')) {
      decrypted = `0x${decrypted}`
    }
    return decrypted as `0x${string}`
  }
  // v2 without PIN — legacy path, no PIN wrap yet
  let decrypted = decryptWalletSecret(encryptedPrivateKey, encryptionKey)
  if (!decrypted.startsWith('0x')) {
    decrypted = `0x${decrypted}`
  }
  return decrypted as `0x${string}`
}

/**
 * PIN-aware EVM private key decryption. Throws on wrong PIN.
 */
export function decryptUserWalletPrivateKeyWithPin(
  encryptedPrivateKey: string,
  pin: string,
): `0x${string}` {
  if (!isValidPin(pin)) {
    throw new Error('PIN must be exactly 4 digits')
  }
  if (isLegacyV1Format(encryptedPrivateKey)) {
    // Caller must migrate this wallet to v2 first via migrateUserWalletsToPin
    throw new Error('Legacy v1 wallet — migrate to v2 before PIN-based decryption')
  }
  let decrypted = decryptSecretWithPin(encryptedPrivateKey, pin)
  if (!decrypted.startsWith('0x')) {
    decrypted = `0x${decrypted}`
  }
  return decrypted as `0x${string}`
}

/**
 * Decrypt a Solana wallet secret key. Returns the raw 64-byte keypair bytes
 * (Uint8Array) ready for Keypair.fromSecretKey() — matches the original
 * contract used by native-token-transfer.ts and treasury-transfer-service.ts.
 */
export function decryptSolanaWalletSecretKey(
  encryptedPrivateKey: string,
  encryptionKey: string,
): Uint8Array {
  const secret = decryptWalletSecret(encryptedPrivateKey, encryptionKey)
  return bs58.decode(secret)
}

/**
 * PIN-aware variant for Solana. Returns the raw 64-byte keypair bytes.
 */
export function decryptSolanaWalletSecretKeyWithPin(
  encryptedPrivateKey: string,
  pin: string,
): Uint8Array {
  if (!isValidPin(pin)) {
    throw new Error('PIN must be exactly 4 digits')
  }
  if (isLegacyV1Format(encryptedPrivateKey)) {
    throw new Error('Legacy v1 wallet — migrate to v2 before PIN-based decryption')
  }
  const secret = decryptSecretWithPin(encryptedPrivateKey, pin)
  return bs58.decode(secret)
}

/**
 * Decrypt a Solana wallet secret to its base58-encoded string form.
 * Use only when the caller needs the string (e.g. @solana/kit signer
 * construction); prefer decryptSolanaWalletSecretKey for @solana/web3.js
 * Keypair.fromSecretKey() call sites.
 *
 * TODO: When migrating native-token-transfer.ts / treasury-transfer-service.ts
 * to @solana/kit, switch their Keypair.fromSecretKey(bytes) calls to this
 * base58 form + the kit's createKeyPairSignerFromBytes/PrivateKey helpers.
 */
export function decryptSolanaWalletSecretBase58(
  encryptedPrivateKey: string,
  encryptionKey: string,
): string {
  return decryptWalletSecret(encryptedPrivateKey, encryptionKey)
}
