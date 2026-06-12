/**
 * E2E smoke: refcodes HTTP routes — visit track beacon + cron mint auth.
 * Service-level assertions always run; HTTP probes when SMOKE_BASE_URL is set.
 *
 * Usage:
 *   NODE_OPTIONS="--conditions=react-server" \
 *   npx tsx scripts/smoke-refcodes-http.cts [--keep]
 *
 * Optional HTTP:
 *   SMOKE_BASE_URL=http://localhost:3000 CRON_SECRET=smoke_cron_secret npx tsx scripts/smoke-refcodes-http.cts
 */

import { initializeDatabase, getDatabaseService } from '@/lib/database'
import { RefcodeService } from '@/features/refcodes/services/refcode-service'
import { trackRefcodeVisit } from '@/features/refcodes/services/attribution-service'
import { processApprovedRewards } from '@/features/refcodes/services/reward-minter'
import { REFCODE_COLLECTION } from '@/features/refcodes/constants'

const KEEP = process.argv.includes('--keep')
const IDS = {
  owner: 'smk8_owner',
}
const WALLET = '0x4444444444444444444444444444444444444444'

let pass = 0
let fail = 0
let warn = 0
let refCode = ''

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

async function cleanup() {
  const db = getDatabaseService()
  try {
    await db.delete('users', IDS.owner)
  } catch {
    /* best effort */
  }
  if (refCode) {
    try {
      const rows = await db.query({
        collection: REFCODE_COLLECTION,
        filters: [{ field: 'code', operator: '=', value: refCode }],
        pagination: { limit: 5 },
      })
      for (const row of rows.success && rows.data ? rows.data : []) {
        await db.delete(REFCODE_COLLECTION, row.id as string)
      }
    } catch {
      /* best effort */
    }
  }
}

async function seed() {
  const db = getDatabaseService()
  const now = new Date().toISOString()
  await db.create('users', { name: 'Smoke Refcode Owner', walletAddress: WALLET, createdAt: now }, { id: IDS.owner })
  const ref = await RefcodeService.getOrCreateForWallet(IDS.owner, WALLET)
  refCode = ref.code
}

async function main() {
  console.log('🔬 Refcodes HTTP smoke — track + cron mint\n')

  await initializeDatabase()

  await cleanup()
  await seed()

  // ── 1. Service-level track ────────────────────────────────────────────────
  console.log('1) trackRefcodeVisit (service)')
  const first = await trackRefcodeVisit(refCode)
  ok('valid code tracked', first.ok === true && (first.visits ?? 0) >= 1, `visits=${first.visits}`)
  const second = await trackRefcodeVisit(refCode)
  ok('visit count increments', (second.visits ?? 0) > (first.visits ?? 0), `visits=${second.visits}`)

  const missing = await trackRefcodeVisit('NOTAREAL1')
  ok('unknown code rejected', missing.ok === false)

  // ── 2. Cron mint service queue ──────────────────────────────────────────
  console.log('2) processApprovedRewards (service)')
  const cronResult = await processApprovedRewards(5)
  ok('cron service runs on empty queue', cronResult.processed === 0)

  // ── 3. HTTP track route (optional) ────────────────────────────────────────
  console.log('3) HTTP POST /api/refcodes/track (optional)')
  const baseUrl = process.env.SMOKE_BASE_URL?.replace(/\/$/, '')
  if (!baseUrl) {
    warning('HTTP track skipped', 'set SMOKE_BASE_URL to exercise live route')
  } else {
    try {
      const res = await fetch(`${baseUrl}/api/refcodes/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: refCode }),
      })
      ok('HTTP track → 200', res.status === 200, `status=${res.status}`)
      const body = (await res.json()) as { ok?: boolean; visits?: number }
      ok('HTTP track ok=true', body.ok === true)

      const badRes = await fetch(`${baseUrl}/api/refcodes/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'BADCODE99' }),
      })
      ok('HTTP unknown code → 404', badRes.status === 404, `status=${badRes.status}`)
    } catch (e) {
      fail++
      console.log(`  ❌ HTTP track probe failed — ${e instanceof Error ? e.message : e}`)
    }
  }

  // ── 4. HTTP cron mint auth (optional) ─────────────────────────────────────
  console.log('4) HTTP GET /api/cron/refcodes-mint (optional)')
  const cronSecret = process.env.CRON_SECRET || 'smoke_cron_secret'
  if (!baseUrl) {
    warning('HTTP cron skipped', 'set SMOKE_BASE_URL to exercise live route')
  } else {
    try {
      const unauth = await fetch(`${baseUrl}/api/cron/refcodes-mint`)
      ok('cron without auth → 401', unauth.status === 401, `status=${unauth.status}`)

      const authed = await fetch(`${baseUrl}/api/cron/refcodes-mint`, {
        headers: { Authorization: `Bearer ${cronSecret}` },
      })
      if (authed.status === 401 && !process.env.CRON_SECRET) {
        warning('cron authed probe', 'server CRON_SECRET unset — expected 401 in dev')
      } else {
        ok('cron with bearer → 200', authed.status === 200, `status=${authed.status}`)
        if (authed.ok) {
          const body = (await authed.json()) as { success?: boolean }
          ok('cron response success', body.success === true)
        }
      }
    } catch (e) {
      fail++
      console.log(`  ❌ HTTP cron probe failed — ${e instanceof Error ? e.message : e}`)
    }
  }

  if (!KEEP) {
    await cleanup()
    console.log('\n🧹 test rows cleaned up')
  } else {
    console.log('\n📌 --keep: test rows left in DB')
  }

  console.log(`\nRESULT: ${pass} passed, ${fail} failed, ${warn} warnings`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('SMOKE CRASHED:', e)
  process.exit(1)
})
