/**
 * Tier-3 domain overlay contracts (clone-local product modules).
 * Platform SSOT: types.ts + runtime.ts; clones overlay registry.ts (maps only).
 * @see docs/en/customization/vertical-presets.mdx
 */

import type { ComponentType } from 'react'
import type { Locale } from '@/i18n/shared'

export type OverlayMessages = Record<string, unknown>

export type OverlayI18nModule = {
  appendOverlayMessages: (locale: string) => Promise<OverlayMessages>
}

export type OverlayHomeRailProps = {
  locale: Locale
}

export type OverlayHomeRailComponent = ComponentType<OverlayHomeRailProps>

export type OverlayI18nRegistry = Record<
  string,
  () => Promise<OverlayI18nModule | { default: OverlayI18nModule }>
>

export type OverlayHomeRailRegistry = Record<
  string,
  () => Promise<
    | { default: OverlayHomeRailComponent }
    | { HomeRightRail: OverlayHomeRailComponent }
    | OverlayHomeRailComponent
  >
>

/** Overlay feature id is ring-config overlay.featureId (any clone slug). */
export type OverlayFeatureId = string
