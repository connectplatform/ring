/**
 * Localized catalog title/description helpers (EN registry remains SSOT fallback).
 */

import { getCatalogEntry } from '../catalog'

type GamesTranslate = {
  (key: string): string
}

/** Resolve catalog title via modules.games; fall back to catalog.ts EN. */
export function localizedCatalogTitle(
  tGames: GamesTranslate,
  slug: string,
): string {
  const fallback = getCatalogEntry(slug)?.title || slug
  try {
    const value = tGames(`catalog.${slug}.title`)
    if (!value || value === `catalog.${slug}.title`) return fallback
    return value
  } catch {
    return fallback
  }
}

/** Resolve catalog description via modules.games; fall back to catalog.ts EN. */
export function localizedCatalogDescription(
  tGames: GamesTranslate,
  slug: string,
): string {
  const fallback = getCatalogEntry(slug)?.description || ''
  try {
    const value = tGames(`catalog.${slug}.description`)
    if (!value || value === `catalog.${slug}.description`) return fallback
    return value
  } catch {
    return fallback
  }
}
