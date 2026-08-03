import 'server-only'

import {
  encryptWalletSecret,
  decryptWalletSecret,
} from '@/lib/wallet/encrypt-wallet-secret'
import { getEnvKeyOwner, type EnvKeyOwner } from '@/features/crm/lab/env-key-ownership'

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
  | { set: true; class: 'secret'; owner: EnvKeyOwner }
  | { set: true; class: 'public'; value: string; owner: EnvKeyOwner }
  | { set: false; class: 'public' | 'secret'; owner: EnvKeyOwner }

export function maskEnvMap(
  envConfig: Record<string, { class: 'public' | 'secret'; value: string; encrypted?: boolean }>,
  opts?: { hideOwnerPrivateValues?: boolean },
): Record<string, MaskedEnvValue> {
  const hideOwnerPrivate = opts?.hideOwnerPrivateValues ?? false
  const out: Record<string, MaskedEnvValue> = {}
  for (const [key, entry] of Object.entries(envConfig)) {
    const owner = getEnvKeyOwner(key)
    if (!entry.value) {
      out[key] = { set: false, class: entry.class, owner }
      continue
    }
    if (hideOwnerPrivate && owner === 'owner_private') {
      out[key] = { set: true, class: entry.class === 'public' ? 'secret' : entry.class, owner }
      continue
    }
    if (entry.class === 'secret') {
      out[key] = { set: true, class: 'secret', owner }
    } else {
      out[key] = { set: true, class: 'public', value: entry.value, owner }
    }
  }
  return out
}
