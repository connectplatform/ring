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
import { getMainCurrencySymbol } from '@/lib/ring-config-core'
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
import { resolveProductImagesFromForm } from '@/features/generative-media/parse-product-images'
import { ringbaseDerivativeUploadOptions } from '@/lib/file/derivatives-profile'
import { parseProductResearchFormData } from '@/features/store/lib/product-research-form'
import { createProductNodusWikiFromDraft } from '@/features/store/lib/product-nodus-wiki'

// Interface for a row of product referral rate details
export interface ProductReferralRateRow {
  productId: string
  name: string
  vendorEntityId: string
  effectivePercent: number
  source: ReferralCommissionSource
}

// Asserts current user is a platform admin, otherwise throws Unauthorized
async function assertAdmin() {
  const session = await auth()
  if (!session?.user || !isPlatformAdmin(session.user.role)) {
    throw new Error('Unauthorized')
  }
  return session
}

// Initialize ERP warehouse stock for all products (or for the specified quantity)
export async function initializeWarehouseStock(quantity: number = 100) {
  await assertAdmin()
  const result = await ERPStockService.addInitialStockToAllProducts(quantity)
  revalidatePath('/admin/store/stock') // Revalidate stock listing
  return result
}

// Process all due settlements for ERP operations
export async function processDueSettlementsAction() {
  await assertAdmin()
  const batch = await processDueSettlements()
  revalidatePath('/admin/store/commissions') // Revalidate commission dashboard
  return { success: true, batch }
}

// List all settlements (limit is optional)
export async function listAllSettlements(limit: number = 50): Promise<Settlement[]> {
  await assertAdmin()

  // Query settlements ordered by scheduled date descending
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

// List all product referral rates for admin-view, merged with merchant configs
export async function listProductReferralRates(limit: number = 50): Promise<ProductReferralRateRow[]> {
  await assertAdmin()

  // Query products from the catalog
  const result = await db().queryDocs<Record<string, unknown> & { id: string }>({
    collection: 'store_products',
    pagination: { limit },
  })

  if (!result.success || !result.data) {
    return []
  }

  // Use a Map as merchant config cache for efficiency
  const merchantCache = new Map<string, MerchantConfiguration | null>()
  const rates: ProductReferralRateRow[] = []

  for (const row of result.data) {
    const id = row.id
    // Try resolving vendor or entity IDs
    const entityId = String(row.entity_id ?? row.vendorId ?? '')
    if (!entityId) continue // Skip if can't resolve vendor

    // Memoize config lookups (avoid extra DB calls)
    let merchantConfig = merchantCache.get(entityId)
    if (merchantConfig === undefined) {
      merchantConfig = await getMerchantConfigByEntityId(entityId)
      merchantCache.set(entityId, merchantConfig)
    }

    // Normalize input, resolve rate/percent & source
    const productInput = normalizeProductReferralInput(row)
    const resolved = resolveReferralCommissionPercent(productInput, merchantConfig)
    const name = String(row.name ?? id)

    // Compose referral row
    rates.push({
      productId: id,
      name,
      vendorEntityId: entityId,
      effectivePercent: resolved.percent,
      source: resolved.source,
    })
  }

  // Sort alphabetically by name for easier UX
  return rates.sort((a, b) => a.name.localeCompare(b.name))
}

// Basic interface for admin's store product listing row
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

// List products for admin panel (with filters for approval status)
export async function listAdminStoreProducts(
  rawQuery: Partial<{ limit: number; approvalStatus: string }> = {},
): Promise<AdminStoreProductRow[]> {
  await assertAdmin()

  // Validate input using Zod
  const query = adminStoreProductListQuerySchema.parse(rawQuery)
  // Only set filter for approvalStatus if not 'all'
  const filters =
    query.approvalStatus === 'all'
      ? undefined
      : [{ field: 'approvalStatus', operator: '==', value: query.approvalStatus }]

  // Query product documents
  const result = await db().queryDocs<Record<string, unknown> & { id: string }>({
    collection: 'store_products',
    filters,
    orderBy: [{ field: 'created_at', direction: 'desc' }],
    pagination: { limit: query.limit },
  })

  if (!result.success || !result.data) {
    return []
  }

  // Project fields for the row, with fallbacks
  return result.data.map((row) => ({
    id: row.id,
    name: String(row.name ?? row.id),
    vendorEntityId: resolveVendorEntityId(row) || '—',
    price: String(row.price ?? '0'),
    currency: String(row.currency ?? getMainCurrencySymbol()),
    stock: Number(row.stock ?? row.stock_quantity ?? 0),
    status: row.status != null ? String(row.status) : undefined,
    approvalStatus: resolveApprovalStatus(row),
    createdAt: row.createdAt != null ? String(row.createdAt) : undefined,
  }))
}

// Approve or reject a product; writes admin user and timestamp
export async function updateAdminProductApproval(formData: FormData) {
  const session = await assertAdmin()
  // Parse with Zod and extract fields from FormData
  const parsed = adminStoreProductApprovalSchema.parse({
    productId: formData.get('productId'),
    approvalStatus: formData.get('approvalStatus'),
    rejectionReason: formData.get('rejectionReason') || undefined,
  })

  // Load existing product
  const existing = await db().findDocById<Record<string, unknown>>('store_products', parsed.productId)
  if (!existing.success || !existing.data) {
    throw new Error('Product not found')
  }

  const now = new Date().toISOString()
  // Compute listing patch depending on approval
  const listingPatch =
    parsed.approvalStatus === 'approved'
      ? buildMainStoreListingPatch({
          submitToMainStore: true,
          existing: existing.data,
          preserveApproved: true,
        })
      : {
          mainStoreStatus: 'inactive' as const,
          listStores: resolveListStores(existing.data).filter((id) => id !== MAIN_STORE_ID),
          productListedAt: resolveListStores(existing.data).filter((id) => id !== MAIN_STORE_ID),
        }

  // Compose full product update (flattened for DB write)
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

  // Commit update
  const result = await db().updateDoc('store_products', parsed.productId, update)
  if (!result.success) {
    throw result.error ?? new Error('Failed to update product approval')
  }

  // Non-blocking WebConductor enrich on approve when a product URL is present.
  if (parsed.approvalStatus === 'approved') {
    const productUrl = String(
      existing.data.productUrl ||
        existing.data.product_url ||
        (existing.data as { data?: { productUrl?: string } }).data?.productUrl ||
        '',
    ).trim()
    if (/^https?:\/\//i.test(productUrl)) {
      void import('@/app/_actions/product-agent-research')
        .then(({ researchProductAgentAction }) =>
          researchProductAgentAction({
            productId: parsed.productId,
            productUrl,
          }),
        )
        .catch((err) => {
          console.warn('approve enrich: researchProductAgentAction failed', err)
        })
    }
  }

  revalidatePath('/admin/store/products')
  revalidatePath('/store')
  return { success: true as const }
}

// Option type for vendor select dropdowns in admin
export interface AdminVendorOption {
  id: string
  name: string
  storeSlug?: string
  storeCategories?: string[]
}

// List all active vendors for store product creation UI in admin
export async function listActiveVendorsForAdmin(): Promise<AdminVendorOption[]> {
  await assertAdmin()
  // TODO: Consider paginating for large vendor lists (React/Next19 streaming)
  const entities = await getVendorEntitiesByStatus('open', 200)
  // Map/format for dropdown/selection lists
  return entities.map((e) => ({
    id: e.id,
    name: e.name,
    storeSlug: (e as unknown as Record<string, unknown>).storeSlug as string | undefined,
    storeCategories:
      ((e as unknown as Record<string, unknown>).storeCategories as string[]) ?? [],
  }))
}

// Fetch a single product by ID for detailed admin views or editing
export async function getAdminStoreProduct(productId: string) {
  await assertAdmin()
  // TODO: Use Next.js 16/React 19 server actions or RSC streaming for single-product fetch
  const result = await db().findDocById<Record<string, unknown>>('store_products', productId)
  if (!result.success || !result.data) return null
  return result.data
}

// Mark a product as inactive ("delisted") for main store
export async function delistAdminStoreProduct(formData: FormData) {
  const session = await assertAdmin()
  const parsed = adminStoreProductDelistSchema.parse({
    productId: formData.get('productId'),
  })

  // Get the product to delist
  const existing = await db().findDocById<Record<string, unknown>>('store_products', parsed.productId)
  if (!existing.success || !existing.data) {
    throw new Error('Product not found')
  }

  const now = new Date().toISOString()
  // Set status and associated delist fields, remove from MAIN_STORE
  const update = flattenProductDocumentForWrite(existing.data, {
    mainStoreStatus: 'inactive',
    listStores: resolveListStores(existing.data).filter((id) => id !== MAIN_STORE_ID),
    productListedAt: resolveListStores(existing.data).filter((id) => id !== MAIN_STORE_ID),
    delistedAt: now,
    delistedBy: session.user.id,
  })

  // Commit update
  const result = await db().updateDoc('store_products', parsed.productId, update)
  if (!result.success) {
    throw result.error ?? new Error('Failed to delist product')
  }

  revalidatePath('/admin/store/products')
  revalidatePath('/store')
  return { success: true as const }
}

// Create a new product in admin panel, with full field validation and photo uploads
export async function createAdminStoreProduct(prevState: unknown, formData: FormData) {
  try {
    const session = await assertAdmin()
    // Parse form data according to schema
    const fields = parseStoreProductFormData(formData)
    const vendorEntityId = String(formData.get('vendorEntityId') ?? '')
    const researchForm = parseProductResearchFormData(formData)
    adminStoreProductCreateSchema.parse({ ...fields, vendorEntityId })

    // Must check vendor existence and status
    const vendorEntity = await getVendorEntityById(vendorEntityId)
    if (!vendorEntity) {
      return { error: 'Vendor entity not found or inactive' }
    }

    // Key: generate product ID (with timestamp/random for uniqueness)
    const productId = `product_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const productNodusWiki = await createProductNodusWikiFromDraft({
      productId,
      productName: fields.name,
      productAgent: researchForm.productAgent,
      nodusJson: researchForm.nodusDraft,
    })
    // Upload and aggregate product photo URLs
    const uploadedPhotos = await uploadProductPhotosFromForm(formData, productId)
    const photoUrls = uploadedPhotos.photoUrls
    if (photoUrls.length === 0) {
      return { error: 'At least one photo is required' }
    }

    // Create listing patch for main store/approval logic
    const listingPatch = buildMainStoreListingPatch({
      submitToMainStore: fields.submitToMainStore,
      existing: null,
    })

    // Compose product document for DB
    const productDoc: Record<string, unknown> = {
      id: productId,
      name: fields.name,
      description: fields.description,
      price: fields.price,
      currency: fields.currency,
      category: fields.category,
      images: photoUrls,
      ...(uploadedPhotos.generativeGallery
        ? { generativeGallery: uploadedPhotos.generativeGallery }
        : {}),
      stock_quantity: fields.stock,
      stock: fields.stock,
      status: fields.activeInMyStore ? 'active' : 'inactive',
      entity_id: vendorEntity.id,
      vendorId: vendorEntity.id,
      vendorName: vendorEntity.name,
      vendor_id: session.user.id,
      activeInVendorStore: fields.activeInMyStore,
      slug: `${String(
        (vendorEntity as unknown as Record<string, unknown>).storeSlug ?? vendorEntity.id,
      )}-${fields.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdByAdmin: session.user.id,
      ...(researchForm.productAgent
        ? {
            productAgent: researchForm.productAgent,
            longDescription: researchForm.productAgent,
          }
        : {}),
      ...(researchForm.nodusDraft ? { productNodusDraft: researchForm.nodusDraft } : {}),
      ...(productNodusWiki ? { productNodusWiki } : {}),
      ...(researchForm.researchFields
        ? { productResearchFields: researchForm.researchFields }
        : {}),
      ...(researchForm.researchMedia.length
        ? { productResearchMedia: researchForm.researchMedia }
        : {}),
      ...listingPatch,
    }

    if (fields.referralCommission !== undefined) {
      productDoc.referralCommission = fields.referralCommission
    }
    if (fields.rep) {
      productDoc.rep = fields.rep
    }

    // Write to DB
    const result = await db().createDoc('store_products', productDoc, { id: productId })
    if (!result.success) {
      return { error: result.error?.message ?? 'Failed to create product' }
    }

    // Revalidate caches/pages
    revalidatePath('/admin/store/products')
    revalidatePath('/store')
    revalidatePath('/admin/wiki')
    return { success: true, productId }
  } catch (error) {
    // TODO: Use server actions error boundaries in React 19 for concise error propagation
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) throw error
    return { error: error instanceof Error ? error.message : 'Failed to create product' }
  }
}

// Update a product from the admin panel (fields, images, etc.)
export async function updateAdminStoreProduct(prevState: unknown, formData: FormData) {
  try {
    await assertAdmin()
    // Grab product and vendor IDs from the form
    const productId = String(formData.get('productId') ?? '')
    const vendorEntityId = String(formData.get('vendorEntityId') ?? '')
    const fields = parseStoreProductFormData(formData)
    adminStoreProductUpdateSchema.parse({ ...fields, productId, vendorEntityId })

    // Fetch existing product for merge and safety
    const existingResult = await db().findDocById<Record<string, unknown>>('store_products', productId)
    if (!existingResult.success || !existingResult.data) {
      return { error: 'Product not found' }
    }

    // Compose product main store listing update based on submission
    const listingPatch = buildMainStoreListingPatch({
      submitToMainStore: fields.submitToMainStore,
      existing: existingResult.data,
    })

    // Upload images (new or updated)
    const uploadedPhotos = await uploadProductPhotosFromForm(
      formData,
      productId,
      existingResult.data,
    )
    const photoUrls = uploadedPhotos.photoUrls
    if (photoUrls.length === 0) {
      return { error: 'At least one photo is required' }
    }

    // Agent Knowledge (optional hidden fields from ProductAgentKnowledgeSection)
    const productAgentRaw = String(formData.get('productAgent') ?? '').trim()
    const productNodusWikiPageId = String(formData.get('productNodusWikiPageId') ?? '').trim()
    const existingWiki = existingResult.data.productNodusWiki as
      | { wikiPageId?: string; wikiVaultKey?: string; title?: string }
      | undefined

    // Merge update with validated/changed fields and uploaded images
    const update = flattenProductDocumentForWrite(existingResult.data, {
      ...listingPatch,
      name: fields.name,
      description: fields.description,
      price: fields.price,
      currency: fields.currency,
      category: fields.category,
      images: photoUrls,
      ...(uploadedPhotos.generativeGallery
        ? { generativeGallery: uploadedPhotos.generativeGallery }
        : {}),
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
      ...(productAgentRaw ? { productAgent: productAgentRaw } : {}),
      ...(productNodusWikiPageId
        ? {
            productNodusWiki: {
              wikiPageId: productNodusWikiPageId,
              wikiVaultKey: existingWiki?.wikiVaultKey,
              title: existingWiki?.title,
              updatedAt: new Date().toISOString(),
            },
          }
        : {}),
    })

    // Write changes to DB
    const result = await db().updateDoc('store_products', productId, update)
    if (!result.success) {
      return { error: result.error?.message ?? 'Failed to update product' }
    }

    revalidatePath('/admin/store/products')
    revalidatePath('/store')
    return { success: true, productId }
  } catch (error) {
    // TODO: Use server actions error boundaries / Next16 global error support
    return { error: error instanceof Error ? error.message : 'Failed to update product' }
  }
}

// Upload and merge new product photos with existing set; also deletes marked photos
async function uploadProductPhotosFromForm(
  formData: FormData,
  productId: string,
  existing?: Record<string, unknown>,
): Promise<{ photoUrls: string[]; generativeGallery: ReturnType<typeof resolveProductImagesFromForm>['gallery'] }> {
  const { file } = await import('@/lib/file')
  const existingUrls = Array.isArray(existing?.images)
    ? [...(existing.images as string[])]
    : []

  const resolved = resolveProductImagesFromForm(formData, existingUrls)
  if (resolved.photoUrls.length > 0 && resolved.gallery) {
    return { photoUrls: resolved.photoUrls, generativeGallery: resolved.gallery }
  }

  let photoUrls = resolved.photoUrls.length > 0 ? resolved.photoUrls : existingUrls

  // Find new files explicitly attached (iterate new-* and photo-*)
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
          {
            access: 'public',
            addRandomSuffix: false,
            contentType: photo.type || undefined,
            ...ringbaseDerivativeUploadOptions('vendor:product-media', photo.type, 'public'),
          },
        )
        if (!result.success) throw new Error(result.error || 'Photo upload failed')
        return result.url
      }),
    )
    photoUrls = [...photoUrls, ...uploaded]
  }

  const deletedPhotos = formData.get('deletedPhotos') as string | null
  if (deletedPhotos && !resolved.gallery) {
    try {
      const deleted = JSON.parse(deletedPhotos) as string[]
      if (Array.isArray(deleted)) {
        photoUrls = photoUrls.filter((url) => !deleted.includes(url))
        await Promise.all(
          deleted.map((url) => file().delete(url).catch((e) => console.error('Delete failed:', e))),
        )
      }
    } catch {
      // ignore
    }
  }

  return { photoUrls, generativeGallery: resolved.gallery }
}

// Add to current stock for vendor product (call from vendor portal)
export async function restockVendorProduct(productId: string, quantity: number) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  const productResult = await db().findDocById<Record<string, unknown>>('store_products', productId)
  if (!productResult.success || !productResult.data) {
    throw new Error('Product not found')
  }

  const isAdmin = isPlatformAdmin(session.user.role)
  if (!isAdmin) {
    const { getVendorEntity } = await import('@/features/entities/services/vendor-entity')
    const vendorEntity = await getVendorEntity(session.user.id)
    if (!vendorEntity) {
      throw new Error('Vendor profile required')
    }
    const ownerId = resolveVendorEntityId(productResult.data as never)
    const productOwner = String(
      (productResult.data as { productOwner?: string }).productOwner ?? '',
    )
    const allowed =
      ownerId === vendorEntity.id ||
      productOwner === vendorEntity.id ||
      productOwner === session.user.id
    if (!allowed) {
      throw new Error('Not allowed to restock this product')
    }
  }

  const { ZERO_WAREHOUSE_ID } = await import('@/features/store/constants/stock')
  const result = await ERPStockService.updateStock({
    productId,
    warehouseId: ZERO_WAREHOUSE_ID,
    quantityChange: quantity,
    operation: 'add',
    reason: 'Vendor restock',
    userId: session.user.id,
  })

  revalidatePath('/vendor/stock')
  revalidatePath('/admin/store/stock')
  return result
}

/** Admin: hold a settlement (blocks payout). */
export async function holdSettlementAction(settlementId: string, reason: string) {
  await assertAdmin()
  const { holdSettlement } = await import('@/features/store/services/settlement')
  await holdSettlement(settlementId, reason || 'Admin hold')
  revalidatePath('/admin/store/commissions')
  return { success: true }
}

/** Admin: release a held settlement back to pending. */
export async function releaseHeldSettlementAction(settlementId: string) {
  await assertAdmin()
  const { releaseHeldSettlement } = await import('@/features/store/services/settlement')
  await releaseHeldSettlement(settlementId)
  revalidatePath('/admin/store/commissions')
  return { success: true }
}

/** Dry-run preview of due settlements (no payout). */
export async function previewDueSettlementsAction() {
  await assertAdmin()
  const result = await db().queryDocs<Settlement & Record<string, unknown>>({
    collection: 'settlements',
    filters: [{ field: 'status', operator: '=', value: 'pending' }],
    orderBy: [{ field: 'scheduledFor', direction: 'asc' }],
    pagination: { limit: 100 },
  })
  const rows = (result.success && result.data ? result.data : []) as Settlement[]
  const now = Date.now()
  const due = rows.filter((s) => new Date(s.scheduledFor).getTime() <= now)
  return {
    success: true,
    dueCount: due.length,
    pendingCount: rows.length,
    totalNet: due.reduce((sum, s) => sum + (s.netPayout || 0), 0),
    due,
  }
}

/** Admin adjust stock with reason (add/subtract/set). */
export async function adjustProductStockAction(params: {
  productId: string
  quantity: number
  operation: 'add' | 'subtract' | 'set'
  reason: string
}) {
  const session = await assertAdmin()
  const { ZERO_WAREHOUSE_ID } = await import('@/features/store/constants/stock')
  const result = await ERPStockService.updateStock({
    productId: params.productId,
    warehouseId: ZERO_WAREHOUSE_ID,
    quantityChange: params.quantity,
    operation: params.operation,
    reason: params.reason || 'Admin adjustment',
    userId: session.user!.id,
  })
  revalidatePath('/admin/store/stock')
  return result
}
