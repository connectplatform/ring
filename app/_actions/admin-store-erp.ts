'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { processDueSettlements } from '@/features/store/services/settlement'
import { ERPStockService } from '@/features/store/services/erp-stock-service'
import { db } from '@/lib/database'
import {
  normalizeProductReferralInput,
  resolveReferralCommissionPercent,
  type ReferralCommissionSource,
} from '@/features/store/lib/referral-commission'
import { getMerchantConfigByEntityId } from '@/features/store/lib/merchant-config'
import type { MerchantConfiguration } from '@/features/store/types/vendor'
import type { Settlement } from '@/features/store/services/settlement'

export interface ProductReferralRateRow {
  productId: string
  name: string
  vendorEntityId: string
  effectivePercent: number
  source: ReferralCommissionSource
}

async function assertAdmin() {
  const session = await auth()
  if (!session?.user || !isPlatformAdmin(session.user.role)) {
    throw new Error('Unauthorized')
  }
  return session
}

export async function initializeWarehouseStock(quantity: number = 100) {
  await assertAdmin()
  const result = await ERPStockService.addInitialStockToAllProducts(quantity)
  revalidatePath('/admin/store/stock')
  return result
}

export async function processDueSettlementsAction() {
  await assertAdmin()
  const batch = await processDueSettlements()
  revalidatePath('/admin/store/commissions')
  return { success: true, batch }
}

export async function listAllSettlements(limit: number = 50): Promise<Settlement[]> {
  await assertAdmin()

  const result = await db().queryDocs<Settlement & Record<string, unknown>>({
    collection: 'settlements',
    orderBy: [{ field: 'scheduledFor', direction: 'desc' }],
    pagination: { limit },
  })

  if (!result.success || !result.data) {
    return []
  }

  return result.data as Settlement[]
}

export async function listProductReferralRates(limit: number = 50): Promise<ProductReferralRateRow[]> {
  await assertAdmin()

  const result = await db().queryDocs<Record<string, unknown> & { id: string }>({
    collection: 'store_products',
    pagination: { limit },
  })

  if (!result.success || !result.data) {
    return []
  }

  const merchantCache = new Map<string, MerchantConfiguration | null>()
  const rates: ProductReferralRateRow[] = []

  for (const row of result.data) {
    const id = row.id
    const entityId = String(row.entity_id ?? row.vendorId ?? '')
    if (!entityId) continue

    let merchantConfig = merchantCache.get(entityId)
    if (merchantConfig === undefined) {
      merchantConfig = await getMerchantConfigByEntityId(entityId)
      merchantCache.set(entityId, merchantConfig)
    }

    const productInput = normalizeProductReferralInput(row)
    const resolved = resolveReferralCommissionPercent(productInput, merchantConfig)
    const name = String(row.name ?? id)

    rates.push({
      productId: id,
      name,
      vendorEntityId: entityId,
      effectivePercent: resolved.percent,
      source: resolved.source,
    })
  }

  return rates.sort((a, b) => a.name.localeCompare(b.name))
}

export async function restockVendorProduct(productId: string, quantity: number) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  const result = await ERPStockService.updateStock({
    productId,
    warehouseId: 'zero-warehouse',
    quantityChange: quantity,
    operation: 'add',
    reason: 'Vendor restock',
    userId: session.user.id,
  })

  revalidatePath('/vendor/stock')
  return result
}
