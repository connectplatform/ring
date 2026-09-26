/**
 * L3 clone socket — always present so webpack resolves the import on bare L1.
 * Clone overwrites this file to tweak icon ids / labelKeys / hrefs without copying primary-nav.ts.
 */
import type { Locale } from '@/i18n/shared'

export type PrimaryNavActiveMatch = 'pathname' | 'pathname+query' | 'exact'

export type PrimaryNavOverlayExtra = {
  id: string
  href: (locale: Locale) => string
  labelKeys: string[]
  icon: string
  activeMatch?: PrimaryNavActiveMatch
}

export type PrimaryNavOverlay = {
  iconById?: Record<string, string>
  labelKeysById?: Record<string, string[]>
  /** Optional href replacement per slot id (L3). Same (locale) => string contract as pack items. */
  hrefById?: Record<string, (locale: Locale) => string>
  /** Per-slot active match, e.g. exact so /n9 does not highlight /n9/vault. */
  activeMatchById?: Record<string, PrimaryNavActiveMatch>
  /** Appended to desktop rail + aside after pack slots. */
  desktopExtra?: PrimaryNavOverlayExtra[]
}

export const PRIMARY_NAV_OVERLAY: PrimaryNavOverlay = {}
