import type { Metadata } from 'next'
import { connection } from 'next/server'
import { setRequestLocale } from 'next-intl/server'
import { getDatabaseService, initializeDatabase, unwrapDbQueryRow } from '@/lib/database'
import { withLocale } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import { defaultLocale, type Locale } from '@/i18n/shared'
import { CityMapView } from '@/features/map/components/city-map-view'
import {
  getBaselineCityPois,
  getCityDistrictAliases,
  getCityDistrictCoordinates,
  getCityMapCenter,
  type CityMapCategory,
  type CityMapPoi,
} from '@/features/map/lib/baseline-city-pois'
import { logger } from '@/lib/logger'


function inferDistrict(text: string): string {
  const lower = text.toLowerCase()
  for (const entry of getCityDistrictAliases()) {
    if (entry.aliases.some((alias) => lower.includes(alias))) return entry.canonical
  }
  return ''
}

function extractCoordinates(
  row: Record<string, unknown>,
  district: string,
  indexOffset: number,
): { lat: number; lng: number } | null {
  const geo = row.geo as { lat?: unknown; lng?: unknown } | undefined
  const metaCoords = (row.metadata as { coordinates?: { lat?: unknown; lng?: unknown } } | undefined)
    ?.coordinates
  const nicheCoords = (
    row.nicheData as { city?: { coordinates?: { lat?: unknown; lng?: unknown } } } | undefined
  )?.city?.coordinates
  const cityMetaCoords = (
    row.cityMetadata as { coordinates?: { lat?: unknown; lng?: unknown } } | undefined
  )?.coordinates

  const candidate = geo || metaCoords || nicheCoords || cityMetaCoords
  if (
    candidate &&
    typeof candidate.lat === 'number' &&
    typeof candidate.lng === 'number' &&
    !Number.isNaN(candidate.lat) &&
    !Number.isNaN(candidate.lng)
  ) {
    return { lat: candidate.lat, lng: candidate.lng }
  }

  const districts = getCityDistrictCoordinates()
  const base = districts[district] || getCityMapCenter()
  if (!base) return null
  // Deterministic micro-offset so multiple district items remain distinct on the map
  const jitterLat = ((indexOffset % 5) - 2) * 0.0012
  const jitterLng = (((indexOffset * 3) % 5) - 2) * 0.0015
  return {
    lat: Number((base.lat + jitterLat).toFixed(5)),
    lng: Number((base.lng + jitterLng).toFixed(5)),
  }
}

function mapEntityToCategory(rawType: string): Exclude<CityMapCategory, 'all'> {
  const t = rawType.toLowerCase()
  if (t.includes('emergency') || t.includes('shelter') || t.includes('invincib')) {
    return 'shelters'
  }
  if (t.includes('hospital') || t.includes('clinic') || t.includes('pharmac') || t.includes('health')) {
    return 'healthcare'
  }
  if (
    t.includes('producer') ||
    t.includes('artisan') ||
    t.includes('agriculture') ||
    t.includes('food')
  ) {
    return 'local_producers'
  }
  if (t.includes('utility') || t.includes('government') || t.includes('transport')) {
    return 'utilities'
  }
  return 'utilities'
}

async function queryPublicCollection(
  collection: string,
  limit: number,
): Promise<Array<Record<string, unknown> & { id: string }>> {
  try {
    const db = getDatabaseService()
    const res = await db.query({
      collection,
      filters: [],
      pagination: { limit },
    })
    if (!res.success || !Array.isArray(res.data)) {
      return []
    }
    return res.data.map((row) => unwrapDbQueryRow<Record<string, unknown>>(row))
  } catch (error) {
    logger.warn(`map/page: failed to query ${collection}`, {
      error: error instanceof Error ? error.message : String(error),
    })
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale: Locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : defaultLocale
  setRequestLocale(locale)

  const isEn = locale === 'en'
  return {
    title: isEn ? 'City map and civic directory' : 'Мапа міста та довідник громади',
    description: isEn
      ? 'City map with a matching list: shelters, utilities, healthcare, civic requests, and local producers.'
      : 'Мапа міста зі списком: укриття, комунальні служби, медицина, звернення та локальні виробники.',
  }
}

export default async function CityMapPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ poi?: string; category?: string }>
}) {
  await connection()

  const { locale: localeParam } = await params
  const resolvedSearchParams = await searchParams
  const locale: Locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : defaultLocale
  setRequestLocale(locale)

  await initializeDatabase()

  const [entitiesRows, opportunitiesRows, productsRows] = await Promise.all([
    queryPublicCollection('entities', 60),
    queryPublicCollection('opportunities', 60),
    queryPublicCollection('store_products', 60),
  ])

  const livePois: CityMapPoi[] = []
  let idx = 0

  // 1. Entities -> POIs
  for (const row of entitiesRows) {
    if (!row.id) continue
    if (row.isConfidential === true || row.visibility === 'confidential') continue
    if (row.moderationStatus === 'blocked') continue
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    if (!name) continue

    const shortDesc = typeof row.shortDescription === 'string' ? row.shortDescription.trim() : ''
    const rawType = typeof row.type === 'string' ? row.type : 'localGovernment'
    const location = typeof row.location === 'string' ? row.location.trim() : ''
    const metaDistrict = (row.metadata as { district?: string } | undefined)?.district
    const district =
      (typeof metaDistrict === 'string' && metaDistrict.trim()) ||
      inferDistrict(`${name} ${shortDesc} ${location}`)
    const coords = extractCoordinates(row, district, idx++)
    if (!coords) continue
    const category = mapEntityToCategory(rawType)
    const updatedStr =
      typeof row.lastUpdated === 'string' ? row.lastUpdated.slice(0, 10) : '2026-10-16'

    livePois.push({
      id: `entity-${row.id}`,
      title: name,
      subtitle: shortDesc || location,
      category,
      rawType,
      sourceKind: 'entity',
      district,
      address: location || undefined,
      lat: coords.lat,
      lng: coords.lng,
      href: withLocale(locale, `/entities/${row.id}`),
      asOf: category === 'shelters' || category === 'healthcare' ? updatedStr : undefined,
      phone: typeof row.phoneNumber === 'string' ? row.phoneNumber : undefined,
      verified: row.verificationStatus === 'verified',
    })
  }

  // 2. Opportunities -> 311 & Urban Issues / Shelters POIs
  for (const row of opportunitiesRows) {
    if (!row.id) continue
    if (row.isConfidential === true || row.visibility === 'confidential') continue
    const status = typeof row.status === 'string' ? row.status : 'active'
    if (status === 'archived' || status === 'closed' || status === 'expired') continue

    const title = typeof row.title === 'string' ? row.title.trim() : ''
    if (!title) continue
    const brief = typeof row.briefDescription === 'string' ? row.briefDescription.trim() : ''
    const rawType = typeof row.type === 'string' ? row.type : 'civic_inquiry'
    const location = typeof row.location === 'string' ? row.location.trim() : ''
    const metaDistrict = (row.metadata as { district?: string } | undefined)?.district
    const district =
      (typeof metaDistrict === 'string' && metaDistrict.trim()) ||
      inferDistrict(`${title} ${brief} ${location}`)
    const coords = extractCoordinates(row, district, idx++)
    if (!coords) continue

    livePois.push({
      id: `opp-${row.id}`,
      title,
      subtitle: brief.slice(0, 160) || location,
      category: 'civic_311',
      rawType,
      sourceKind: 'opportunity',
      district,
      address: location || undefined,
      lat: coords.lat,
      lng: coords.lng,
      href: withLocale(locale, `/opportunities/${row.id}`),
    })
  }

  // 3. Store Products -> Local Producers / City Services POIs
  for (const row of productsRows) {
    if (!row.id) continue
    const status = typeof row.status === 'string' ? row.status : 'active'
    if (status !== 'active') continue

    const name =
      (typeof row.name === 'string' && row.name.trim()) ||
      (typeof row.title === 'string' && row.title.trim()) ||
      ''
    if (!name) continue
    const desc = typeof row.description === 'string' ? row.description.trim() : ''
    const nicheCity = (
      row.nicheData as {
        city?: { district?: string; address?: string; categoryKey?: string }
      } | undefined
    )?.city
    const district =
      (typeof nicheCity?.district === 'string' && nicheCity.district.trim()) ||
      inferDistrict(`${name} ${desc}`)
    const coords = extractCoordinates(row, district, idx++)
    if (!coords) continue

    livePois.push({
      id: `prod-${row.id}`,
      title: name,
      subtitle: desc.slice(0, 160),
      category: 'local_producers',
      rawType: nicheCity?.categoryKey || (typeof row.category === 'string' ? row.category : 'local_producers'),
      sourceKind: 'product',
      district,
      address: nicheCity?.address,
      lat: coords.lat,
      lng: coords.lng,
      href: withLocale(locale, `/store/${row.id}`),
    })
  }

  const allPois = [...livePois, ...getBaselineCityPois(locale)]

  return (
    <CityMapView
      items={allPois}
      locale={locale}
      initialSelectedId={resolvedSearchParams.poi}
      initialCategory={resolvedSearchParams.category}
    />
  )
}
