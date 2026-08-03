/**
 * Smoke: ring-oracle FX + prices/conversion denominations (smk46_).
 *
 * Avoids importing lib/processes/registry (eagerly loads all cron handlers /
 * Next client graphs under tsx). Service imports only: fx handler + ring-oracle.
 *
 * Usage (from ring-platform.org):
 *   NODE_OPTIONS="--conditions=react-server" \
 *   DB_BACKEND_MODE=k8s-postgres-fcm \
 *   npx tsx scripts/smoke-ring-oracle-fx.cts [--keep]
 *
 * Optional HTTP:
 *   SMOKE_BASE_URL=http://localhost:3000 CRON_SECRET=… npx tsx scripts/smoke-ring-oracle-fx.cts
 */

import { existsSync } from 'fs'
import { join } from 'path'
import { initializeDatabase } from '@/lib/database'
import { runFxFeedRefresh } from '@/lib/processes/fx/fx-feed-refresh'
import {
  ensureFxFeedFresh,
  getExchangeRates,
  getMainCurrencySymbol,
  getNativeTokenSymbol,
  getNativeTokenToMainCurrencyRate,
  mainCurrencyToNativeTokenUi,
  mainTokenToMainCurrencyUi,
  resolveFxFeedConfig,
} from '@/lib/ring-oracle'

const KEEP = process.argv.includes('--keep')
const BASE_URL = process.env.SMOKE_BASE_URL
const CRON_SECRET = process.env.CRON_SECRET
const ROOT = join(__dirname, '..')

let pass = 0
let fail = 0
let warn = 0

function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++
    console.log(`  ✅ ${name}`)
  } else {
    fail++
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function warning(name: string, detail: string) {
  warn++
  console.log(`  ⚠️  ${name} — ${detail}`)
}

async function section(title: string) {
  console.log(`\n── ${title} ──`)
}

async function main() {
  console.log('smoke-ring-oracle-fx (smk46_)')
  await initializeDatabase()

  await section('Pipeline files on disk')
  ok(
    'fx-feed-refresh handler exists',
    existsSync(join(ROOT, 'lib/processes/fx/fx-feed-refresh.ts')),
  )
  ok(
    'cron route exists',
    existsSync(join(ROOT, 'app/api/cron/fx-feed-refresh/route.ts')),
  )
  const registrySrc = await import('fs').then((fs) =>
    fs.readFileSync(join(ROOT, 'lib/processes/registry.ts'), 'utf8'),
  )
  ok('registry registers fx-feed-refresh id', registrySrc.includes("'fx-feed-refresh'"))
  ok(
    'registry cronPath /api/cron/fx-feed-refresh',
    registrySrc.includes("/api/cron/fx-feed-refresh"),
  )

  await section('FX feed SSOT + refresh')
  const cfg = resolveFxFeedConfig()
  ok('resolveFxFeedConfig returns provider', typeof cfg.provider === 'string' && cfg.provider.length > 0)
  ok('refreshHours positive', typeof cfg.refreshHours === 'number' && cfg.refreshHours > 0)

  try {
    const result = await runFxFeedRefresh()
    ok('runFxFeedRefresh success', result.success === true, JSON.stringify(result))
    if (result.skipped) {
      warning('feed skipped', result.reason ?? 'disabled')
    } else {
      ok(
        'rateCount when refreshed',
        typeof result.rateCount === 'number' && (result.rateCount as number) >= 0,
      )
    }
  } catch (e) {
    warning('runFxFeedRefresh threw', e instanceof Error ? e.message : String(e))
  }

  try {
    await ensureFxFeedFresh()
    const rates = getExchangeRates()
    const main = getMainCurrencySymbol()
    ok('getExchangeRates has main key', typeof rates[main] === 'number')
  } catch (e) {
    warning('ensureFxFeedFresh', e instanceof Error ? e.message : String(e))
  }

  await section('Desk conversion (service)')
  const symbol = getNativeTokenSymbol()
  const main = getMainCurrencySymbol()
  ok('native symbol not empty', Boolean(symbol))
  ok('main currency not empty', Boolean(main))

  const { nativePerMainCurrency, source } = await getNativeTokenToMainCurrencyRate()
  ok('nativePerMainCurrency > 0', nativePerMainCurrency > 0, String(nativePerMainCurrency))
  ok('source present', typeof source === 'string')

  const toNative = await mainCurrencyToNativeTokenUi(1)
  const back = await mainTokenToMainCurrencyUi(toNative)
  ok('1 main → native → main ≈ 1', Math.abs(back - 1) < 0.02, `back=${back}`)

  await section('HTTP conversion API (optional)')
  if (!BASE_URL) {
    warning('SMOKE_BASE_URL unset', 'skipping HTTP probes')
  } else {
    try {
      const getRes = await fetch(`${BASE_URL}/api/prices/conversion`)
      ok('GET /api/prices/conversion', getRes.status === 200, `status=${getRes.status}`)
      if (getRes.ok) {
        const body = (await getRes.json()) as {
          denominations?: string[]
          supported_pairs?: Array<{ from: string; to: string }>
        }
        ok(
          'GET denominations native_token|main_currency',
          Array.isArray(body.denominations) &&
            body.denominations.includes('native_token') &&
            body.denominations.includes('main_currency'),
        )
        ok(
          'GET pairs use denominations',
          Boolean(
            body.supported_pairs?.some(
              (p) => p.from === 'native_token' && p.to === 'main_currency',
            ),
          ),
        )
      }

      const postOk = await fetch(`${BASE_URL}/api/prices/conversion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: '1',
          from: 'main_currency',
          to: 'native_token',
        }),
      })
      ok('POST main_currency→native_token', postOk.status === 200, `status=${postOk.status}`)
      if (postOk.ok) {
        const j = (await postOk.json()) as {
          conversion?: { from_denomination?: string; to_denomination?: string; to_amount?: string }
        }
        ok(
          'POST response denominations',
          j.conversion?.from_denomination === 'main_currency' &&
            j.conversion?.to_denomination === 'native_token',
        )
        ok('POST to_amount present', Boolean(j.conversion?.to_amount))
      }

      const postLegacy = await fetch(`${BASE_URL}/api/prices/conversion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: '1', from: 'RING', to: 'USD' }),
      })
      ok('POST RING/USD rejected', postLegacy.status === 400, `status=${postLegacy.status}`)
    } catch (e) {
      warning('HTTP conversion probes failed', e instanceof Error ? e.message : String(e))
    }

    try {
      const headers: Record<string, string> = {}
      if (CRON_SECRET) headers.Authorization = `Bearer ${CRON_SECRET}`
      const cronRes = await fetch(`${BASE_URL}/api/cron/fx-feed-refresh`, { headers })
      ok(
        'GET /api/cron/fx-feed-refresh responds',
        cronRes.status === 200 || cronRes.status === 401,
        `status=${cronRes.status}`,
      )
    } catch (e) {
      warning('cron HTTP probe', e instanceof Error ? e.message : String(e))
    }
  }

  console.log(`\nResult: ${pass} pass, ${fail} fail, ${warn} warn${KEEP ? ' (--keep)' : ''}`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
