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
import { resolveApprovalStatus, resolveVendorEntityId, resolveListStores, buildMainStoreListingPatch, flattenProductDocumentForWrite, MAIN_STORE_ID } from '@/features/store/lib/product-document'
import { getVendorEntityById, getVendorEntitiesByStatus } from '@/features/entities/services/vendor-entity'
import {
  adminStoreProductApprovalSchema,
  adminStoreProductListQuerySchema,
  adminStoreProductCreateSchema,
  adminStoreProductUpdateSchema,
  adminStoreProductDelistSchema,
  parseStoreProductFormData,
} from '@/lib/zod'

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

export interface AdminStoreProductRow {
  id: string
  name: string
  vendorEntityId: string
  price: string
  currency: string
  stock: number
  status?: string
  approvalStatus?: string | null
  createdAt?: string
}

export async function listAdminStoreProducts(
  rawQuery: Partial<{ limit: number; approvalStatus: string }> = {},
): Promise<AdminStoreProductRow[]> {
  await assertAdmin()

  const query = adminStoreProductListQuerySchema.parse(rawQuery)
  const filters =
    query.approvalStatus === 'all'
      ? undefined
      : [{ field: 'approvalStatus', operator: '==', value: query.approvalStatus }]

  const result = await db().queryDocs<Record<string, unknown> & { id: string }>({
    collection: 'store_products',
    filters,
    orderBy: [{ field: 'created_at', direction: 'desc' }],
    pagination: { limit: query.limit },
  })

  if (!result.success || !result.data) {
    return []
  }

  return result.data.map((row) => ({
    id: row.id,
    name: String(row.name ?? row.id),
    vendorEntityId: resolveVendorEntityId(row) || '—',
    price: String(row.price ?? '0'),
    currency: String(row.currency ?? 'UAH'),
    stock: Number(row.stock ?? row.stock_quantity ?? 0),
    status: row.status != null ? String(row.status) : undefined,
    approvalStatus: resolveApprovalStatus(row),
    createdAt: row.createdAt != null ? String(row.createdAt) : undefined,
  }))
}

export async function updateAdminProductApproval(formData: FormData) {
  const session = await assertAdmin()
  const parsed = adminStoreProductApprovalSchema.parse({
    productId: formData.get('productId'),
    approvalStatus: formData.get('approvalStatus'),
    rejectionReason: formData.get('rejectionReason') || undefined,
  })

  const existing = await db().findDocById<Record<string, unknown>>('store_products', parsed.productId)
  if (!existing.success || !existing.data) {
    throw new Error('Product not found')
  }

  const now = new Date().toISOString()
  const listingPatch =
    parsed.approvalStatus === 'approved'
      ? buildMainStoreListingPatch({ submitToMainStore: true, existing: existing.data, preserveApproved: true })
      : {
          mainStoreStatus: 'inactive' as const,
          listStores: resolveListStores(existing.data).filter((id) => id !== MAIN_STORE_ID),
          productListedAt: resolveListStores(existing.data).filter((id) => id !== MAIN_STORE_ID),
        }

  const update = flattenProductDocumentForWrite(existing.data, {
    ...listingPatch,
    approvalStatus: parsed.approvalStatus,
    approvedBy: session.user.id,
    approvedAt: now,
    ...(parsed.approvalStatus === 'rejected' && parsed.rejectionReason
      ? { rejectionReason: parsed.rejectionReason }
      : {}),
    ...(parsed.approvalStatus === 'approved' ? { rejectionReason: null } : {}),
  })

  const result = await db().updateDoc('store_products', parsed.productId, update)
  if (!result.success) {
    throw result.error ?? new Error('Failed to update product approval')
  }

  revalidatePath('/admin/store/products')
  revalidatePath('/store')
  return { success: true as const }
}

export interface AdminVendorOption {
  id: string
  name: string
  storeSlug?: string
  storeCategories?: string[]
}

export async function listActiveVendorsForAdmin(): Promise<AdminVendorOption[]> {
  await assertAdmin()
  const entities = await getVendorEntitiesByStatus('open', 200)
  return entities.map((e) => ({
    id: e.id,
    name: e.name,
    storeSlug: (e as unknown as Record<string, unknown>).storeSlug as string | undefined,
    storeCategories: ((e as unknown as Record<string, unknown>).storeCategories as string[]) ?? [],
  }))
}

export async function getAdminStoreProduct(productId: string) {
  await assertAdmin()
  const result = await db().findDocById<Record<string, unknown>>('store_products', productId)
  if (!result.success || !result.data) return null
  return result.data
}

export async function delistAdminStoreProduct(formData: FormData) {
  const session = await assertAdmin()
  const parsed = adminStoreProductDelistSchema.parse({
    productId: formData.get('productId'),
  })

  const existing = await db().findDocById<Record<string, unknown>>('store_products', parsed.productId)
  if (!existing.success || !existing.data) {
    throw new Error('Product not found')
  }

  const now = new Date().toISOString()
  const update = flattenProductDocumentForWrite(existing.data, {
    mainStoreStatus: 'inactive',
    listStores: resolveListStores(existing.data).filter((id) => id !== MAIN_STORE_ID),
    productListedAt: resolveListStores(existing.data).filter((id) => id !== MAIN_STORE_ID),
    delistedAt: now,
    delistedBy: session.user.id,
  })

  const result = await db().updateDoc('store_products', parsed.productId, update)
  if (!result.success) {
    throw result.error ?? new Error('Failed to delist product')
  }

  revalidatePath('/admin/store/products')
  revalidatePath('/store')
  return { success: true as const }
}

export async function createAdminStoreProduct(prevState: unknown, formData: FormData) {
  try {
    const session = await assertAdmin()
    const fields = parseStoreProductFormData(formData)
    const vendorEntityId = String(formData.get('vendorEntityId') ?? '')
    adminStoreProductCreateSchema.parse({ ...fields, vendorEntityId })

    const vendorEntity = await getVendorEntityById(vendorEntityId)
    if (!vendorEntity) {
      return { error: 'Vendor entity not found or inactive' }
    }

    const productId = `product_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const photoUrls = await uploadProductPhotosFromForm(formData, productId)
    if (photoUrls.length === 0) {
      return { error: 'At least one photo is required' }
    }

    const listingPatch = buildMainStoreListingPatch({
      submitToMainStore: fields.submitToMainStore,
      existing: null,
    })

    const productDoc: Record<string, unknown> = {
      id: productId,
      name: fields.name,
      description: fields.description,
      price: fields.priceUAH,
      currency: fields.currency,
      category: fields.category,
      images: photoUrls,
      stock_quantity: fields.stock,
      stock: fields.stock,
      status: fields.activeInMyStore ? 'active' : 'inactive',
      entity_id: vendorEntity.id,
      vendorId: vendorEntity.id,
      vendorName: vendorEntity.name,
      vendor_id: session.user.id,
      activeInVendorStore: fields.activeInMyStore,
      slug: `${String((vendorEntity as unknown as Record<string, unknown>).storeSlug ?? vendorEntity.id)}-${fields.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdByAdmin: session.user.id,
      ...listingPatch,
    }

    if (fields.referralCommission !== undefined) {
      productDoc.referralCommission = fields.referralCommission
    }
    if (fields.rep) {
      productDoc.rep = fields.rep
    }

    const result = await db().createDoc('store_products', productDoc, { id: productId })
    if (!result.success) {
      return { error: result.error?.message ?? 'Failed to create product' }
    }

    revalidatePath('/admin/store/products')
    revalidatePath('/store')
    return { success: true, productId }
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) throw error
    return { error: error instanceof Error ? error.message : 'Failed to create product' }
  }
}

export async function updateAdminStoreProduct(prevState: unknown, formData: FormData) {
  try {
    await assertAdmin()
    const productId = String(formData.get('productId') ?? '')
    const vendorEntityId = String(formData.get('vendorEntityId') ?? '')
    const fields = parseStoreProductFormData(formData)
    adminStoreProductUpdateSchema.parse({ ...fields, productId, vendorEntityId })

    const existingResult = await db().findDocById<Record<string, unknown>>('store_products', productId)
    if (!existingResult.success || !existingResult.data) {
      return { error: 'Product not found' }
    }

    const listingPatch = buildMainStoreListingPatch({
      submitToMainStore: fields.submitToMainStore,
      existing: existingResult.data,
    })

    const photoUrls = await uploadProductPhotosFromForm(formData, productId, existingResult.data)
    if (photoUrls.length === 0) {
      return { error: 'At least one photo is required' }
    }

    const update = flattenProductDocumentForWrite(existingResult.data, {
      ...listingPatch,
      name: fields.name,
      description: fields.description,
      price: fields.priceUAH,
      currency: fields.currency,
      category: fields.category,
      images: photoUrls,
      stock_quantity: fields.stock,
      stock: fields.stock,
      status: fields.activeInMyStore ? 'active' : 'inactive',
      entity_id: vendorEntityId,
      vendorId: vendorEntityId,
      activeInVendorStore: fields.activeInMyStore,
      ...(fields.referralCommission !== undefined
        ? { referralCommission: fields.referralCommission }
        : {}),
      ...(fields.rep ? { rep: fields.rep } : { rep: undefined }),
    })

    const result = await db().updateDoc('store_products', productId, update)
    if (!result.success) {
      return { error: result.error?.message ?? 'Failed to update product' }
    }

    revalidatePath('/admin/store/products')
    revalidatePath('/store')
    return { success: true, productId }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to update product' }
  }
}

async function uploadProductPhotosFromForm(
  formData: FormData,
  productId: string,
  existing?: Record<string, unknown>,
): Promise<string[]> {
  const { file } = await import('@/lib/file')
  let photoUrls = Array.isArray(existing?.images) ? [...(existing.images as string[])] : []

  const newPhotoFiles: File[] = []
  let newPhotoIndex = 0
  while (formData.has(`new-photo-${newPhotoIndex}`)) {
    const f = formData.get(`new-photo-${newPhotoIndex}`) as File
    if (f?.size > 0) newPhotoFiles.push(f)
    newPhotoIndex++
  }

  let photoIndex = 0
  while (formData.has(`photo-${photoIndex}`)) {
    const f = formData.get(`photo-${photoIndex}`) as File
    if (f?.size > 0) newPhotoFiles.push(f)
    photoIndex++
  }

  if (newPhotoFiles.length > 0) {
    const uploaded = await Promise.all(
      newPhotoFiles.map(async (photo, index) => {
        const ext = photo.name.split('.').pop() || 'webp'
        const result = await file().upload(
          `products/${productId}/photo-${Date.now()}-${index}.${ext}`,
          photo,
          { access: 'public', addRandomSuffix: false },
        )
        if (!result.success) throw new Error(result.error || 'Photo upload failed')
        return result.url
      }),
    )
    photoUrls = [...photoUrls, ...uploaded]
  }

  const deletedPhotos = formData.get('deletedPhotos') as string | null
  if (deletedPhotos) {
    const deletedUrls = JSON.parse(deletedPhotos) as string[]
    photoUrls = photoUrls.filter((url) => !deletedUrls.includes(url))
  }

  return photoUrls
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
