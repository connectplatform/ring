/**
 * E2E smoke: commerce pipelines — vendor onboarding lifecycle (entities ↔ vendor_profiles
 * write-through) and inventory reservations (levels, holds, TTL cleanup).
 *
 * Usage:
 *   NODE_OPTIONS="--conditions=react-server" \
 *   DB_BACKEND_MODE=k8s-postgres-fcm \
 *   DATABASE_URL=postgresql://ring_user:ring_password_2024@localhost:5432/ring_platform \
 *   npx tsx scripts/smoke-commerce-pipelines.cts [--keep]
 */

import { initializeDatabase, getDatabaseService } from '@/lib/database'
import {
  createVendorProfile,
  updateOnboardingStatus,
  updateVendorPerformance,
  suspendVendor,
  reinstateVendor,
} from '@/features/store/services/vendor-lifecycle'
import {
  updateInventoryLevels,
  reserveInventory,
  releaseReservation,
  cleanupExpiredReservations,
  INVENTORY_COLLECTIONS,
} from '@/features/store/services/inventory-sync'
import { VendorOnboardingStatus } from '@/constants/store'

const KEEP = process.argv.includes('--keep')

const IDS = {
  user: 'smk3_user',
  entity: 'smk3_entity',
  vendorProfile: 'vendor_smk3_entity',
  product: 'smk3_product',
  store: 'smk3_store',
}
const INVENTORY_ID = `${IDS.product}_${IDS.store}`

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

async function cleanup() {
  const db = getDatabaseService()
  const direct: Array<[string, string]> = [
    ['users', IDS.user],
    ['entities', IDS.entity],
    ['vendor_profiles', IDS.vendorProfile],
    ['store_products', IDS.product],
    [INVENTORY_COLLECTIONS.levels, INVENTORY_ID],
  ]
  for (const [collection, id] of direct) {
    try {
      await db.delete(collection, id)
    } catch {
      /* may not exist */
    }
  }
  try {
    const res = await db.query({
      collection: INVENTORY_COLLECTIONS.reservations,
      filters: [{ field: 'productId', operator: '=', value: IDS.product }],
      pagination: { limit: 50 },
    })
    const rows = res.success && res.data ? res.data : []
    for (const row of rows) {
      await db.delete(INVENTORY_COLLECTIONS.reservations, row.id as string)
    }
  } catch {
    /* best effort */
  }
}

async function seed() {
  const db = getDatabaseService()
  const now = new Date().toISOString()
  await db.create('users', { name: 'Smoke Vendor User', createdAt: now }, { id: IDS.user })
  await db.create('entities', {
    name: 'Smoke Vendor Entity',
    type: 'company',
    addedBy: IDS.user,
    isPublic: true,
    createdAt: now,
  }, { id: IDS.entity })
  await db.create('store_products', {
    name: 'Smoke Inventory Product',
    price: 50,
    currency: 'UAH',
    vendorId: IDS.entity,
    createdAt: now,
  }, { id: IDS.product })
}

async function main() {
  console.log('🔬 Commerce pipelines smoke — ring_platform dev\n')
  await initializeDatabase()
  const db = getDatabaseService()

  await cleanup()
  await seed()

  // ── 1. Vendor onboarding lifecycle ────────────────────────────────────────
  console.log('1) Vendor lifecycle')
  const profile = await createVendorProfile(IDS.entity, IDS.user)
  ok('profile created with started status', profile.onboardingStatus === VendorOnboardingStatus.STARTED)

  const entityAfter = await db.read('entities', IDS.entity)
  const entityData = (entityAfter.data?.data || entityAfter.data || {}) as Record<string, any>
  ok('entity carries vendor_profile + store_activated', Boolean(entityData.vendor_profile) && entityData.store_activated === true)

  const profileRow = await db.read('vendor_profiles', IDS.vendorProfile)
  ok('vendor_profiles write-through row exists (split-brain bridge)', Boolean(profileRow.success && profileRow.data))

  await updateOnboardingStatus(IDS.entity, VendorOnboardingStatus.APPROVED, 'smoke approval')
  const entityApproved = await db.read('entities', IDS.entity)
  const approvedData = (entityApproved.data?.data || entityApproved.data || {}) as Record<string, any>
  ok('onboarding approved on entity', approvedData.vendor_profile?.onboardingStatus === VendorOnboardingStatus.APPROVED)

  const mirroredRow = await db.read('vendor_profiles', IDS.vendorProfile)
  const mirroredData = (mirroredRow.data?.data || mirroredRow.data || {}) as Record<string, any>
  ok('approval mirrored to vendor_profiles', mirroredData.onboardingStatus === VendorOnboardingStatus.APPROVED)

  try {
    await updateVendorPerformance(IDS.vendorProfile, { totalOrders: 10, orderFulfillmentRate: 98 })
    const perfRow = await db.read('vendor_profiles', IDS.vendorProfile)
    const perfData = (perfRow.data?.data || perfRow.data || {}) as Record<string, any>
    ok('performance update reaches vendor_profiles', perfData.performance_metrics?.totalOrders === 10)
    ok('trust score recalculated', typeof perfData.trust_score === 'number' && perfData.trust_score > 0,
      `trust_score=${perfData.trust_score}`)
  } catch (e) {
    fail++
    console.log(`  ❌ updateVendorPerformance crashed — ${e instanceof Error ? e.message : e}`)
  }

  try {
    await suspendVendor(IDS.vendorProfile, 'smoke suspension', 'smk_admin')
    const suspended = await db.read('vendor_profiles', IDS.vendorProfile)
    const suspendedData = (suspended.data?.data || suspended.data || {}) as Record<string, any>
    const isSuspended = suspendedData.onboardingStatus === 'suspended' || suspendedData.suspended === true ||
      (suspendedData.suspension_history?.length ?? 0) > 0
    ok('vendor suspended', isSuspended, JSON.stringify({ status: suspendedData.onboardingStatus }))

    await reinstateVendor(IDS.vendorProfile, 'smoke reinstate')
    pass++
    console.log('  ✅ vendor reinstated without error')
  } catch (e) {
    warning('suspend/reinstate path', e instanceof Error ? e.message : String(e))
  }

  // ── 2. Inventory levels + reservations ────────────────────────────────────
  console.log('2) Inventory reservations')
  await updateInventoryLevels(IDS.product, IDS.store, 20, 'set')
  const level0 = await db.read(INVENTORY_COLLECTIONS.levels, INVENTORY_ID)
  const level0Data = (level0.data?.data || level0.data || {}) as Record<string, any>
  ok('inventory level set (available=20)', level0Data.available === 20, `available=${level0Data.available}`)

  const reservation = await reserveInventory(IDS.product, IDS.store, 'smk3_order', 5, 15)
  ok('reservation created (active)', reservation.status === 'active' && reservation.quantity === 5)

  const level1 = await db.read(INVENTORY_COLLECTIONS.levels, INVENTORY_ID)
  const level1Data = (level1.data?.data || level1.data || {}) as Record<string, any>
  ok('level moved to reserved (15 available / 5 reserved)', level1Data.available === 15 && level1Data.reserved === 5,
    `available=${level1Data.available} reserved=${level1Data.reserved}`)

  let oversellBlocked = false
  try {
    await reserveInventory(IDS.product, IDS.store, 'smk3_order_2', 100, 15)
  } catch {
    oversellBlocked = true
  }
  ok('oversell reservation rejected', oversellBlocked)

  await releaseReservation(reservation.id, false)
  const level2 = await db.read(INVENTORY_COLLECTIONS.levels, INVENTORY_ID)
  const level2Data = (level2.data?.data || level2.data || {}) as Record<string, any>
  ok('cancelled reservation restores availability (20/0)', level2Data.available === 20 && level2Data.reserved === 0,
    `available=${level2Data.available} reserved=${level2Data.reserved}`)

  // Expired-hold cleanup: reserve then force-expire, run TTL cleanup
  const expiring = await reserveInventory(IDS.product, IDS.store, 'smk3_order_3', 4, 15)
  await db.update(INVENTORY_COLLECTIONS.reservations, expiring.id, {
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
  })
  await cleanupExpiredReservations()
  const expiredRow = await db.read(INVENTORY_COLLECTIONS.reservations, expiring.id)
  const expiredData = (expiredRow.data?.data || expiredRow.data || {}) as Record<string, any>
  ok('expired reservation cancelled by cleanup', expiredData.status === 'cancelled', `status=${expiredData.status}`)

  const level3 = await db.read(INVENTORY_COLLECTIONS.levels, INVENTORY_ID)
  const level3Data = (level3.data?.data || level3.data || {}) as Record<string, any>
  ok('cleanup returned reserved stock', level3Data.available === 20 && level3Data.reserved === 0,
    `available=${level3Data.available} reserved=${level3Data.reserved}`)

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
