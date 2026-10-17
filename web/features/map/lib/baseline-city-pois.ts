/**
 * L1 socket. A city overlay overwrites this file with its own pins and districts.
 * Community Layer 1 returns an empty city.
 */
import type { BaselineNeedMatch, CityMapCenter, CityMapPoi } from '@/features/map/lib/city-map-types'

export type {
  BaselineNeedMatch,
  CityMapCategory,
  CityMapCenter,
  CityMapPoi,
} from '@/features/map/lib/city-map-types'

export function getBaselineCityPois(_locale: string): CityMapPoi[] {
  return []
}

export function getCityMapCenter(): CityMapCenter | null {
  return null
}

export function getCityDistrictCoordinates(): Record<string, { lat: number; lng: number }> {
  return {}
}

export function getCityDistrictAliases(): Array<{ canonical: string; aliases: string[] }> {
  return []
}

export function getBaselineNeedMatches(_locale: string): BaselineNeedMatch[] {
  return []
}
