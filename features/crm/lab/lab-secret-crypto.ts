import 'server-only'

import {
  encryptWalletSecret,
  decryptWalletSecret,
} from '@/lib/wallet/encrypt-wallet-secret'

function encryptionKey(): string {
  const key = process.env.ORDER_LAB_ENCRYPTION_KEY || process.env.WALLET_ENCRYPTION_KEY
  if (!key) {
    throw new Error('WALLET_ENCRYPTION_KEY (or ORDER_LAB_ENCRYPTION_KEY) is required')
  }
  return key
}

/** Encrypt a secret env value for storage in project_deployments. */
export function encryptLabSecret(plaintext: string): string {
  return encryptWalletSecret(plaintext, encryptionKey())
}

/** Decrypt a previously encrypted lab secret. */
export function decryptLabSecret(ciphertext: string): string {
  return decryptWalletSecret(ciphertext, encryptionKey())
}

export type MaskedEnvValue =
  | { set: true; class: 'secret' }
  | { set: true; class: 'public'; value: string }
  | { set: false; class: 'public' | 'secret' }

export function maskEnvMap(
  envConfig: Record<string, { class: 'public' | 'secret'; value: string; encrypted?: boolean }>,
): Record<string, MaskedEnvValue> {
  const out: Record<string, MaskedEnvValue> = {}
  for (const [key, entry] of Object.entries(envConfig)) {
    if (!entry.value) {
      out[key] = { set: false, class: entry.class }
      continue
    }
    if (entry.class === 'secret') {
      out[key] = { set: true, class: 'secret' }
    } else {
      out[key] = { set: true, class: 'public', value: entry.value }
    }
  }
  return out
}
