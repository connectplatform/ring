import 'server-only'

import bs58 from 'bs58'
import { decryptPrivateKey } from '@/lib/crypto'
import { decryptWalletSecret } from '@/lib/wallet/encrypt-wallet-secret'

/**
 * Decrypt custodial wallet private keys stored on users.wallets[].
 * Supports ensure-wallet format (iv:encrypted:authTag + scrypt salt) and lib/crypto AES format.
 */
export function decryptUserWalletPrivateKey(
  encryptedPrivateKey: string,
  encryptionKey: string,
): `0x${string}` {
  const parts = encryptedPrivateKey.split(':')

  if (parts.length === 3) {
    let decrypted = decryptWalletSecret(encryptedPrivateKey, encryptionKey)
    if (!decrypted.startsWith('0x')) {
      decrypted = `0x${decrypted}`
    }
    return decrypted as `0x${string}`
  }

  return decryptPrivateKey(encryptedPrivateKey, encryptionKey)
}

export function decryptSolanaWalletSecretKey(
  encryptedPrivateKey: string,
  encryptionKey: string,
): Uint8Array {
  const secret = decryptWalletSecret(encryptedPrivateKey, encryptionKey)
  return bs58.decode(secret)
}
