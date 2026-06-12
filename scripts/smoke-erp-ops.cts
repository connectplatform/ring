/**
 * E2E smoke: ERP ops — processDueSettlements simulated payout batch.
 *
 * Usage:
 *   NODE_OPTIONS="--conditions=react-server" \
 *   DB_BACKEND_MODE=k8s-postgres-fcm \
 *   SETTLEMENT_PAYOUT_MODE=simulated \
 *   npx tsx scripts/smoke-erp-ops.cts [--keep]
 */

import { initializeDatabase, getDatabaseService } from '@/lib/database'
import { processDueSettlements } from '@/features/store/services/settlement'
import { STORE_COLLECTIONS } from '@/features/store/constants/collections'

const KEEP = process.argv.includes('--keep')

const IDS = {
  vendorEntity: 'smk9_entity',
  vendorProfile: 'vendor_smk9_entity',
  merchantConfig: 'smk9_merchant_config',
  settlement: 'smk9_settlement_due',
  order: 'smk9_order',
}

let pass = 0
let fail = 0
let warn = 0
let batchId: string | null = null

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
  const direct: Array<[string, string]> = [
    [STORE_COLLECTIONS.vendorProfiles, IDS.vendorProfile],
    [STORE_COLLECTIONS.merchantConfigs, IDS.merchantConfig],
    [STORE_COLLECTIONS.settlements, IDS.settlement],
    [STORE_COLLECTIONS.orders, IDS.order],
  ]
  if (batchId) {
    direct.push([STORE_COLLECTIONS.payoutBatches, batchId])
  }
  for (const [collection, id] of direct) {
    try {
      await db.delete(collection, id)
    } catch {
      /* best effort */
    }
  }
}

async function seed() {
  const db = getDatabaseService()
  const now = new Date().toISOString()
  const past = new Date(Date.now() - 60_000).toISOString()

  await db.create(
    STORE_COLLECTIONS.merchantConfigs,
    {
      walletId: '0x5555555555555555555555555555555555555555',
      settlementRules: { frequency: 'instant', holdPeriodDays: 0 },
      createdAt: now,
    },
    { id: IDS.merchantConfig },
  )

  await db.create(
    STORE_COLLECTIONS.vendorProfiles,
    {
      vendorId: IDS.vendorEntity,
      storeName: 'Smoke Payout Vendor',
      storeTier: 'starter',
      storeMerchantConfigID: IDS.merchantConfig,
      createdAt: now,
    },
    { id: IDS.vendorProfile },
  )

  await db.create(
    STORE_COLLECTIONS.orders,
    { userId: 'smk9_buyer', total: 1000, status: 'paid', createdAt: now },
    { id: IDS.order },
  )

  await db.create(
    STORE_COLLECTIONS.settlements,
    {
      vendorId: IDS.vendorEntity,
      orderId: IDS.order,
      amount: 1000,
      currency: 'UAH',
      commission: 100,
      netPayout: 900,
      status: 'pending',
      scheduledFor: past,
      metadata: { smoke: true },
    },
    { id: IDS.settlement },
  )
}

async function main() {
  console.log('🔬 ERP ops smoke — processDueSettlements\n')

  process.env.SETTLEMENT_PAYOUT_MODE = process.env.SETTLEMENT_PAYOUT_MODE || 'simulated'

  await initializeDatabase()
  const db = getDatabaseService()

  await cleanup()
  await seed()

  // ── 1. Empty queue when nothing due ───────────────────────────────────────
  console.log('1) No due settlements baseline')
  await db.update(STORE_COLLECTIONS.settlements, IDS.settlement, {
    scheduledFor: new Date(Date.now() + 86400000).toISOString(),
  })
  const empty = await processDueSettlements()
  ok('no batch when none due', empty === null)

  // ── 2. Process due settlement ─────────────────────────────────────────────
  console.log('2) processDueSettlements')
  await db.update(STORE_COLLECTIONS.settlements, IDS.settlement, {
    status: 'pending',
    scheduledFor: new Date(Date.now() - 60_000).toISOString(),
    processedAt: undefined,
    transactionId: undefined,
    failureReason: undefined,
  })

  const batch = await processDueSettlements()
  batchId = batch?.id ?? null
  ok('payout batch created', Boolean(batch?.id), JSON.stringify(batch))
  ok('batch completed', batch?.status === 'completed', `status=${batch?.status}`)
  ok('one settlement completed', batch?.completedCount === 1, `completed=${batch?.completedCount}`)

  const settlementRow = await db.findById(STORE_COLLECTIONS.settlements, IDS.settlement)
  const settlementData = (settlementRow.data?.data || settlementRow.data || {}) as Record<string, any>
  ok('settlement status completed', settlementData.status === 'completed', `status=${settlementData.status}`)
  ok(
    'simulated transaction id',
    typeof settlementData.transactionId === 'string' && settlementData.transactionId.startsWith('sim_'),
    `tx=${settlementData.transactionId}`,
  )
  ok('metadata.simulated flagged', settlementData.metadata?.simulated === true)

  // ── 3. Idempotent re-run (no pending due) ─────────────────────────────────
  console.log('3) Idempotent re-run')
  const again = await processDueSettlements()
  ok('second run returns null (nothing due)', again === null)

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
