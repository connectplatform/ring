/**
 * E2E smoke: ring analytics pipeline — ingest → PG → admin summary.
 *
 * Usage:
 *   NODE_OPTIONS="--conditions=react-server" \
 *   DB_BACKEND_MODE=k8s-postgres-fcm \
 *   npx tsx scripts/smoke-ring-analytics-pipeline.cts [--keep]
 */

import { initializeDatabase } from '@/lib/database'
import {
  getPlatformAnalyticsSummary,
  insertAnalyticsErrors,
  insertAnalyticsEventBatch,
  insertWebVitalsRecord,
} from '@/features/analytics/lib/analytics-db'

const KEEP = process.argv.includes('--keep')
const SESSION = `smk_analytics_${Date.now()}`

let pass = 0
let fail = 0

function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++
    console.log(`  ✅ ${name}`)
  } else {
    fail++
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function main() {
  console.log('smoke-ring-analytics-pipeline')
  await initializeDatabase()

  const eventResult = await insertAnalyticsEventBatch(SESSION, null, [
    { type: 'app_load', data: { url: '/smoke' }, timestamp: Date.now() },
    { type: 'page_view', data: { path: '/smoke' }, timestamp: Date.now() },
  ])
  ok('insert app analytics events', eventResult.inserted >= 2, `inserted=${eventResult.inserted}`)

  const vitalsResult = await insertWebVitalsRecord({
    sessionId: SESSION,
    url: 'http://localhost/smoke',
    userAgent: 'smoke-test',
    metrics: [
      { name: 'LCP', value: 1800, rating: 'good' },
      { name: 'CLS', value: 0.05, rating: 'good' },
    ],
    timestamp: Date.now(),
  })
  ok('insert web vitals record', vitalsResult.success === true)

  const errorResult = await insertAnalyticsErrors({
    sessionId: SESSION,
    errors: [
      {
        message: 'Smoke test error',
        type: 'javascript_error',
        component: 'smoke-ring-analytics-pipeline',
      },
    ],
  })
  ok('insert analytics errors batch', errorResult.inserted >= 1, `inserted=${errorResult.inserted}`)

  const summary = await getPlatformAnalyticsSummary({ timeframe: '7d' })
  ok('summary has event data', summary.engagement.hasEventData === true)
  ok('summary page views >= 1', summary.engagement.pageViews >= 1)
  ok('summary web vitals has data', summary.webVitals.hasData === true)
  ok('summary errors has data', summary.errors.hasData === true)

  console.log(`\n${pass} passed, ${fail} failed`)
  if (fail > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
