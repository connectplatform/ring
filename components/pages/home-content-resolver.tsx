'use client'

/**
 * Home content preset registry (Tier-2 SSOT — see docs/en/customization/vertical-presets.mdx).
 * ring-config `home.preset` selects the landing; preset names live only here + config.
 * Platform default is statically imported; vertical landings load as separate chunks.
 */

import dynamic from 'next/dynamic'
import type { Session } from 'next-auth'
import PlatformHome from '@/components/pages/home'
import { getHomePreset } from '@/lib/ring-config-core'

export interface HomeContentProps {
  session: Session | null
}

type HomeContentComponent = React.ComponentType<HomeContentProps>

const MvmLanding = dynamic(() => import('./home-presets/mvm-landing'), {
  ssr: true,
}) as HomeContentComponent

/** Registered home landings — add new presets here only */
export const HOME_PRESET_REGISTRY: Record<string, HomeContentComponent> = {
  platform: PlatformHome as HomeContentComponent,
  'mvm-landing': MvmLanding,
}

/** Active home content for this clone (ring-config home.preset, default "platform"). */
const ActiveHomeContent: HomeContentComponent =
  HOME_PRESET_REGISTRY[getHomePreset()] ?? (PlatformHome as HomeContentComponent)

export default ActiveHomeContent
