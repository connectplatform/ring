/**
 * Platform Tier-3 overlay registry — maps only, intentionally empty.
 * Clones overlay this file and register domain loaders (see ring-n9life-com).
 * Load/resolve helpers live in lib/overlay/runtime.ts (platform SSOT).
 * Never import @/features/<clone> from platform.
 */

import type {
  OverlayHomeRailRegistry,
  OverlayI18nRegistry,
} from '@/lib/overlay/types'

export const OVERLAY_I18N_REGISTRY: OverlayI18nRegistry = {}

export const OVERLAY_HOME_RAIL_REGISTRY: OverlayHomeRailRegistry = {}
