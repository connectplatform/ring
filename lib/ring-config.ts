import 'server-only'

import { cache } from 'react'
import {
  getRingConfigSnapshot,
  getRingSeoBranding,
  getSiteBaseUrl,
  getSocialLinks,
  getPlatformIdentity,
  getRingTokenSymbol,
  getInstanceConfig,
  getInstanceConfigAsync,
  getPublicInstanceConfig,
  getPublicInstanceConfigFromSnapshot,
  getBrandColors,
  isFeatureEnabled,
  invalidateInstanceConfigCache,
  getResolvedSidebarStats,
  resolveFeatureFlags,
  ringConfigToInstanceConfig,
  getMatcherInstallDefaults,
} from '@/lib/ring-config-core'
import type { RingConfig } from '@/lib/ring-config-types'

export type {
  ProductFieldsPreset,
  ProductBadgesPreset,
  SidebarLinkConfig,
  SidebarCommunityLinkConfig,
  SidebarStatConfig,
  RingConfig,
  InstanceConfig,
  PublicInstanceConfig,
  RingMatcherConfig,
} from '@/lib/ring-config-types'

export const getRingConfig = cache((): RingConfig => getRingConfigSnapshot())

export {
  getSiteBaseUrl,
  getRingSeoBranding,
  getSocialLinks,
  getPlatformIdentity,
  getRingTokenSymbol,
  getInstanceConfig,
  getInstanceConfigAsync,
  getPublicInstanceConfig,
  getPublicInstanceConfigFromSnapshot,
  getBrandColors,
  isFeatureEnabled,
  invalidateInstanceConfigCache,
  getResolvedSidebarStats,
  resolveFeatureFlags,
  ringConfigToInstanceConfig,
  getMatcherInstallDefaults,
}
