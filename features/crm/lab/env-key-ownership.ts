/**
 * Env key ownership taxonomy for Order Lab / My Orders.
 * Shared (client + server) — brand keys are NOT writable via env routes.
 */

export type EnvKeyOwner = 'owner_private' | 'integrator_ops' | 'public_shared'

export type LabEnvWriteRole = 'admin' | 'integrator' | 'buyer'

/** Written only by applyAndDeploy from Order Project Config — reject on env PATCH. */
export const BRAND_MIRROR_ENV_KEYS = new Set([
  'NEXT_PUBLIC_BRAND_NAME',
  'NEXT_PUBLIC_BRAND_TAGLINE',
  'NEXT_PUBLIC_BRAND_LOGO',
  'NEXT_PUBLIC_BRAND_OG_IMAGE',
  'RING_ORDER_PROJECT_CONFIG',
])

const OWNER_PRIVATE_EXACT = new Set([
  'RINGBASE_API_TOKEN',
  'BLOB_READ_WRITE_TOKEN',
  'AUTH_FIREBASE_PROJECT_ID',
  'AUTH_FIREBASE_CLIENT_EMAIL',
  'AUTH_FIREBASE_PRIVATE_KEY',
  'FIREBASE_PRIVATE_KEY_ID',
  'FIREBASE_CLIENT_ID',
  'FIREBASE_DATABASE_URL',
  'FIREBASE_FIRESTORE_DEBUG',
  // RingdomX / BYO mail — buyer maps domain MX or supplies SMTP
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'SMTP_PASS',
  'SMTP_FROM',
  'IMAP_HOST',
  'IMAP_PORT',
  'IMAP_USER',
  'IMAP_PASSWORD',
  'MAIL_MODE',
  'OTP_HMAC_SECRET',
  'EMAIL_MODE',
])

const OWNER_PRIVATE_PREFIXES = [
  'AUTH_FIREBASE_',
  'FIREBASE_',
  'NEXT_PUBLIC_FIREBASE_',
] as const

const PUBLIC_SHARED_EXACT = new Set([
  'NEXT_PUBLIC_BASE_URL',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_STORAGE_PROVIDER',
  'RINGBASE_API_URL',
  'RINGBASE_PUBLIC_URL',
])

export function isBrandMirrorEnvKey(key: string): boolean {
  return BRAND_MIRROR_ENV_KEYS.has(key)
}

export function getEnvKeyOwner(key: string): EnvKeyOwner {
  if (isBrandMirrorEnvKey(key)) return 'integrator_ops' // not writable via env UI
  if (OWNER_PRIVATE_EXACT.has(key)) return 'owner_private'
  if (OWNER_PRIVATE_PREFIXES.some((p) => key.startsWith(p))) return 'owner_private'
  if (PUBLIC_SHARED_EXACT.has(key)) return 'public_shared'
  return 'integrator_ops'
}

/**
 * Who may PATCH this env key.
 * - admin: all except brand mirrors (those come from projectConfig apply)
 * - integrator: integrator_ops + public_shared
 * - buyer: owner_private + public_shared
 */
export function canRoleWriteEnvKey(role: LabEnvWriteRole, key: string): boolean {
  if (isBrandMirrorEnvKey(key)) return false
  const owner = getEnvKeyOwner(key)
  if (role === 'admin') return true
  if (role === 'buyer') return owner === 'owner_private' || owner === 'public_shared'
  // integrator
  return owner === 'integrator_ops' || owner === 'public_shared'
}

export function assertEnvPatchAllowed(
  role: LabEnvWriteRole,
  patch: Record<string, string | null>,
): void {
  const denied = Object.keys(patch).filter((k) => !canRoleWriteEnvKey(role, k))
  if (denied.length) {
    throw new Error(
      `Not allowed to write env keys: ${denied.join(', ')} (role=${role})`,
    )
  }
}
