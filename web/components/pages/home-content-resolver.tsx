'use client'

/**
 * Home content preset resolver.
 *
 * Selection is **only** `getHomePreset()` from ring-config:
 * - `platform` → static PlatformHome
 * - any other kebab-case id → dynamic `./home-presets/${preset}` (missing chunk → PlatformHome)
 *
 * Packs/clones path-overwrite `home-presets/<name>.tsx`. Bare L1 has no vertical landings.
 */

import dynamic from 'next/dynamic'
import type { Session } from 'next-auth'
import PlatformHome from '@/components/pages/home'
import { getHomePreset } from '@/lib/ring-config-core'

export interface HomeContentProps {
  session: Session | null
}

type HomeContentComponent = React.ComponentType<HomeContentProps>

export type HomeLandingPresetId = string

function resolveHomeContent(): HomeContentComponent {
  const preset = getHomePreset()
  if (preset === 'platform' || !preset) {
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
