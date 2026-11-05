'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { auth } from '@/auth'
import { isPlatformAdmin, isSuperadmin } from '@/features/auth/user-role'
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
import { resolveApprovalStatus, resolveVendorEntityId, resolveListStores, resolveMainStoreStatus, buildMainStoreListingPatch, flattenProductDocumentForWrite, MAIN_STORE_ID } from '@/features/store/lib/product-document'
import { getVendorEntityById, getVendorEntitiesByStatus } from '@/features/entities/services/vendor-entity'
import {
  adminStoreProductApprovalSchema,
  adminStoreProductListQuerySchema,
  adminStoreProductCreateSchema,
  adminStoreProductUpdateSchema,
  adminStoreProductDelistSchema,
  adminStoreProductQuickUpdateSchema,
  formatStoreProductZodError,
  parseStoreProductFormData,
} from '@/lib/zod'
import { resolveProductImagesFromForm } from '@/features/generative-media/parse-product-images'
import { collectProductImageUrls } from '@/features/generative-media/types'
import { curtainAdvertiseWriteFields } from '@/features/curtain/lib/advertise'
import { ringbaseDerivativeUploadOptions } from '@/lib/file/derivatives-profile'
import { parseProductResearchFormData } from '@/features/store/lib/product-research-form'
import { createProductNodusWikiFromDraft } from '@/features/store/lib/product-nodus-wiki'
import type { ProductPromotion } from '@/features/store/types/promotions'
import {
  DEFAULT_INVENTORY_STORE_ID,
  DEFAULT_WAREHOUSE_NAME,
  ZERO_WAREHOUSE_ID,
} from '@/features/store/constants/stock'

function parseProductPromotionsFromForm(formData: FormData): ProductPromotion[] {
  const raw = String(formData.get('promotionsJson') ?? '').trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as ProductPromotion[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((p) => p && typeof p === 'object' && p.type && p.id)
      .map((p) => ({
        id: String(p.id),
        type: p.type,
        enabled: Boolean(p.enabled),
        label: p.label ? String(p.label) : undefined,
        buyQty: typeof p.buyQty === 'number' ? p.buyQty : p.type === 'bogo' ? 2 : undefined,
        getQty: typeof p.getQty === 'number' ? p.getQty : p.type === 'bogo' ? 1 : undefined,
        percentOff: typeof p.percentOff === 'number' ? p.percentOff : undefined,
        amountOff: typeof p.amountOff === 'number' ? p.amountOff : undefined,
        currency: p.currency ? String(p.currency) : undefined,
        startsAt: p.startsAt ? String(p.startsAt) : undefined,
        endsAt: p.endsAt ? String(p.endsAt) : undefined,
      }))
  } catch {
    return []
  }
}

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
  /** Store category slug (quick-filter column). */
  category?: string
  /** Product SKU (quick-filter column). */
  sku?: string
  /** Short catalog description for inline edit. */
  description?: string
  /** First product image, when one is stored. */
  thumbnailUrl?: string
  /** Main Store listing flag. Inactive means the product was delisted. */
  mainStoreStatus?: 'active' | 'inactive'
}

function mapAdminStoreProductRow(
  row: Record<string, unknown> & { id: string },
): AdminStoreProductRow {
  const images = collectProductImageUrls(row)
  return {
    id: row.id,
    name: String(row.name ?? row.id),
    vendorEntityId: resolveVendorEntityId(row) || '—',
    price: String(row.price ?? '0'),
    currency: String(row.currency ?? getMainCurrencySymbol()),
    stock: Number(row.stock ?? row.stock_quantity ?? 0),
    status: row.status != null ? String(row.status) : undefined,
    approvalStatus: resolveApprovalStatus(row),
    createdAt: row.createdAt != null ? String(row.createdAt) : undefined,
    category: row.category != null ? String(row.category) : undefined,
    sku: row.sku != null ? String(row.sku) : undefined,
    description: row.description != null ? String(row.description) : '',
    thumbnailUrl: images[0],
    mainStoreStatus: resolveMainStoreStatus(row),
  }
}

function refreshStoreCatalog() {
  updateTag('store:products')
  revalidatePath('/admin/store/products')
  revalidatePath('/store')
}

export interface AdminStoreProductListResult {
  items: AdminStoreProductRow[]
  hasMore: boolean
  nextOffset: number
  /** Matches in the searched catalog, not just the current page. */
  total: number
}

function productRowMatchesQuery(row: Record<string, unknown>, needle: string): boolean {
  const haystack = [
    row.name,
    row.sku,
    row.category,
    row.description,
    row.vendorName,
    row.vendor_name,
    resolveVendorEntityId(row),
  ]
    .filter((part) => part != null && String(part).trim())
    .join(' ')
    .toLowerCase()
  return haystack.includes(needle)
}

const PRODUCT_SEARCH_PAGE = 200
const PRODUCT_SEARCH_CAP = 5000

// List products for admin panel (with filters for approval status)
export async function listAdminStoreProducts(
  rawQuery: Partial<{
    limit: number
    offset: number
    approvalStatus: string
    q: string
    vendorEntityId: string
  }> = {},
): Promise<AdminStoreProductListResult> {
  const session = await assertAdmin()

  const query = adminStoreProductListQuerySchema.parse(rawQuery)
  const needle = query.q.trim().toLowerCase()
  // Superadmin searches the whole catalog. Any other caller is limited to their vendor store.
  let vendorScope = query.vendorEntityId.trim()
  if (!isSuperadmin(session.user.role)) {
    const { getVendorEntity } = await import('@/features/entities/services/vendor-entity')
    const ownVendor = session.user.id ? await getVendorEntity(session.user.id) : null
    vendorScope = ownVendor?.id || vendorScope
  }
  const filters =
    query.approvalStatus === 'all'
      ? undefined
      : [{ field: 'approvalStatus', operator: '==' as const, value: query.approvalStatus }]

  if (!needle && !vendorScope) {
    const result = await db().queryDocs<Record<string, unknown> & { id: string }>({
      collection: 'store_products',
      filters,
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      pagination: { limit: query.limit, offset: query.offset },
    })
    if (!result.success || !result.data) {
      return { items: [], hasMore: false, nextOffset: query.offset, total: 0 }
    }
    const items = result.data.map((row) => mapAdminStoreProductRow(row))
    const hasMore = items.length >= query.limit
    return {
      items,
      hasMore,
      nextOffset: hasMore ? query.offset + items.length : query.offset,
      total: query.offset + items.length + (hasMore ? 1 : 0),
    }
  }

  const matches: AdminStoreProductRow[] = []
  let dbOffset = 0
  while (dbOffset < PRODUCT_SEARCH_CAP) {
    const result = await db().queryDocs<Record<string, unknown> & { id: string }>({
      collection: 'store_products',
      filters,
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      pagination: { limit: PRODUCT_SEARCH_PAGE, offset: dbOffset },
    })
    const rows = result.success && result.data ? result.data : []
    for (const row of rows) {
      if (vendorScope && resolveVendorEntityId(row) !== vendorScope) continue
      if (needle && !productRowMatchesQuery(row, needle)) continue
      matches.push(mapAdminStoreProductRow(row))
    }
    if (rows.length < PRODUCT_SEARCH_PAGE) break
    dbOffset += rows.length
  }

  const items = matches.slice(query.offset, query.offset + query.limit)
  const hasMore = query.offset + items.length < matches.length
  return {
    items,
    hasMore,
    nextOffset: query.offset + items.length,
    total: matches.length,
  }
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

  refreshStoreCatalog()
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
  const remainingStores = resolveListStores(existing.data).filter((id) => id !== MAIN_STORE_ID)
  // status=inactive is what the catalog row and public visibility both read.
  // An empty listStores array is treated as "still on the main store", so keep a non-main marker.
  const listStores = remainingStores.length > 0 ? remainingStores : ['delisted']
  const update = flattenProductDocumentForWrite(existing.data, {
    status: 'inactive',
    activeInVendorStore: false,
    mainStoreStatus: 'inactive',
    listStores,
    productListedAt: listStores,
    delistedAt: now,
    delistedBy: session.user.id,
  })

  const result = await db().updateDoc('store_products', parsed.productId, update)
  if (!result.success) {
    throw result.error ?? new Error('Failed to delist product')
  }

  refreshStoreCatalog()
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
      longDescription: fields.longDescription,
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
    const productPromotions = parseProductPromotionsFromForm(formData)
    if (productPromotions.length > 0) {
      productDoc.promotions = productPromotions
    }
    Object.assign(productDoc, curtainAdvertiseWriteFields(formData))

    // Write to DB
    const result = await db().createDoc('store_products', productDoc, { id: productId })
    if (!result.success) {
      return { error: result.error?.message ?? 'Failed to create product' }
    }

    refreshStoreCatalog()
    revalidatePath('/admin/wiki')
    return { success: true, productId }
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) throw error
    return {
      error: formatStoreProductZodError(error) || (error instanceof Error ? error.message : 'Failed to create product'),
    }
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
      longDescription: fields.longDescription,
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
      promotions: parseProductPromotionsFromForm(formData),
      ...curtainAdvertiseWriteFields(formData),
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

    refreshStoreCatalog()
    return { success: true, productId }
  } catch (error) {
    return {
      error: formatStoreProductZodError(error) || (error instanceof Error ? error.message : 'Failed to update product'),
    }
  }
}

/** Inline catalog edit: title, price, category, and description. */
export async function quickUpdateAdminStoreProduct(input: {
  productId: string
  name: string
  price: number | string
  category: string
  description?: string
}) {
  try {
    await assertAdmin()
    const parsed = adminStoreProductQuickUpdateSchema.parse(input)
    const existing = await db().findDocById<Record<string, unknown>>('store_products', parsed.productId)
    if (!existing.success || !existing.data) return { error: 'Product not found' }

    const update = flattenProductDocumentForWrite(existing.data, {
      name: parsed.name,
      price: parsed.price,
      category: parsed.category,
      description: parsed.description,
    })
    const result = await db().updateDoc('store_products', parsed.productId, update)
    if (!result.success) {
      return { error: result.error?.message ?? 'Failed to update product' }
    }
    refreshStoreCatalog()
    return { success: true as const, product: mapAdminStoreProductRow({ ...update, id: parsed.productId }) }
  } catch (error) {
    return {
      error: formatStoreProductZodError(error) || (error instanceof Error ? error.message : 'Failed to update product'),
    }
  }
}

/** Remove a catalog product. Platform admins only. Media cleanup is best-effort. */
export async function deleteAdminStoreProduct(productId: string) {
  try {
    await assertAdmin()
    const id = String(productId || '').trim()
    if (!id) return { error: 'Product not found' }
    const existing = await db().findDocById<Record<string, unknown>>('store_products', id)
    if (!existing.success || !existing.data) return { error: 'Product not found' }

    const urls = collectProductImageUrls(existing.data)
    const result = await db().deleteDoc('store_products', id)
    if (!result.success) {
      return { error: result.error?.message ?? 'Failed to delete product' }
    }
    if (urls.length > 0) {
      try {
        const { file } = await import('@/lib/file')
        await Promise.all(urls.map((url) => file().delete(url).catch(() => undefined)))
      } catch {
        // The catalog row is already gone. A leftover image file can be cleaned later.
      }
    }
    refreshStoreCatalog()
    return { success: true as const }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to delete product' }
  }
}

// Upload and merge new product photos with existing set; also deletes marked photos
async function uploadProductPhotosFromForm(
  formData: FormData,
  productId: string,
  existing?: Record<string, unknown>,
): Promise<{ photoUrls: string[]; generativeGallery: ReturnType<typeof resolveProductImagesFromForm>['gallery'] }> {
  const { file } = await import('@/lib/file')
  const existingUrls = collectProductImageUrls(existing)

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

async function assertStoreOperator() {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')
  if (isPlatformAdmin(session.user.role)) {
    return { session, vendorEntityId: null as string | null }
  }
  const { getVendorEntity } = await import('@/features/entities/services/vendor-entity')
  const vendor = await getVendorEntity(session.user.id)
  if (!vendor?.id) throw new Error('Unauthorized')
  return { session, vendorEntityId: vendor.id }
}

export async function getAdminStoreSettingsAction() {
  const { vendorEntityId } = await assertStoreOperator()
  const { getStoreSettings } = await import('@/features/store/services/store-settings-service')
  const { mergeStoreSettings } = await import('@/features/store/types/store-settings')
  const { isNovaPostEnabled } = await import('@/lib/shipping/nova-post')
  const platform = await getStoreSettings()
  if (!vendorEntityId) {
    return {
      settings: {
        ...platform,
        promotions: {
          ...platform.promotions,
          promoCodes: platform.promotions.promoCodes.filter((code) => !code.vendorEntityId),
        },
      },
      novaPostKeyConfigured: isNovaPostEnabled(),
      isPlatformAdmin: true,
    }
  }
  const profile = await db().findDocById<Record<string, unknown>>('vendor_profiles', `vendor_${vendorEntityId}`)
  const row = profile.success ? profile.data : null
  const vendorPromos = (row?.promotions || {}) as {
    promoCodes?: typeof platform.promotions.promoCodes
    freeShipping?: typeof platform.promotions.freeShipping
    checkoutSpecialOfferEnabled?: boolean
  }
  const shipping = row?.shipping
    ? mergeStoreSettings({ shipping: row.shipping }).shipping
    : platform.shipping
  const platformByCode = new Map(
    platform.promotions.promoCodes
      .filter((code) => code.vendorEntityId === vendorEntityId)
      .map((code) => [code.code.trim().toLowerCase(), code]),
  )
  const rawVendorCodes = Array.isArray(vendorPromos.promoCodes)
    ? vendorPromos.promoCodes
    : Array.from(platformByCode.values())
  const promoCodes = rawVendorCodes.map((code) => {
    const synced = platformByCode.get(code.code.trim().toLowerCase())
    return {
      ...code,
      vendorEntityId,
      redemptionCount: Math.max(code.redemptionCount ?? 0, synced?.redemptionCount ?? 0),
    }
  })
  return {
    settings: {
      shipping,
      promotions: {
        promoCodes,
        freeShipping: vendorPromos.freeShipping || platform.promotions.freeShipping,
        checkoutSpecialOfferEnabled: Boolean(vendorPromos.checkoutSpecialOfferEnabled),
      },
    },
    novaPostKeyConfigured: isNovaPostEnabled(),
    isPlatformAdmin: false,
  }
}

export async function updateAdminStoreShippingSettingsAction(
  shipping: import('@/features/store/types/store-settings').StoreShippingSettings,
) {
  const { session, vendorEntityId } = await assertStoreOperator()
  const { getStoreSettings, saveStoreSettings } = await import('@/features/store/services/store-settings-service')
  if (vendorEntityId) {
    const profileId = `vendor_${vendorEntityId}`
    const existing = await db().findDocById<Record<string, unknown>>('vendor_profiles', profileId)
    if (!existing.success || !existing.data) throw new Error('Vendor profile not found')
    await db().updateDoc('vendor_profiles', profileId, {
      shipping,
      updatedAt: new Date().toISOString(),
    })
    revalidatePath('/admin/store/settings')
    revalidatePath('/store/checkout')
    return shipping
  }
  const current = await getStoreSettings()
  const saved = await saveStoreSettings({ ...current, shipping }, session.user.id)
  revalidatePath('/admin/store/settings')
  revalidatePath('/store/checkout')
  revalidatePath('/store/cart')
  return saved.shipping
}

export async function updateAdminStorePromotionsAction(
  promotions: import('@/features/store/types/store-settings').StorePromotionsSettings,
) {
  const { session, vendorEntityId } = await assertStoreOperator()
  const { getStoreSettings, saveStoreSettings } = await import('@/features/store/services/store-settings-service')
  const current = await getStoreSettings()
  if (vendorEntityId) {
    const prevCounts = new Map(
      current.promotions.promoCodes
        .filter((code) => code.vendorEntityId === vendorEntityId)
        .map((code) => [code.code.trim().toLowerCase(), code.redemptionCount ?? 0]),
    )
    const stamped = promotions.promoCodes
      .filter((code) => code.code.trim())
      .map((code) => ({
        ...code,
        vendorEntityId,
        redemptionCount: code.redemptionCount ?? prevCounts.get(code.code.trim().toLowerCase()) ?? 0,
      }))
    const others = current.promotions.promoCodes.filter((code) => code.vendorEntityId !== vendorEntityId)
    const saved = await saveStoreSettings(
      {
        ...current,
        promotions: { ...current.promotions, promoCodes: [...others, ...stamped] },
      },
      session.user.id,
    )
    const profileId = `vendor_${vendorEntityId}`
    const existing = await db().findDocById<Record<string, unknown>>('vendor_profiles', profileId)
    if (existing.success && existing.data) {
      await db().updateDoc('vendor_profiles', profileId, {
        promotions: {
          promoCodes: stamped,
          freeShipping: promotions.freeShipping,
          checkoutSpecialOfferEnabled: promotions.checkoutSpecialOfferEnabled,
        },
        updatedAt: new Date().toISOString(),
      })
    }
    revalidatePath('/vendor/dashboard')
    revalidatePath('/admin/store/promotions')
    revalidatePath('/store/cart')
    revalidatePath('/store/checkout')
    return { ...promotions, promoCodes: stamped }
  }
  const prevPlatformCounts = new Map(
    current.promotions.promoCodes
      .filter((code) => !code.vendorEntityId)
      .map((code) => [code.code.trim().toLowerCase(), code.redemptionCount ?? 0]),
  )
  const vendorCodes = current.promotions.promoCodes.filter((code) => code.vendorEntityId)
  const platformCodes = promotions.promoCodes.map((code) => ({
    ...code,
    vendorEntityId: null,
    redemptionCount: code.redemptionCount ?? prevPlatformCounts.get(code.code.trim().toLowerCase()) ?? 0,
  }))
  const saved = await saveStoreSettings(
    {
      ...current,
      promotions: { ...promotions, promoCodes: [...platformCodes, ...vendorCodes] },
    },
    session.user.id,
  )
  revalidatePath('/admin/store/promotions')
  revalidatePath('/store/cart')
  revalidatePath('/store/checkout')
  return {
    ...saved.promotions,
    promoCodes: saved.promotions.promoCodes.filter((code) => !code.vendorEntityId),
  }
}

export async function listPromotedProductsAction() {
  const { vendorEntityId } = await assertStoreOperator()
  const result = await db().queryDocs<Record<string, unknown> & { id: string }>({
    collection: 'store_products',
    pagination: { limit: 120 },
  })
  if (!result.success || !result.data) return []
  return result.data
    .filter((row) => {
      if (vendorEntityId) {
        const owner = String(row.entity_id || row.vendorId || row.productOwner || '')
        if (owner !== vendorEntityId) return false
      }
      return Array.isArray(row.promotions) && row.promotions.length > 0
    })
    .slice(0, 40)
    .map((row) => ({
      id: row.id,
      name: String(row.name || row.id),
      promotions: row.promotions,
    }))
}

/** Platform warehouse directory row. Quantities stay on the default warehouse. */
export interface WarehouseDirectoryRow {
  id: string
  name: string
  code: string
  address: string
  active: boolean
  isDefault: boolean
  inventoryStoreId: string
}

const WAREHOUSES_COLLECTION = 'warehouses'

function asWarehouse(row: { id: string } & Record<string, unknown>): WarehouseDirectoryRow {
  const id = String(row.id)
  const isDefault = Boolean(row.isDefault) || id === ZERO_WAREHOUSE_ID
  const storedStoreId = typeof row.inventoryStoreId === 'string' ? row.inventoryStoreId : ''
  return {
    id,
    name: typeof row.name === 'string' ? row.name : '',
    code: typeof row.code === 'string' ? row.code : '',
    address: typeof row.address === 'string' ? row.address : '',
    active: row.active !== false,
    isDefault,
    inventoryStoreId: isDefault ? storedStoreId || DEFAULT_INVENTORY_STORE_ID : storedStoreId,
  }
}

function sortWarehouses(rows: WarehouseDirectoryRow[]): WarehouseDirectoryRow[] {
  return [...rows].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
    return a.name.localeCompare(b.name) || a.code.localeCompare(b.code)
  })
}

async function readWarehouses(): Promise<WarehouseDirectoryRow[]> {
  const result = await db().queryDocs<Record<string, unknown> & { id: string }>({
    collection: WAREHOUSES_COLLECTION,
    pagination: { limit: 500 },
  })
  if (!result.success || !result.data) {
    throw result.error || new Error('Failed to list warehouses')
  }
  return sortWarehouses(result.data.map((row) => asWarehouse(row)))
}

async function ensureDefaultWarehouse(): Promise<void> {
  const existing = await db().findDocById<Record<string, unknown>>(
    WAREHOUSES_COLLECTION,
    ZERO_WAREHOUSE_ID,
  )
  if (!existing.success) {
    throw existing.error || new Error('Failed to read the default warehouse')
  }
  if (existing.data) return

  const created = await db().createDoc(
    WAREHOUSES_COLLECTION,
    {
      id: ZERO_WAREHOUSE_ID,
      name: DEFAULT_WAREHOUSE_NAME,
      code: 'main',
      address: '',
      active: true,
      isDefault: true,
      inventoryStoreId: DEFAULT_INVENTORY_STORE_ID,
    },
    { id: ZERO_WAREHOUSE_ID },
  )
  if (created.success) return

  const again = await db().findDocById(WAREHOUSES_COLLECTION, ZERO_WAREHOUSE_ID)
  if (again.success && again.data) return
  throw created.error || new Error('Failed to seed the default warehouse')
}

function assertUniqueWarehouseCode(rows: WarehouseDirectoryRow[], code: string, exceptId?: string) {
  const needle = code.trim().toLowerCase()
  const taken = rows.some(
    (row) => row.id !== exceptId && row.code.trim().toLowerCase() === needle,
  )
  if (taken) throw new Error('Warehouse code is already in use')
}

function revalidateWarehouses() {
  revalidatePath('/admin/store/warehouses')
}

export async function listWarehousesAction(): Promise<WarehouseDirectoryRow[]> {
  await assertAdmin()
  await ensureDefaultWarehouse()
  return readWarehouses()
}

export async function createWarehouseAction(input: {
  name: string
  code: string
  address?: string
}): Promise<WarehouseDirectoryRow[]> {
  await assertAdmin()
  await ensureDefaultWarehouse()
  const name = input.name.trim()
  const code = input.code.trim()
  if (!name) throw new Error('Warehouse name is required')
  if (!code) throw new Error('Warehouse code is required')

  const rows = await readWarehouses()
  assertUniqueWarehouseCode(rows, code)

  const id = `warehouse_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const created = await db().createDoc(
    WAREHOUSES_COLLECTION,
    {
      id,
      name,
      code,
      address: (input.address || '').trim(),
      active: true,
      isDefault: false,
      inventoryStoreId: id,
    },
    { id },
  )
  if (!created.success) throw created.error || new Error('Failed to create warehouse')
  revalidateWarehouses()
  return readWarehouses()
}

export async function updateWarehouseAction(input: {
  id: string
  name: string
  code: string
  address?: string
  active: boolean
  isDefault?: boolean
  inventoryStoreId?: string
}): Promise<WarehouseDirectoryRow[]> {
  await assertAdmin()
  const id = input.id.trim()
  const current = await db().findDocById<Record<string, unknown>>(WAREHOUSES_COLLECTION, id)
  if (!current.success) throw current.error || new Error('Failed to read warehouse')
  if (!current.data) throw new Error('Warehouse not found')

  const row = asWarehouse(current.data)
  const name = input.name.trim()
  const code = input.code.trim()
  if (!name) throw new Error('Warehouse name is required')
  if (!code) throw new Error('Warehouse code is required')

  if (row.isDefault) {
    if (input.active === false || input.isDefault === false) {
      throw new Error('The default warehouse stays active')
    }
    if (
      input.inventoryStoreId !== undefined &&
      input.inventoryStoreId !== row.inventoryStoreId
    ) {
      throw new Error('The default warehouse inventory store cannot be changed')
    }
  } else if (input.isDefault === true) {
    throw new Error('Only the main warehouse can be the default')
  }

  const rows = await readWarehouses()
  assertUniqueWarehouseCode(rows, code, id)

  const updated = await db().updateDoc(WAREHOUSES_COLLECTION, id, {
    id,
    name,
    code,
    address: (input.address || '').trim(),
    active: row.isDefault ? true : input.active,
    isDefault: row.isDefault,
    inventoryStoreId: row.inventoryStoreId,
  })
  if (!updated.success) throw updated.error || new Error('Failed to update warehouse')
  revalidateWarehouses()
  return readWarehouses()
}

export async function deleteWarehouseAction(id: string): Promise<WarehouseDirectoryRow[]> {
  await assertAdmin()
  const warehouseId = id.trim()
  const current = await db().findDocById<Record<string, unknown>>(
    WAREHOUSES_COLLECTION,
    warehouseId,
  )
  if (!current.success) throw current.error || new Error('Failed to read warehouse')
  if (!current.data) throw new Error('Warehouse not found')

  const row = asWarehouse(current.data)
  if (row.isDefault || warehouseId === ZERO_WAREHOUSE_ID) {
    throw new Error('This warehouse cannot be deleted.')
  }

  const movements = await db().queryDocs({
    collection: 'stock_movements',
    filters: [{ field: 'warehouseId', operator: '=', value: warehouseId }],
    pagination: { limit: 1 },
  })
  if (!movements.success) {
    throw movements.error || new Error('Failed to check stock movements')
  }
  if (movements.data && movements.data.length > 0) {
    throw new Error('This warehouse cannot be deleted.')
  }

  const deleted = await db().deleteDoc(WAREHOUSES_COLLECTION, warehouseId)
  if (!deleted.success) throw deleted.error || new Error('Failed to delete warehouse')
  revalidateWarehouses()
  return readWarehouses()
}

export async function assertWarehouseOperator(warehouseId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')
  if (isPlatformAdmin(session.user.role)) return { session, role: 'admin' as const }
  const assignment = await db().findDocById<Record<string, unknown>>(
    'warehouse_assignments',
    `${warehouseId}_${session.user.id}`,
  )
  if (!assignment.success || !assignment.data || assignment.data.active === false) {
    throw new Error('Unauthorized')
  }
  return { session, role: String(assignment.data.role || 'worker') }
}

export async function receiveWarehouseStockAction(input: {
  warehouseId: string
  productId: string
  quantity: number
  unitCost: number
  amountPaid: number
  amountOwed: number
  supplierName?: string
}) {
  const { session } = await assertWarehouseOperator(input.warehouseId)
  const { receiveIntoWarehouse } = await import('@/features/store/services/warehouse-fulfillment')
  await receiveIntoWarehouse({ ...input, userId: session.user.id })
  revalidatePath('/admin/store/stock')
  revalidatePath('/admin/store/warehouses')
  revalidatePath(`/warehouses/${input.warehouseId}`)
}

export async function transferWarehouseStockAction(input: {
  fromWarehouseId: string
  toWarehouseId: string
  productId: string
  quantity: number
}) {
  const { session } = await assertWarehouseOperator(input.fromWarehouseId)
  const { transferBetweenWarehouses } = await import('@/features/store/services/warehouse-fulfillment')
  await transferBetweenWarehouses({ ...input, userId: session.user.id })
  revalidatePath('/admin/store/stock')
  revalidatePath('/admin/store/warehouses')
}

export async function recordSupplierPaymentAction(input: { movementId: string; warehouseId: string; amount: number }) {
  await assertWarehouseOperator(input.warehouseId)
  const { recordSupplierPayment } = await import('@/features/store/services/warehouse-fulfillment')
  await recordSupplierPayment(input.movementId, input.amount)
  revalidatePath('/admin/store/stock')
}

export interface WarehouseAssignmentRow {
  id: string
  warehouseId: string
  userId: string
  role: 'manager' | 'worker'
  active: boolean
  email?: string
  name?: string
}

export async function listWarehouseAssignmentsAction(warehouseId: string): Promise<WarehouseAssignmentRow[]> {
  const access = await assertWarehouseOperator(warehouseId)
  if (access.role === 'worker') return []
  const result = await db().queryDocs<Record<string, unknown> & { id: string }>({
    collection: 'warehouse_assignments',
    filters: [{ field: 'warehouseId', operator: '=', value: warehouseId }],
    pagination: { limit: 100 },
  })
  const rows = result.success && result.data ? result.data : []
  return rows.map((row) => ({
    id: row.id,
    warehouseId,
    userId: String(row.userId || ''),
    role: row.role === 'manager' ? 'manager' : 'worker',
    active: row.active !== false,
    email: typeof row.email === 'string' ? row.email : undefined,
    name: typeof row.name === 'string' ? row.name : undefined,
  }))
}

export async function searchWarehouseUsersAction(query: string) {
  await assertAdmin()
  const needle = query.trim().toLowerCase()
  if (needle.length < 2) return []
  const result = await db().queryDocs<Record<string, unknown> & { id: string }>({
    collection: 'users',
    pagination: { limit: 80 },
  })
  const rows = result.success && result.data ? result.data : []
  return rows
    .filter((row) => {
      const email = String(row.email || '').toLowerCase()
      const name = String(row.name || row.displayName || '').toLowerCase()
      return email.includes(needle) || name.includes(needle)
    })
    .slice(0, 12)
    .map((row) => ({
      id: row.id,
      email: String(row.email || ''),
      name: String(row.name || row.displayName || row.email || row.id),
    }))
}

export async function saveWarehouseAssignmentAction(input: {
  warehouseId: string
  userId: string
  role: 'manager' | 'worker'
  active: boolean
  email?: string
  name?: string
}) {
  const access = await assertWarehouseOperator(input.warehouseId)
  if (access.role === 'worker') throw new Error('Unauthorized')
  const id = `${input.warehouseId}_${input.userId}`
  const existing = await db().findDocById('warehouse_assignments', id)
  const payload = {
    id,
    warehouseId: input.warehouseId,
    userId: input.userId,
    role: input.role,
    active: input.active,
    email: input.email || '',
    name: input.name || '',
  }
  const saved = existing.success && existing.data
    ? await db().updateDoc('warehouse_assignments', id, payload)
    : await db().createDoc('warehouse_assignments', payload, { id })
  if (!saved.success) throw saved.error || new Error('Failed to save assignment')
  revalidatePath(`/admin/store/warehouses/${input.warehouseId}`)
  revalidatePath('/warehouses')
}

export async function saveWarehouseSenderAction(input: {
  warehouseId: string
  novaPostSenderDivisionId: string
  novaPostSenderDivisionName: string
  novaPostSenderAddress: string
}) {
  await assertAdmin()
  const updated = await db().updateDoc(WAREHOUSES_COLLECTION, input.warehouseId, {
    novaPostSenderDivisionId: input.novaPostSenderDivisionId,
    novaPostSenderDivisionName: input.novaPostSenderDivisionName,
    novaPostSenderAddress: input.novaPostSenderAddress,
  })
  if (!updated.success) throw updated.error || new Error('Failed to save sender branch')
  revalidatePath(`/admin/store/warehouses/${input.warehouseId}`)
}

export async function listMyWarehousesAction() {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')
  if (isPlatformAdmin(session.user.role)) {
    const { listFulfillmentWarehouses } = await import('@/features/store/services/warehouse-fulfillment')
    return listFulfillmentWarehouses()
  }
  const result = await db().queryDocs<Record<string, unknown> & { id: string }>({
    collection: 'warehouse_assignments',
    filters: [{ field: 'userId', operator: '=', value: session.user.id }],
    pagination: { limit: 50 },
  })
  const rows = (result.success && result.data ? result.data : []).filter((row) => row.active !== false)
  const { getFulfillmentWarehouse } = await import('@/features/store/services/warehouse-fulfillment')
  const warehouses = []
  for (const row of rows) {
    warehouses.push(await getFulfillmentWarehouse(String(row.warehouseId || '')))
  }
  return warehouses
}

export async function updateAdminReferralDefaultAction(percent: number) {
  const session = await assertAdmin()
  const { getStoreSettings, saveStoreSettings } = await import('@/features/store/services/store-settings-service')
  const current = await getStoreSettings()
  await saveStoreSettings({ ...current, referralCommissionPercent: percent }, session.user.id)
  revalidatePath('/admin/store/settings')
  revalidatePath('/admin/store/commissions')
}

export async function setVendorReferralPercentAction(vendorEntityId: string, percent: number) {
  await assertAdmin()
  const entityId = vendorEntityId.trim()
  if (!entityId) throw new Error('Vendor is required')
  const { getMerchantConfigByEntityId } = await import('@/features/store/lib/merchant-config')
  const existing = await getMerchantConfigByEntityId(entityId)
  if (existing?.id) {
    const updated = await db().updateDoc('merchant_configs', existing.id, {
      commissionStructure: {
        ...(existing.commissionStructure || {}),
        referralCommission: percent,
      },
    })
    if (!updated.success) throw updated.error || new Error('Failed to save vendor referral percent')
  } else {
    const id = `merchant_${entityId}`
    const created = await db().createDoc(
      'merchant_configs',
      {
        id,
        ownerEntityId: entityId,
        commissionStructure: { referralCommission: percent },
      },
      { id },
    )
    if (!created.success) throw created.error || new Error('Failed to save vendor referral percent')
  }
  revalidatePath('/admin/store/commissions')
}
