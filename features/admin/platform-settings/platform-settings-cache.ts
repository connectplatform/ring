import type { PlatformSettingsNamespace } from '@/features/admin/platform-settings/types'

type CacheEntry = {
  data: Record<string, unknown>
  secrets: Record<string, string>
  expiresAt: number
}

const TTL_MS = 60_000
const cache = new Map<string, CacheEntry>()

export function getCachedNamespace(namespace: PlatformSettingsNamespace) {
  const entry = cache.get(namespace)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(namespace)
    return null
  }
  return entry
}

export function setCachedNamespace(
  namespace: PlatformSettingsNamespace,
  data: Record<string, unknown>,
  secrets: Record<string, string>,
) {
  cache.set(namespace, {
    data,
    secrets,
    expiresAt: Date.now() + TTL_MS,
  })
}

export function invalidateNamespace(namespace: PlatformSettingsNamespace) {
  cache.delete(namespace)
}

export function invalidateAllPlatformSettingsCache() {
  cache.clear()
}
