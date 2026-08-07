/**
 * Process-local FX overlay shared by ring-config-core (client+server) and the
 * server-only feed service. Not a persistence layer — feed service owns DB.
 */

import type { FxFeedProviderId } from '@/lib/ring-config-types'

type FxOverlayState = {
  rates: Record<string, number>
  fetchedAt: string
  provider: FxFeedProviderId
  mainCurrency: string
}

let overlay: FxOverlayState | null = null

export function getFxOverlayRates(): Record<string, number> | null {
  return overlay?.rates ?? null
}

export function getFxOverlayFetchedAt(): string | null {
  return overlay?.fetchedAt ?? null
}

export function getFxOverlayMeta(): {
  provider: FxFeedProviderId
  mainCurrency: string
} | null {
  if (!overlay) return null
  return { provider: overlay.provider, mainCurrency: overlay.mainCurrency }
}

export function setFxOverlayRates(
  rates: Record<string, number> | null,
  fetchedAt: string | null = null,
  meta?: { provider: FxFeedProviderId; mainCurrency: string } | null,
): void {
  if (!rates || !fetchedAt || !meta) {
    overlay = null
    return
  }
  overlay = {
    rates,
    fetchedAt,
    provider: meta.provider,
    mainCurrency: meta.mainCurrency,
  }
}
