import 'server-only'

/**
 * Fiat FX feed service — rates relative to store.mainCurrency.
 *
 * Provider selection (ring-config.fx):
 * 1. byMainCurrency[main]
 * 2. else if main === 'UAH' → nbu
 * 3. else default → open_er_api (global free FX; XE.com has no free commercial API)
 *
 * Manual overrides in fx.manualOverrides always win in getExchangeRates.
 */

import { db } from '@/lib/database'
import { logger } from '@/lib/logger'
import {
  getMainCurrencySymbol,
  getSystemConfigSnapshot,
} from '@/lib/ring-config-core'
import type { FxFeedProviderConfig, FxFeedProviderId } from '@/lib/ring-config-types'
import {
  getFxOverlayFetchedAt,
  getFxOverlayMeta,
  getFxOverlayRates,
  setFxOverlayRates,
} from '@/lib/fx/fx-rates-overlay'

/** Persist via platform_settings hybrid JSONB (same pattern as web3 desk oracle). */
const FX_CACHE_COLLECTION = 'platform_settings'
const FX_CACHE_DOC_ID = 'fx_feed'

const FX_CACHE_META_KEYS = new Set([
  'id',
  'secrets',
  'updatedBy',
  'updated_by',
  'updatedAt',
  'updated_at',
  'createdAt',
  'created_at',
  'version',
])

export type FxFeedCache = {
  provider: FxFeedProviderId
  mainCurrency: string
  fetchedAt: string
  /** Rates relative to main currency (main = 1). */
  rates: Record<string, number>
  /** Optional provider-specific raw payload for audit. */
  sourceMeta?: Record<string, unknown>
}

type NbuRow = { r030?: number; txt?: string; rate?: number; cc?: string; exchangedate?: string }

export function getMemoryFxFeedRates(): Record<string, number> | null {
  return getFxOverlayRates()
}

export function getMemoryFxFetchedAt(): string | null {
  return getFxOverlayFetchedAt()
}

function fxConfig() {
  return getSystemConfigSnapshot().fx
}

/**
 * Resolve which feed applies for the current (or given) main currency.
 * NBU is only selected for UAH — never for USD/EUR/etc.
 */
export function resolveFxFeedConfig(
  mainCurrency = getMainCurrencySymbol(),
): FxFeedProviderConfig {
  const fx = fxConfig()
  const main = String(mainCurrency || '').toUpperCase()
  const byMain = fx?.byMainCurrency?.[main] ?? fx?.byMainCurrency?.[mainCurrency]

  let resolved: FxFeedProviderConfig
  if (byMain?.provider) {
    resolved = {
      provider: byMain.provider,
      enabled: byMain.enabled,
      refreshHours: byMain.refreshHours,
    }
  } else if (main === 'UAH') {
    resolved = {
      provider: 'nbu',
      enabled: fx?.default?.enabled ?? fx?.feed?.enabled,
      refreshHours: fx?.default?.refreshHours ?? fx?.feed?.refreshHours,
    }
  } else if (fx?.default?.provider) {
    resolved = {
      provider: fx.default.provider,
      enabled: fx.default.enabled,
      refreshHours: fx.default.refreshHours,
    }
  } else if (fx?.feed?.provider && fx.feed.provider !== 'nbu') {
    // Legacy flat feed — honor non-NBU providers as global default.
    resolved = {
      provider: fx.feed.provider,
      enabled: fx.feed.enabled,
      refreshHours: fx.feed.refreshHours,
    }
  } else {
    resolved = {
      provider: 'open_er_api',
      enabled: fx?.default?.enabled ?? fx?.feed?.enabled,
      refreshHours: fx?.default?.refreshHours ?? fx?.feed?.refreshHours,
    }
  }

  // Hard guard: NBU quotes in UAH — refuse for any other main.
  if (resolved.provider === 'nbu' && main !== 'UAH') {
    logger.warn('FX feed: nbu requested but mainCurrency is not UAH — falling back to open_er_api', {
      main,
    })
    resolved = {
      ...resolved,
      provider: 'open_er_api',
    }
  }

  return {
    provider: resolved.provider,
    enabled: resolved.enabled !== false,
    refreshHours:
      typeof resolved.refreshHours === 'number' && resolved.refreshHours > 0
        ? resolved.refreshHours
        : 24,
  }
}

function isFeedEnabled(cfg = resolveFxFeedConfig()): boolean {
  return cfg.enabled !== false
}

function isStale(
  fetchedAt: string | null | undefined,
  refreshHours: number,
): boolean {
  if (!fetchedAt) return true
  const ageMs = Date.now() - new Date(fetchedAt).getTime()
  return !Number.isFinite(ageMs) || ageMs > refreshHours * 3600_000
}

function cacheMatches(
  cache: FxFeedCache | null,
  provider: FxFeedProviderId,
  main: string,
): boolean {
  if (!cache) return false
  return (
    cache.provider === provider &&
    String(cache.mainCurrency || '').toUpperCase() === main.toUpperCase()
  )
}

/** NBU JSON: rate = UAH per 1 unit of `cc`. Only valid when main === UAH. */
async function fetchNbuRatesForUahMain(): Promise<{
  rates: Record<string, number>
  sourceMeta: Record<string, unknown>
}> {
  const res = await fetch(
    'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json',
    { next: { revalidate: 0 } },
  )
  if (!res.ok) throw new Error(`NBU FX feed HTTP ${res.status}`)
  const rows = (await res.json()) as NbuRow[]
  const uahPerUnit: Record<string, number> = { UAH: 1 }
  for (const row of rows) {
    const cc = String(row.cc || '').toUpperCase()
    const rate = Number(row.rate)
    if (!cc || !Number.isFinite(rate) || rate <= 0) continue
    uahPerUnit[cc] = rate
  }
  // main = UAH → rates[cc] = units of cc per 1 UAH = 1 / uahPerUnit[cc]
  const rates: Record<string, number> = { UAH: 1 }
  for (const [cc, uah] of Object.entries(uahPerUnit)) {
    if (cc === 'UAH') continue
    rates[cc] = 1 / uah
  }
  return { rates, sourceMeta: { uahPerUnit } }
}

/**
 * open.er-api.com — free global FX (ExchangeRate-API open access).
 * Response rates[cc] = units of cc per 1 base — already main-relative when base=main.
 */
async function fetchOpenErApiRates(main: string): Promise<{
  rates: Record<string, number>
  sourceMeta: Record<string, unknown>
}> {
  const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(main)}`, {
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`open.er-api FX feed HTTP ${res.status}`)
  const body = (await res.json()) as {
    result?: string
    base_code?: string
    rates?: Record<string, number>
    time_last_update_utc?: string
    provider?: string
  }
  if (body.result !== 'success' || !body.rates) {
    throw new Error(`open.er-api FX feed failed: ${body.result ?? 'no rates'}`)
  }
  const rates: Record<string, number> = { [main]: 1 }
  for (const [cc, value] of Object.entries(body.rates)) {
    const code = cc.toUpperCase()
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      rates[code] = value
    }
  }
  rates[main] = 1
  return {
    rates,
    sourceMeta: {
      provider: body.provider,
      base_code: body.base_code,
      time_last_update_utc: body.time_last_update_utc,
    },
  }
}

/**
 * Frankfurter (ECB-backed). No UAH — use only when presentment pool does not need UAH.
 * rates[cc] = units of cc per 1 base.
 */
async function fetchFrankfurterRates(main: string): Promise<{
  rates: Record<string, number>
  sourceMeta: Record<string, unknown>
}> {
  const res = await fetch(
    `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(main)}`,
    { next: { revalidate: 0 } },
  )
  if (!res.ok) throw new Error(`Frankfurter FX feed HTTP ${res.status}`)
  const body = (await res.json()) as {
    base?: string
    date?: string
    rates?: Record<string, number>
  }
  if (!body.rates) throw new Error('Frankfurter FX feed: no rates')
  const rates: Record<string, number> = { [main]: 1 }
  for (const [cc, value] of Object.entries(body.rates)) {
    const code = cc.toUpperCase()
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      rates[code] = value
    }
  }
  rates[main] = 1
  return { rates, sourceMeta: { base: body.base, date: body.date } }
}

async function fetchProviderRates(
  provider: FxFeedProviderId,
  main: string,
): Promise<{ rates: Record<string, number>; sourceMeta: Record<string, unknown> }> {
  switch (provider) {
    case 'nbu':
      return fetchNbuRatesForUahMain()
    case 'frankfurter':
      return fetchFrankfurterRates(main)
    case 'open_er_api':
    default:
      return fetchOpenErApiRates(main)
  }
}

function extractFxCache(row: Record<string, unknown>): FxFeedCache | null {
  const payload = Object.fromEntries(
    Object.entries(row).filter(([key]) => !FX_CACHE_META_KEYS.has(key)),
  ) as Partial<FxFeedCache>
  if (
    typeof payload.provider !== 'string' ||
    typeof payload.mainCurrency !== 'string' ||
    typeof payload.fetchedAt !== 'string' ||
    !payload.rates ||
    typeof payload.rates !== 'object'
  ) {
    return null
  }
  return {
    provider: payload.provider as FxFeedProviderId,
    mainCurrency: payload.mainCurrency,
    fetchedAt: payload.fetchedAt,
    rates: payload.rates as Record<string, number>,
    sourceMeta:
      payload.sourceMeta && typeof payload.sourceMeta === 'object'
        ? (payload.sourceMeta as Record<string, unknown>)
        : undefined,
  }
}

async function readPersistedCache(): Promise<FxFeedCache | null> {
  try {
    const result = await db().readDoc<Record<string, unknown>>(
      FX_CACHE_COLLECTION,
      FX_CACHE_DOC_ID,
    )
    if (!result.success || !result.data) return null
    return extractFxCache(result.data as Record<string, unknown>)
  } catch {
    return null
  }
}

async function writePersistedCache(cache: FxFeedCache): Promise<void> {
  const payload = {
    ...cache,
    updatedBy: 'fx-feed-refresh',
  }
  const existing = await db().readDoc(FX_CACHE_COLLECTION, FX_CACHE_DOC_ID)
  if (existing.success && existing.data) {
    const updated = await db().updateDoc(FX_CACHE_COLLECTION, FX_CACHE_DOC_ID, payload)
    if (!updated.success) throw updated.error || new Error('FX cache update failed')
    return
  }
  const created = await db().createDoc(FX_CACHE_COLLECTION, payload, { id: FX_CACHE_DOC_ID })
  if (!created.success) throw created.error || new Error('FX cache create failed')
}

/** Force-refresh the resolved feed for current main currency and persist. */
export async function refreshFxFeed(force = false): Promise<FxFeedCache | null> {
  const cfg = resolveFxFeedConfig()
  if (!isFeedEnabled(cfg) && !force) return null

  const main = getMainCurrencySymbol()
  const existing = await readPersistedCache()
  if (
    !force &&
    cacheMatches(existing, cfg.provider, main) &&
    existing &&
    !isStale(existing.fetchedAt, cfg.refreshHours ?? 24)
  ) {
    setFxOverlayRates(existing.rates, existing.fetchedAt, {
      provider: existing.provider,
      mainCurrency: existing.mainCurrency,
    })
    return existing
  }

  try {
    const { rates, sourceMeta } = await fetchProviderRates(cfg.provider, main)
    const cache: FxFeedCache = {
      provider: cfg.provider,
      mainCurrency: main,
      fetchedAt: new Date().toISOString(),
      rates,
      sourceMeta,
    }
    setFxOverlayRates(rates, cache.fetchedAt, {
      provider: cfg.provider,
      mainCurrency: main,
    })
    try {
      await writePersistedCache(cache)
    } catch (err) {
      logger.warn('FX feed: persist failed (memory still updated)', { error: err })
    }
    logger.info('FX feed refreshed', {
      provider: cfg.provider,
      main,
      codes: Object.keys(rates).length,
    })
    return cache
  } catch (error) {
    logger.error('FX feed refresh failed', { error, provider: cfg.provider, main })
    if (existing && cacheMatches(existing, cfg.provider, main)) {
      setFxOverlayRates(existing.rates, existing.fetchedAt, {
        provider: existing.provider,
        mainCurrency: existing.mainCurrency,
      })
      return existing
    }
    return null
  }
}

/** Ensure memory overlay is warm; refresh if stale. Safe to call from payment paths. */
export async function ensureFxFeedFresh(): Promise<void> {
  const cfg = resolveFxFeedConfig()
  if (!isFeedEnabled(cfg)) return

  const main = getMainCurrencySymbol()
  const meta = getFxOverlayMeta()
  if (
    getFxOverlayRates() &&
    meta?.provider === cfg.provider &&
    meta.mainCurrency.toUpperCase() === main.toUpperCase() &&
    !isStale(getFxOverlayFetchedAt(), cfg.refreshHours ?? 24)
  ) {
    return
  }

  const persisted = await readPersistedCache()
  if (
    persisted &&
    cacheMatches(persisted, cfg.provider, main) &&
    !isStale(persisted.fetchedAt, cfg.refreshHours ?? 24)
  ) {
    setFxOverlayRates(persisted.rates, persisted.fetchedAt, {
      provider: persisted.provider,
      mainCurrency: persisted.mainCurrency,
    })
    return
  }
  await refreshFxFeed(false)
}
