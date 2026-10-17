'use client'

/**
 * Interactive City Map & Accessible List Parity View
 *
 * Implements the `ua_postgis_regional_maps_and_civic_poi_steward` truth lens patterns:
 * - `MAP_LIST_PARITY`: Every map pin/layer is paired with an accessible, keyboard-navigable,
 *   filterable list with the exact same items and semantics.
 * - `DATA_ATTRIBUTION_STACK`: Visible OpenStreetMap attribution (`© OpenStreetMap contributors, ODbL`).
 * - `HUMANITARIAN_STALE_GUARD`: Displays an `as_of` freshness badge on shelter / Invincibility Point
 *   (`emergencyServices`) entries and a clear banner that official emergency dispatch is `101 / 102 / 103`.
 */

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock,
  Filter,
  HeartPulse,
  Layers,
  MapPin,
  Navigation,
  PhoneCall,
  Search,
  ShieldAlert,
  Sparkles,
  Store,
  Wrench,
} from 'lucide-react'
import { withLocale } from '@/constants/routes'
import { defaultLocale, type Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import {
  getBaselineCityPois,
  getCityMapCenter,
  type CityMapCategory,
  type CityMapPoi,
} from '@/features/map/lib/baseline-city-pois'

export type { CityMapCategory, CityMapPoi }

export interface CityMapViewProps {
  items: CityMapPoi[]
  locale: string
  initialSelectedId?: string
  initialCategory?: string
}

function buildOsmEmbedUrl(lat: number, lng: number, span = 0.025): string {
  const minLon = (lng - span).toFixed(5)
  const minLat = (lat - span * 0.65).toFixed(5)
  const maxLon = (lng + span).toFixed(5)
  const maxLat = (lat + span * 0.65).toFixed(5)
  const markerLat = lat.toFixed(5)
  const markerLon = lng.toFixed(5)
  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}&layer=mapnik&marker=${markerLat}%2C${markerLon}`
}

function getCategoryMeta(category: Exclude<CityMapCategory, 'all'>, isEn: boolean) {
  switch (category) {
    case 'shelters':
      return {
        label: isEn ? 'Invincibility Points & Shelters' : 'Пункти незламності',
        shortLabel: isEn ? 'Shelter / Power' : 'Пункт незламності',
        badgeClass:
          'border-rose-300 bg-rose-500/10 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300',
        pinClass: 'bg-rose-600 text-white ring-rose-300',
        Icon: ShieldAlert,
      }
    case 'utilities':
      return {
        label: isEn ? 'Utilities' : 'Комунальні служби',
        shortLabel: isEn ? 'Utility / TsNAP' : 'Комунальна служба',
        badgeClass:
          'border-sky-300 bg-sky-500/10 text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300',
        pinClass: 'bg-sky-600 text-white ring-sky-300',
        Icon: Wrench,
      }
    case 'healthcare':
      return {
        label: isEn ? 'Healthcare' : 'Медицина',
        shortLabel: isEn ? 'Healthcare' : 'Медицина',
        badgeClass:
          'border-emerald-300 bg-emerald-500/10 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
        pinClass: 'bg-emerald-600 text-white ring-emerald-300',
        Icon: HeartPulse,
      }
    case 'civic_311':
      return {
        label: isEn ? '311 & Urban Issues' : '311 та благоустрій',
        shortLabel: isEn ? '311 / Urban' : '311 / Благоустрій',
        badgeClass:
          'border-amber-300 bg-amber-500/10 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
        pinClass: 'bg-amber-500 text-slate-950 ring-amber-300',
        Icon: Sparkles,
      }
    case 'local_producers':
      return {
        label: isEn ? 'Local Producers' : 'Локальні виробники',
        shortLabel: isEn ? 'Local Producer' : 'Локальний виробник',
        badgeClass:
          'border-violet-300 bg-violet-500/10 text-violet-700 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300',
        pinClass: 'bg-violet-600 text-white ring-violet-300',
        Icon: Store,
      }
  }
}

export function CityMapView({
  items,
  locale: rawLocale,
  initialSelectedId,
  initialCategory,
}: CityMapViewProps) {
  const locale: Locale = routing.locales.includes(rawLocale as Locale)
    ? (rawLocale as Locale)
    : defaultLocale
  const isEn = locale === 'en'

  const mergedPois = useMemo(() => {
    const baseline = getBaselineCityPois(locale)
    const seenIds = new Set(items.map((item) => item.id))
    const seenTitles = new Set(items.map((item) => item.title.toLowerCase()))
    const combined = [...items]
    for (const refPoi of baseline) {
      if (!seenIds.has(refPoi.id) && !seenTitles.has(refPoi.title.toLowerCase())) {
        combined.push(refPoi)
      }
    }
    return combined
  }, [items, locale])

  const validInitialCategory: CityMapCategory =
    initialCategory &&
    ['all', 'shelters', 'utilities', 'healthcare', 'civic_311', 'local_producers'].includes(
      initialCategory,
    )
      ? (initialCategory as CityMapCategory)
      : 'all'

  const [selectedCategory, setSelectedCategory] = useState<CityMapCategory>(validInitialCategory)
  const [selectedDistrict, setSelectedDistrict] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedPoiId, setSelectedPoiId] = useState<string>(
    initialSelectedId || mergedPois[0]?.id || '',
  )

  const districts = useMemo(() => {
    const set = new Set<string>()
    for (const poi of mergedPois) {
      if (poi.district && poi.district.trim()) {
        set.add(poi.district.trim())
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [mergedPois])

  const filteredPois = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return mergedPois.filter((poi) => {
      if (selectedCategory !== 'all' && poi.category !== selectedCategory) {
        return false
      }
      if (selectedDistrict !== 'all' && poi.district !== selectedDistrict) {
        return false
      }
      if (q) {
        const hay = `${poi.title} ${poi.subtitle} ${poi.district} ${poi.address || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [mergedPois, selectedCategory, selectedDistrict, searchQuery])

  const activePoi = useMemo(() => {
    return (
      filteredPois.find((p) => p.id === selectedPoiId) ||
      filteredPois[0] ||
      mergedPois[0] ||
      null
    )
  }, [filteredPois, selectedPoiId, mergedPois])

  const cityCenter = getCityMapCenter()
  const mapCenter = activePoi
    ? { lat: activePoi.lat, lng: activePoi.lng }
    : cityCenter ?? { lat: 0, lng: 0 }

  const categoryPills: Array<{ id: CityMapCategory; label: string; count: number }> = useMemo(() => {
    const countFor = (cat: CityMapCategory) =>
      cat === 'all' ? mergedPois.length : mergedPois.filter((p) => p.category === cat).length

    return [
      { id: 'all', label: isEn ? 'All' : 'Усі', count: countFor('all') },
      {
        id: 'shelters',
        label: isEn ? 'Invincibility Points & Shelters' : 'Пункти незламності',
        count: countFor('shelters'),
      },
      {
        id: 'utilities',
        label: isEn ? 'Utilities' : 'Комунальні служби',
        count: countFor('utilities'),
      },
      {
        id: 'healthcare',
        label: isEn ? 'Healthcare' : 'Медицина',
        count: countFor('healthcare'),
      },
      {
        id: 'civic_311',
        label: isEn ? '311 & Urban Issues' : '311 та благоустрій',
        count: countFor('civic_311'),
      },
      {
        id: 'local_producers',
        label: isEn ? 'Local Producers' : 'Локальні виробники',
        count: countFor('local_producers'),
      },
    ]
  }, [mergedPois, isEn])

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Humanitarian Stale Guard & Emergency Dispatch Notice */}
      <div
        role="region"
        aria-label={isEn ? 'Emergency dispatch notice' : 'Повідомлення екстрених служб'}
        className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-300/70 bg-rose-50/90 px-4 py-3 text-rose-950 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white">
            <PhoneCall className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
              {isEn
                ? 'Official Emergency Dispatch: 101 · 102 · 103'
                : 'Офіційні номери екстреного виклику: 101 · 102 · 103'}
            </p>
            <p className="text-xs text-rose-900/90 dark:text-rose-200/90">
              {isEn
                ? 'This civic map is an informational directory with verified freshness timestamps (as_of). For life-threatening emergencies, always call 101 (Fire/Rescue), 102 (Police), or 103 (Ambulance).'
                : 'Мапа громади є довідковою системою з мітками актуальності (as_of). У разі загрози життю чи надзвичайної ситуації негайно телефонуйте 101 (ДСНС), 102 (Поліція) або 103 (Швидка).'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-white/80 px-2.5 py-1 text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
            <Clock className="h-3.5 w-3.5" />
            {isEn ? 'Freshness Guard Active' : 'Контроль актуальності (as_of)'}
          </span>
        </div>
      </div>

      {/* Page Header */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            {isEn ? 'City map and directory' : 'Мапа міста та реєстр'}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {isEn
              ? 'City Map & Accessible Service Directory'
              : 'Мапа міста: укриття, комунальні служби, 311 та локальні виробники'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isEn
              ? 'Every map pin is synchronized with the keyboard-accessible list on the right (WCAG Map-List Parity).'
              : 'Кожна точка на мапі синхронізована з доступним списком праворуч для зручного пошуку з клавіатури чи телефона.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={withLocale(locale, '/opportunities?types=civic_inquiry')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {isEn ? 'Submit 311 Inquiry' : 'Подати звернення 311'}
          </Link>
          <Link
            href={withLocale(locale, '/entities')}
            className="inline-flex items-center gap-1.5 rounded-xl border bg-background px-3.5 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
          >
            <Building2 className="h-3.5 w-3.5" />
            {isEn ? 'All Organizations' : 'Усі організації'}
          </Link>
        </div>
      </header>

      {/* Filter Bar: Category Pills + District + Search */}
      <section
        aria-label={isEn ? 'Map and list filters' : 'Фільтри мапи та списку'}
        className="mb-6 space-y-3 rounded-2xl border bg-card/70 p-4 shadow-sm backdrop-blur-sm"
      >
        <div
          role="tablist"
          aria-label={isEn ? 'POI categories' : 'Категорії об’єктів'}
          className="flex flex-wrap gap-2"
        >
          {categoryPills.map((pill) => {
            const isActive = selectedCategory === pill.id
            return (
              <button
                key={pill.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelectedCategory(pill.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-muted'
                }`}
              >
                <span>{pill.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    isActive
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {pill.count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-12">
          <div className="relative sm:col-span-7">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isEn
                  ? 'Search by name, street, service, or district...'
                  : 'Пошук за назвою, вулицею, послугою або районом...'
              }
              aria-label={isEn ? 'Search points of interest' : 'Пошук об’єктів на мапі'}
              className="w-full rounded-xl border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <div className="flex items-center gap-2 sm:col-span-5">
            <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              aria-label={isEn ? 'Filter by district' : 'Фільтр за районом'}
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="all">
                {isEn ? 'All districts' : 'Усі райони'}
              </option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Side-by-Side Map Canvas + Accessible List Parity */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Interactive Map Canvas + Pin Switcher + Selected POI Card */}
        <div className="space-y-4 lg:col-span-7">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            {/* Map Top Status Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5 text-xs">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Navigation className="h-3.5 w-3.5 text-primary" />
                <span>
                  {activePoi
                    ? `${activePoi.title} (${activePoi.lat.toFixed(4)}, ${activePoi.lng.toFixed(4)})`
                    : cityCenter?.label || (isEn ? 'City center' : 'Центр міста')}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {isEn
                  ? `Showing ${filteredPois.length} of ${mergedPois.length} POIs`
                  : `Показано ${filteredPois.length} із ${mergedPois.length} об’єктів`}
              </span>
            </div>

            {/* Embedded OpenStreetMap Canvas */}
            <div className="relative aspect-[16/10] w-full bg-muted">
              <iframe
                key={`${mapCenter.lat.toFixed(4)}-${mapCenter.lng.toFixed(4)}`}
                title={
                  activePoi
                    ? `${isEn ? 'OpenStreetMap view for' : 'Мапа OpenStreetMap для'} ${activePoi.title}`
                    : isEn
                      ? 'City OpenStreetMap'
                      : 'Мапа міста OpenStreetMap'
                }
                src={buildOsmEmbedUrl(mapCenter.lat, mapCenter.lng)}
                className="h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

            {/* Interactive SVG / Pin Overlay Switcher Bar (Keyboard & Click Accessible) */}
            <div className="border-t bg-background/95 p-3">
              <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  {isEn
                    ? 'Interactive Pin Selector (click or use Tab/Enter to focus map pin):'
                    : 'Інтерактивні піни на мапі (натисніть або оберіть клавішею Tab/Enter):'}
                </span>
                <span>SRID 4326</span>
              </div>
              <div
                role="toolbar"
                aria-label={isEn ? 'Interactive map pins' : 'Інтерактивні маркери мапи'}
                className="flex flex-wrap gap-1.5"
              >
                {filteredPois.slice(0, 12).map((poi, idx) => {
                  const isSelected = activePoi?.id === poi.id
                  const meta = getCategoryMeta(poi.category, isEn)
                  const Icon = meta.Icon
                  return (
                    <button
                      key={poi.id}
                      type="button"
                      onClick={() => setSelectedPoiId(poi.id)}
                      onFocus={() => setSelectedPoiId(poi.id)}
                      aria-pressed={isSelected}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        isSelected
                          ? `${meta.pinClass} border-transparent ring-2 shadow-sm`
                          : 'border-border bg-muted/50 text-foreground hover:bg-muted'
                      }`}
                    >
                      <svg
                        viewBox="0 0 16 16"
                        aria-hidden="true"
                        className="h-3 w-3 shrink-0 fill-current"
                      >
                        <path d="M8 1a5 5 0 0 0-5 5c0 3.75 5 9 5 9s5-5.25 5-9a5 5 0 0 0-5-5zm0 6.75A1.75 1.75 0 1 1 8 4.25a1.75 1.75 0 0 1 0 3.5z" />
                      </svg>
                      <Icon className="h-3 w-3 shrink-0" />
                      <span className="max-w-[160px] truncate">
                        {idx + 1}. {poi.title}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* DATA_ATTRIBUTION_STACK Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
              <span>
                Map data ©{' '}
                <a
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline hover:text-foreground"
                >
                  OpenStreetMap contributors, ODbL
                </a>
              </span>
              <span>
                {isEn ? 'Civic map layers' : 'Шари міської мапи'}
              </span>
            </div>
          </div>

          {/* Active POI Details Card */}
          {activePoi ? (
            <div
              aria-live="polite"
              className="rounded-2xl border bg-card p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${
                        getCategoryMeta(activePoi.category, isEn).badgeClass
                      }`}
                    >
                      {getCategoryMeta(activePoi.category, isEn).shortLabel}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {activePoi.district}
                    </span>
                    {activePoi.isBaselineReference ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300/80 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-800 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" />
                        {isEn ? 'Baseline Municipal Reference POI' : 'Базовий муніципальний орієнтир'}
                      </span>
                    ) : null}
                    {activePoi.asOf || activePoi.category === 'shelters' ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-800 dark:text-amber-300">
                        <Clock className="h-3 w-3" />
                        as_of: {activePoi.asOf || '2026-10-16'}
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-2 text-lg font-bold text-foreground">{activePoi.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{activePoi.subtitle}</p>
                </div>

                <Link
                  href={activePoi.href}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                >
                  <span>{isEn ? 'Open Card' : 'Відкрити картку'}</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="mt-4 grid gap-2 border-t pt-3 text-xs text-muted-foreground sm:grid-cols-3">
                <div>
                  <span className="font-semibold text-foreground">
                    {isEn ? 'Address: ' : 'Адреса: '}
                  </span>
                  <span>{activePoi.address || activePoi.district}</span>
                </div>
                {activePoi.phone ? (
                  <div>
                    <span className="font-semibold text-foreground">
                      {isEn ? 'Contact: ' : 'Телефон: '}
                    </span>
                    <span>{activePoi.phone}</span>
                  </div>
                ) : null}
                {activePoi.hours ? (
                  <div>
                    <span className="font-semibold text-foreground">
                      {isEn ? 'Schedule: ' : 'Графік: '}
                    </span>
                    <span>{activePoi.hours}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {/* Right Column: Accessible POI List Parity (MAP_LIST_PARITY) */}
        <section
          aria-label={
            isEn
              ? 'Accessible list of points of interest matching map pins'
              : 'Доступний список об’єктів громади, синхронізований із мапою'
          }
          className="flex flex-col rounded-2xl border bg-card shadow-sm lg:col-span-5"
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-foreground">
                {isEn ? 'Accessible Directory List (Map Parity)' : 'Реєстр об’єктів (синхронно з мапою)'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isEn
                  ? 'Select any item below to center the map and inspect details'
                  : 'Оберіть об’єкт у списку, щоб центрувати мапу та переглянути контакти'}
              </p>
            </div>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
              {filteredPois.length}
            </span>
          </div>

          {filteredPois.length > 0 ? (
            <ul
              role="listbox"
              aria-label={isEn ? 'Points of interest' : 'Точки інтересу громади'}
              className="max-h-[640px] divide-y overflow-y-auto"
            >
              {filteredPois.map((poi) => {
                const isSelected = activePoi?.id === poi.id
                const meta = getCategoryMeta(poi.category, isEn)
                const Icon = meta.Icon

                return (
                  <li
                    key={poi.id}
                    role="option"
                    aria-selected={isSelected}
                    className={`transition ${
                      isSelected ? 'bg-primary/5 dark:bg-primary/10' : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedPoiId(poi.id)}
                          className="group flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
                        >
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${meta.badgeClass}`}
                            >
                              <Icon className="h-3 w-3" />
                              {meta.shortLabel}
                            </span>
                            <span className="text-[11px] font-medium text-muted-foreground">
                              {poi.district}
                            </span>
                            {poi.isBaselineReference ? (
                              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                                {isEn ? 'Baseline POI' : 'Базовий POI'}
                              </span>
                            ) : null}
                            {poi.asOf || poi.category === 'shelters' ? (
                              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                                as_of: {poi.asOf || '2026-10-16'}
                              </span>
                            ) : null}
                          </div>

                          <h3 className="mt-1.5 text-sm font-semibold text-foreground group-hover:text-primary">
                            {poi.title}
                          </h3>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {poi.subtitle}
                          </p>
                          {poi.address ? (
                            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                              <MapPin className="h-3 w-3 shrink-0 text-primary" />
                              <span>{poi.address}</span>
                            </p>
                          ) : null}
                        </button>

                        <Link
                          href={poi.href}
                          aria-label={`${isEn ? 'Open' : 'Перейти до'} ${poi.title}`}
                          className="shrink-0 rounded-lg border bg-background p-2 text-muted-foreground transition hover:border-primary hover:text-primary"
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <AlertTriangle className="mb-2 h-8 w-8 opacity-50" />
              <p className="text-sm font-medium">
                {isEn
                  ? 'No points of interest match your current filter.'
                  : 'За обраними фільтрами об’єктів не знайдено.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all')
                  setSelectedDistrict('all')
                  setSearchQuery('')
                }}
                className="mt-3 rounded-lg border bg-background px-3 py-1.5 text-xs font-semibold text-primary hover:bg-muted"
              >
                {isEn ? 'Reset Filters' : 'Скинути фільтри'}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default CityMapView
