/**
 * @deprecated Import from @/lib/ring-config-core (or @/lib/ring-config on server).
 * Thin re-export shim — all logic lives in ring-config-core.ts.
 */
export type { InstanceConfig, PublicInstanceConfig } from '@/lib/ring-config-core'
export {
  getInstanceConfig,
  getInstanceConfigAsync,
  getInstanceConfigFromFile,
  getPublicInstanceConfig,
  getPublicInstanceConfigFromSnapshot,
  getBrandColors,
  isFeatureEnabled,
  invalidateInstanceConfigCache,
  ringConfigToInstanceConfig,
  resolveFeatureFlags,
  getResolvedSidebarStats,
} from '@/lib/ring-config-core'
