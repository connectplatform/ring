/**
 * Platform Tier-3 overlay runtime — load/resolve helpers (SSOT).
 * Clones must NOT overlay this file; they only overlay registry.ts (maps).
 * @see docs/en/customization/vertical-presets.mdx
 */

import { getOverlayFeature } from '@/lib/ring-config-core'
import {
  OVERLAY_HOME_RAIL_REGISTRY,
  OVERLAY_I18N_REGISTRY,
} from '@/lib/overlay/registry'
import type {
  OverlayHomeRailComponent,
  OverlayI18nModule,
  OverlayMessages,
} from '@/lib/overlay/types'

function asI18nModule(mod: unknown): OverlayI18nModule | null {
  if (!mod || typeof mod !== 'object') return null
  const rec = mod as Record<string, unknown>
  if (typeof rec.appendOverlayMessages === 'function') {
    return rec as unknown as OverlayI18nModule
  }
  const def = rec.default
  if (
    def &&
    typeof def === 'object' &&
    typeof (def as OverlayI18nModule).appendOverlayMessages === 'function'
  ) {
    return def as OverlayI18nModule
  }
  return null
}

export async function loadOverlayMessages(locale: string): Promise<OverlayMessages> {
  const feature = getOverlayFeature()
  if (!feature) return {}
  const loader = OVERLAY_I18N_REGISTRY[feature]
  if (!loader) return {}
  try {
    const api = asI18nModule(await loader())
    if (!api) return {}
    return await api.appendOverlayMessages(locale)
  } catch {
    return {}
  }
}

export async function resolveOverlayHomeRail(): Promise<OverlayHomeRailComponent | null> {
  const feature = getOverlayFeature()
  if (!feature) return null
  const loader = OVERLAY_HOME_RAIL_REGISTRY[feature]
  if (!loader) return null
  try {
    const mod = await loader()
    if (typeof mod === 'function') return mod as OverlayHomeRailComponent
    if (mod && typeof mod === 'object') {
      const rec = mod as Record<string, unknown>
      if (typeof rec.HomeRightRail === 'function') {
        return rec.HomeRightRail as OverlayHomeRailComponent
      }
      if (typeof rec.default === 'function') {
        return rec.default as OverlayHomeRailComponent
      }
    }
    return null
  } catch {
    return null
  }
}
