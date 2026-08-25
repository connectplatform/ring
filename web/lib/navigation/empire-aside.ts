/**
 * Empire-only desktop aside groups (L1 chrome socket).
 *
 * Platform Concepts: /token-economy, /about-publisher, /global-impact, /ai-web3
 * Get Started: /docs/getting-started, /calculator, /roadmap
 *
 * Hidden when ring-config `presets.pack` is set (GreenFood, Vikka, n9life).
 * Empire `ring-platform-org` has no pack and keeps the groups.
 * Packs must not fork sidebar chrome; they only overwrite primary-nav.ts.
 */
import { getPresetPack } from '@/lib/ring-config-core'

export function hideEmpireAsideGroups(packId?: string | null): boolean {
  const pack = packId === undefined ? getPresetPack() : packId
  return Boolean(pack && pack.trim())
}
