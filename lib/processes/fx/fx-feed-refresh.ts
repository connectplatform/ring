/**
 * FX feed refresh pipeline — warm NBU / open.er-api overlay from ring-config.fx SSOT.
 *
 * Provider selection: byMainCurrency[main] → UAH→nbu → fx.default (open_er_api).
 * Staleness is gated by refreshHours inside refreshFxFeed; cron may run hourly.
 */

import 'server-only'

import {
  getFxOverlayFetchedAt,
  getMainCurrencySymbol,
  refreshFxFeed,
  resolveFxFeedConfig,
} from '@/lib/ring-oracle'
import { logger } from '@/lib/logger'

export async function runFxFeedRefresh(): Promise<{
  success: boolean
  skipped?: boolean
  reason?: string
  provider?: string
  mainCurrency?: string
  fetchedAt?: string | null
  rateCount?: number
  refreshHours?: number
}> {
  const mainCurrency = getMainCurrencySymbol()
  const cfg = resolveFxFeedConfig(mainCurrency)

  if (cfg.enabled === false) {
    return {
      success: true,
      skipped: true,
      reason: 'fx_feed_disabled',
      provider: cfg.provider,
      mainCurrency,
      refreshHours: cfg.refreshHours,
    }
  }

  const cache = await refreshFxFeed(true)
  const fetchedAt = cache?.fetchedAt ?? getFxOverlayFetchedAt()
  const rateCount = cache?.rates ? Object.keys(cache.rates).length : 0

  logger.info('FX feed refresh complete', {
    provider: cache?.provider ?? cfg.provider,
    mainCurrency,
    fetchedAt,
    rateCount,
    refreshHours: cfg.refreshHours,
  })

  return {
    success: true,
    provider: cache?.provider ?? cfg.provider,
    mainCurrency: cache?.mainCurrency ?? mainCurrency,
    fetchedAt,
    rateCount,
    refreshHours: cfg.refreshHours,
  }
}
