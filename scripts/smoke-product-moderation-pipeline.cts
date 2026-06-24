/**
 * E2E smoke: product moderation — vendor submit → admin approve → Main Store visible.
 *
 * Usage:
 *   NODE_OPTIONS="--conditions=react-server" \
 *   DB_BACKEND_MODE=k8s-postgres-fcm \
 *   npx tsx scripts/smoke-product-moderation-pipeline.cts [--keep]
 */

import { initializeDatabase, getDatabaseService, db as dbCommand } from '@/lib/database'
import { PostgreSQLStoreAdapter } from '@/features/store/postgresql-adapter'
import {
  buildMainStoreListingPatch,
  flattenProductDocumentForWrite,
  isVisibleOnMainStore,
  resolveApprovalStatus,
} from '@/features/store/lib/product-document'

const KEEP = process.argv.includes('--keep')

const IDS = {
  vendorEntity: 'smk12_entity',
  product: 'smk12_product',
}

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

async function cleanup() {
  const db = getDatabaseService()
  for (const [collection, id] of [
    ['store_products', IDS.product],
    ['entities', IDS.vendorEntity],
  ] as const) {
    try {
      await db.delete(collection, id)
    } catch {
      /* best effort */
    }
  }
}

async function main() {
  console.log('smoke-product-moderation-pipeline')
  await initializeDatabase()
  const db = getDatabaseService()
  const adapter = new PostgreSQLStoreAdapter()

  if (!KEEP) await cleanup()

  const listingPatch = buildMainStoreListingPatch({ submitToMainStore: true, existing: null })

  await db.create('entities', {
    id: IDS.vendorEntity,
    name: 'Smoke Vendor 12',
    storeActivated: true,
    storeStatus: 'open',
    storeSlug: 'smoke-vendor-12',
  }, { id: IDS.vendorEntity })

  await db.create(
    'store_products',
    {
      id: IDS.product,
      name: 'Smoke Moderation Honey',
      description: 'Pipeline moderation test product',
      price: 99,
      currency: 'UAH',
      category: 'honey-sweets',
      images: ['https://example.com/smoke-honey.jpg'],
      stock: 10,
      stock_quantity: 10,
      status: 'active',
      entity_id: IDS.vendorEntity,
      vendorId: IDS.vendorEntity,
      vendorName: 'Smoke Vendor 12',
      ...listingPatch,
      createdAt: new Date().toISOString(),
    },
    { id: IDS.product },
  )

  const pendingResult = await dbCommand().findDocById<Record<string, unknown>>('store_products', IDS.product)
  const pendingDoc = (pendingResult.data ?? {}) as Record<string, unknown>
  ok('product seeded pending', resolveApprovalStatus(pendingDoc) === 'pending')
  ok('hidden before approval', !isVisibleOnMainStore(pendingDoc))

  const beforeList = await adapter.listProducts()
  ok('not in main store catalog before approval', !beforeList.some((p) => p.id === IDS.product))

  const approveUpdate = flattenProductDocumentForWrite(pendingDoc, {
    ...buildMainStoreListingPatch({ submitToMainStore: true, existing: pendingDoc, preserveApproved: true }),
    approvalStatus: 'approved',
    approvedBy: 'smk12_admin',
    approvedAt: new Date().toISOString(),
    mainStoreStatus: 'active',
  })
  const updateResult = await dbCommand().updateDoc('store_products', IDS.product, approveUpdate)

  const approvedResult = await dbCommand().findDocById<Record<string, unknown>>('store_products', IDS.product)
  const approvedDoc = (approvedResult.data ?? {}) as Record<string, unknown>
  ok('approval status approved', resolveApprovalStatus(approvedDoc) === 'approved')
  ok('visible after approval', isVisibleOnMainStore(approvedDoc))

  const afterList = await adapter.listProducts()
  ok('in main store catalog after approval', afterList.some((p) => p.id === IDS.product))

  console.log(`\nResult: ${pass} passed, ${fail} failed`)
  if (!KEEP) await cleanup()
  if (fail > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
