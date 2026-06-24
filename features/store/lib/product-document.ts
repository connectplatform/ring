import type { ApprovalStatus } from '@/features/store/types'

/** Main Store listing id (platform-wide catalog). */
export const MAIN_STORE_ID = '1'

type ProductDoc = Record<string, unknown>

/** Read approvalStatus from root or legacy nested `data.approvalStatus`. */
export function resolveApprovalStatus(doc: ProductDoc): ApprovalStatus | null {
  const root = doc.approvalStatus
  if (root === 'pending' || root === 'approved' || root === 'rejected') {
    return root
  }
  const nested = doc.data
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const legacy = (nested as ProductDoc).approvalStatus
    if (legacy === 'pending' || legacy === 'approved' || legacy === 'rejected') {
      return legacy
    }
  }
  return null
}

/** Read listStores from root or legacy nested path. */
export function resolveListStores(doc: ProductDoc): string[] {
  const root = doc.listStores
  if (Array.isArray(root)) {
    return root.map(String)
  }
  const nested = doc.data
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const legacy = (nested as ProductDoc).listStores
    if (Array.isArray(legacy)) {
      return legacy.map(String)
    }
  }
  if (doc.productListedAt && Array.isArray(doc.productListedAt)) {
    return doc.productListedAt.map(String)
  }
  return []
}

/** Admin delist flag — inactive on Main Store only (vendor storefront may stay active). */
export function resolveMainStoreStatus(doc: ProductDoc): 'active' | 'inactive' {
  if (doc.mainStoreStatus === 'inactive') return 'inactive'
  const nested = doc.data
  if (nested && typeof nested === 'object' && (nested as ProductDoc).mainStoreStatus === 'inactive') {
    return 'inactive'
  }
  return 'active'
}

export function isListedOnMainStore(doc: ProductDoc): boolean {
  return resolveListStores(doc).includes(MAIN_STORE_ID)
}

/** Whether a product should appear on the public Main Store catalog. */
export function isVisibleOnMainStore(doc: ProductDoc): boolean {
  const status = doc.status != null ? String(doc.status) : 'active'
  if (status !== 'active') return false
  if (resolveMainStoreStatus(doc) === 'inactive') return false
  if (!isListedOnMainStore(doc)) return false
  return resolveApprovalStatus(doc) === 'approved'
}

export function resolveVendorEntityId(doc: ProductDoc): string {
  return String(
    doc.entity_id ??
      doc.entityId ??
      doc.ownerEntityId ??
      doc.vendorId ??
      (doc.data && typeof doc.data === 'object'
        ? (doc.data as ProductDoc).vendorId
        : '') ??
      '',
  )
}

/** Flatten legacy nested product fields onto the JSONB root for writes. */
export function flattenProductDocumentForWrite(
  doc: ProductDoc,
  patch: ProductDoc = {},
): ProductDoc {
  const legacy =
    doc.data && typeof doc.data === 'object' && !Array.isArray(doc.data)
      ? (doc.data as ProductDoc)
      : {}

  const merged: ProductDoc = {
    ...legacy,
    ...doc,
    ...patch,
  }

  delete merged.data

  if (patch.approvalStatus !== undefined) {
    merged.approvalStatus = patch.approvalStatus
  }
  if (patch.listStores !== undefined) {
    merged.listStores = patch.listStores
    merged.productListedAt = patch.listStores
  }
  if (patch.mainStoreStatus !== undefined) {
    merged.mainStoreStatus = patch.mainStoreStatus
  }

  merged.updatedAt = new Date().toISOString()
  return merged
}

export function buildMainStoreListingPatch(opts: {
  submitToMainStore: boolean
  existing?: ProductDoc | null
  /** When true, preserve approved status instead of resetting to pending */
  preserveApproved?: boolean
}): Pick<ProductDoc, 'listStores' | 'approvalStatus' | 'mainStoreStatus' | 'productListedAt'> {
  const existingStatus = opts.existing ? resolveApprovalStatus(opts.existing) : null

  if (!opts.submitToMainStore) {
    const stores = resolveListStores(opts.existing ?? {}).filter((id) => id !== MAIN_STORE_ID)
    return {
      listStores: stores,
      productListedAt: stores,
      approvalStatus: null,
      mainStoreStatus: 'inactive',
    }
  }

  return {
    listStores: [MAIN_STORE_ID],
    productListedAt: [MAIN_STORE_ID],
    approvalStatus:
      existingStatus === 'approved' || opts.preserveApproved
        ? 'approved'
        : 'pending',
    mainStoreStatus: 'active',
  }
}
