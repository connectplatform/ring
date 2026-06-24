/**
 * E2E smoke: device telemetry upsert → PG user_device_telemetry.
 *
 * Usage:
 *   NODE_OPTIONS="--conditions=react-server" \
 *   DB_BACKEND_MODE=k8s-postgres-fcm \
 *   npx tsx scripts/smoke-device-telemetry.cts
 */

import { initializeDatabase } from '@/lib/database'
import {
  getUserDeviceTelemetrySnapshots,
  upsertUserDeviceTelemetry,
} from '@/features/analytics/lib/device-telemetry-db'

const USER_ID = `smk_telemetry_${Date.now()}`
const DEVICE_ID = `smk_device_${Date.now()}`

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
  console.log('smoke-device-telemetry')
  await initializeDatabase()

  const first = await upsertUserDeviceTelemetry(USER_ID, {
    domain: 'device_health',
    deviceId: DEVICE_ID,
    ts: Date.now(),
    payload: {
      deviceLabel: 'smoke-test',
      formFactor: 'desktop',
      screen: { width: 1920, height: 1080 },
    },
  }, { ipCountry: 'UA', userAgent: 'smoke-device-telemetry' })

  ok('upsert device telemetry', first.success === true, `docId=${first.docId}`)

  const second = await upsertUserDeviceTelemetry(USER_ID, {
    domain: 'device_health',
    deviceId: DEVICE_ID,
    ts: Date.now() + 1,
    payload: {
      deviceLabel: 'smoke-test-updated',
      formFactor: 'desktop',
      screen: { width: 1280, height: 720 },
    },
  }, { ipCountry: 'UA' })

  ok('upsert updates same doc', second.success && second.docId === first.docId)

  const rows = await getUserDeviceTelemetrySnapshots(USER_ID)
  ok('read snapshots for user', rows.length >= 1, `count=${rows.length}`)
  ok(
    'payload reflects update',
    String(rows[0]?.deviceLabel ?? '').includes('updated'),
  )

  console.log(`\n${pass} passed, ${fail} failed`)
  if (fail > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
