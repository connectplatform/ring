import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import {
  ensureFxFeedFresh,
  getMemoryFxFetchedAt,
  getMemoryFxFeedRates,
  refreshFxFeed,
  resolveFxFeedConfig,
  getExchangeRates,
  getMainCurrencySymbol,
} from '@/lib/ring-oracle'
import { getSystemConfigSnapshot } from '@/lib/ring-config-core'

export async function GET() {
  await connection()
  const session = await auth()
  if (!session?.user || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await ensureFxFeedFresh()
  const fx = getSystemConfigSnapshot().fx
  const resolved = resolveFxFeedConfig()
  return NextResponse.json({
    mainCurrency: getMainCurrencySymbol(),
    resolvedFeed: resolved,
    byMainCurrency: fx?.byMainCurrency ?? null,
    defaultFeed: fx?.default ?? null,
    legacyFeed: fx?.feed ?? null,
    manualOverrides: fx?.manualOverrides ?? {},
    feedFetchedAt: getMemoryFxFetchedAt(),
    feedRatesSample: Object.fromEntries(
      Object.entries(getMemoryFxFeedRates() ?? {}).slice(0, 8),
    ),
    resolvedRates: getExchangeRates(),
  })
}

export async function POST(request: NextRequest) {
  await connection()
  const session = await auth()
  if (!session?.user || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as { force?: boolean }
  const resolved = resolveFxFeedConfig()
  const cache = await refreshFxFeed(Boolean(body.force))
  if (!cache) {
    return NextResponse.json(
      { error: 'FX feed refresh failed or disabled', resolvedFeed: resolved },
      { status: 502 },
    )
  }
  return NextResponse.json({
    ok: true,
    resolvedFeed: resolved,
    provider: cache.provider,
    mainCurrency: cache.mainCurrency,
    fetchedAt: cache.fetchedAt,
    codeCount: Object.keys(cache.rates).length,
    resolvedRates: getExchangeRates(),
  })
}
