/**
 * L3 clone socket — always present so webpack resolves the import on bare L1.
 * Clone overwrites this file to tweak icon ids / labelKeys / hrefs without copying primary-nav.ts.
 */
import type { Locale } from '@/i18n/shared'

export type PrimaryNavOverlay = {
  iconById?: Record<string, string>
  labelKeysById?: Record<string, string[]>
  /** Optional href replacement per slot id (L3). Same (locale) => string contract as pack items. */
  hrefById?: Record<string, (locale: Locale) => string>
}

export const PRIMARY_NAV_OVERLAY: PrimaryNavOverlay = {}
