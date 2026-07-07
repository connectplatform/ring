import type { ApprovalStatus } from '@/features/store/types'

/** Main Store listing id representing the platform-wide catalog. */
export const MAIN_STORE_ID = '1'

// Main product document type: accepts any fields as string keys.
type ProductDoc = Record<string, unknown>

/**
 * Resolves the approval status for a product document.
 * Checks the root for an approval status first (normalized), then checks for a legacy nested value in `data.approvalStatus`.
 * Returns: 'pending', 'approved', 'rejected' or null if not found.
 */
export function resolveApprovalStatus(doc: ProductDoc): ApprovalStatus | null {
  // Try directly from root property
  const root = doc.approvalStatus
  if (root === 'pending' || root === 'approved' || root === 'rejected') {
    return root
  }
  // Try legacy location inside nested data property, if present.
  const nested = doc.data
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const legacy = (nested as ProductDoc).approvalStatus
    if (legacy === 'pending' || legacy === 'approved' || legacy === 'rejected') {
      return legacy
    }
  }
  // None found, fall back to null.
  return null
}

/**
 * Resolves the store listing IDs for the product.
 * Tries:
 * 1. Root `listStores` (preferred, normalized)
 * 2. Legacy nested `data.listStores`
 * 3. Fallback to `productListedAt` array (legacy artifact)
 * Returns a string array. Always stringifies values for safety.
 */
export function resolveListStores(doc: ProductDoc): string[] {
  const root = doc.listStores
  if (Array.isArray(root)) {
    // Main location, normalized format.
    return root.map(String)
  }
  const nested = doc.data
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const legacy = (nested as ProductDoc).listStores
    if (Array.isArray(legacy)) {
      return legacy.map(String)
    }
  }
  // Some older documents use 'productListedAt'.
  if (doc.productListedAt && Array.isArray(doc.productListedAt)) {
    return doc.productListedAt.map(String)
  }
  // Default to empty array if nothing is found.
  return []
}

/**
 * Resolves the "delisted from main store" flag for a product.
 * Only checks `mainStoreStatus` for 'inactive'; otherwise assumes active.
 * Looks both for normalized field and (legacy) nested field under `data`.
 * Returns only 'active' or 'inactive'.
 */
export function resolveMainStoreStatus(doc: ProductDoc): 'active' | 'inactive' {
  // Main normalized field.
  if (doc.mainStoreStatus === 'inactive') return 'inactive'
  // Check for legacy nested field.
  const nested = doc.data
  if (
    nested &&
    typeof nested === 'object' &&
    (nested as ProductDoc).mainStoreStatus === 'inactive'
  ) {
    return 'inactive'
  }
  // Default to 'active'
  return 'active'
}

/**
 * Determines if product is listed on the main store.
 * Checks if MAIN_STORE_ID is included in the store listing array.
 */
export function isListedOnMainStore(doc: ProductDoc): boolean {
  return resolveListStores(doc).includes(MAIN_STORE_ID)
}

/**
 * Determines if a product is visible on the public Main Store catalog.
 * Checks status, store listing, main store status, and approval.
 * Returns true if ALL conditions are met--otherwise false.
 */
export function isVisibleOnMainStore(doc: ProductDoc): boolean {
  // If the explicit `status` is not null, ensure it is string form.
  const status = doc.status != null ? String(doc.status) : 'active'
  // Only 'active' products are visible
  if (status !== 'active') return false
  // If explicit or legacy delisting
  if (resolveMainStoreStatus(doc) === 'inactive') return false
  // Not listed for main store
  if (!isListedOnMainStore(doc)) return false
  // Must be approved (approvalStatus = 'approved')
  return resolveApprovalStatus(doc) === 'approved'
}

/**
 * Resolves the vendor/entity ID for this product.
 * Tries, in order: entity_id, entityId, ownerEntityId, vendorId, legacy nested vendorId inside `data`.
 * Always coerces to string for output.
 */
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

/**
 * Flattens legacy product documents for writing (saves).
 * - Merges all fields from:
 *   - legacy nested `data`
 *   - root document fields
 *   - optional `patch` object (overrides everything else)
 * - Removes nested data property to ensure fully flat output
 * - Always updates `updatedAt` to current time
 * - Mirrors listStores onto productListedAt for legacy compatibility
 *
 * TODO: If/when moving to newer DB schema, remove legacy mapping and clean unused fields automatically.
 */
export function flattenProductDocumentForWrite(
  doc: ProductDoc,
  patch: ProductDoc = {},
): ProductDoc {
  // Extract legacy fields from nested data if object and not array.
  const legacy =
    doc.data && typeof doc.data === 'object' && !Array.isArray(doc.data)
      ? (doc.data as ProductDoc)
      : {}

  // Merge: PATCH fields override DOC, DOC overrides legacy.
  const merged: ProductDoc = {
    ...legacy,
    ...doc,
    ...patch,
  }

  // Remove legacy nested `data` (now flattening to the root).
  delete merged.data

  // If patch includes approvalStatus, explicitly set.
  if (patch.approvalStatus !== undefined) {
    merged.approvalStatus = patch.approvalStatus
  }
  // listStores is the single source of truth (also copy to productListedAt for legacy)
  if (patch.listStores !== undefined) {
    merged.listStores = patch.listStores
    merged.productListedAt = patch.listStores
  }
  // If mainStoreStatus needs to be patched, set that as well.
  if (patch.mainStoreStatus !== undefined) {
    merged.mainStoreStatus = patch.mainStoreStatus
  }

  // Always touch the timestamp.
  merged.updatedAt = new Date().toISOString()
  return merged
}

/**
 * Builds a patch object for updating document fields used to create or update a Main Store listing.
 *
 * @param opts.submitToMainStore - whether to list on main store or not
 * @param opts.existing - (optional) existing document to merge or preserve state from
 * @param opts.preserveApproved - (optional) if true, will not clear 'approved' status if already approved
 * @returns minimal object patch for write functions or upserts
 */
export function buildMainStoreListingPatch(opts: {
  submitToMainStore: boolean
  existing?: ProductDoc | null
  /** When true, preserve approved status instead of resetting to pending */
  preserveApproved?: boolean
}): Pick<
  ProductDoc,
  'listStores' | 'approvalStatus' | 'mainStoreStatus' | 'productListedAt'
> {
  // Always detect current status if existing document present (for preserveApproved)
  const existingStatus = opts.existing ? resolveApprovalStatus(opts.existing) : null

  if (!opts.submitToMainStore) {
    // Remove main store from store listings
    const stores = resolveListStores(opts.existing ?? {}).filter(
      (id) => id !== MAIN_STORE_ID,
    )
    return {
      listStores: stores,
      productListedAt: stores,
      approvalStatus: null,
      mainStoreStatus: 'inactive',
    }
  }

  // By default, list only on the main store.
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

// TODO: Once we are able to use Next.js app directory and server components for these document manipulations, and Database schema is migrated, refactor legacy/flat merge logic using:
  // - React Structuring with Server Actions for document patching
  // - Type inference via Zod or native Next.js type helpers
  // - Remove legacy field juggling and switch to single-source product doc format
  // - Possibly replace manual time updates with DB-side triggers for `updatedAt`