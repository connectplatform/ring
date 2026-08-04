/**
 * Clone essentials pinned at top of Env UI — required for tab status (red when empty).
 * Client-safe SSOT (no server-only / fs).
 */
export const ENV_ESSENTIALS = [
  'NEXT_PUBLIC_BASE_URL',
  'NEXT_PUBLIC_APP_URL',
  'NEXTAUTH_URL',
  'BLOB_READ_WRITE_TOKEN',
  'NEXT_PUBLIC_STORAGE_PROVIDER',
  'RINGBASE_API_URL',
  'RINGBASE_PUBLIC_URL',
  'RINGBASE_API_TOKEN',
  'AUTH_SECRET',
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'DATABASE_URL',
] as const

export type EnvEssentialKey = (typeof ENV_ESSENTIALS)[number]
