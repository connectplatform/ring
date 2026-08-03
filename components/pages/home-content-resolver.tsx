'use client'

/**
 * Home content preset resolver (Tier-2 SSOT — docs/en/customization/vertical-presets.mdx).
 *
 * Selection is **only** `getHomePreset()` from ring-config:
 * - `platform` → static PlatformHome
 * - allowlisted kebab-case ids → dynamic `./home-presets/${preset}` (missing chunk → PlatformHome)
 *
 * Shared allowlist = `mvm-landing` + `${getOverlayFeature()}-landing` when a Tier-3 domain key is active.
 * Do **not** hardcode clone product ids (no greenfood-live / bare n9life-landing forever).
 */

import dynamic from 'next/dynamic'
import type { Session } from 'next-auth'
import PlatformHome from '@/components/pages/home'
import { getHomePreset, getOverlayFeature } from '@/lib/ring-config-core'

export interface HomeContentProps {
  session: Session | null
}

type HomeContentComponent = React.ComponentType<HomeContentProps>

/** Shared landing presets that may ship on platform. */
const SHARED_HOME_LANDING_PRESETS = ['mvm-landing'] as const

export function getHomeLandingAllowlist(): readonly string[] {
  const feature = getOverlayFeature()
  if (feature) return [...SHARED_HOME_LANDING_PRESETS, `${feature}-landing`]
  return [...SHARED_HOME_LANDING_PRESETS]
}

/** @deprecated Prefer getHomeLandingAllowlist() — kept for call-site familiarity. */
export const HOME_LANDING_PRESET_ALLOWLIST = SHARED_HOME_LANDING_PRESETS

export type HomeLandingPresetId = string

function isAllowlistedLandingPreset(preset: string): boolean {
  return getHomeLandingAllowlist().includes(preset)
}

function resolveHomeContent(): HomeContentComponent {
  const preset = getHomePreset()
  if (preset === 'platform' || !isAllowlistedLandingPreset(preset)) {
    return PlatformHome as HomeContentComponent
  }

  return dynamic(
    () =>
      import(`./home-presets/${preset}`)
        .then((mod) => (mod.default ?? PlatformHome) as HomeContentComponent)
        .catch(() => PlatformHome as HomeContentComponent),
    { ssr: true },
  ) as HomeContentComponent
}

const HomeContent = resolveHomeContent()

export default HomeContent
