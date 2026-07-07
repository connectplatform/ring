import 'server-only'

import { db } from '@/lib/database'
import type { DeskOrder, DeskOrderStatus } from '@/lib/zod/desk-schemas'

// Type that represents a DeskOrder document returned from the database, including the unique id
type DeskOrderDoc = DeskOrder & Record<string, unknown> & { id: string }

// TODO: With Next.js 16/React 19, consider making these "Server Actions" if callable via form or client interaction. Switch to action endpoints when moving to /app router, using native mutation handlers.

/**
 * Finds a desk order by its idempotency key.
 * Prevents duplicate desk orders by checking for an existing non-null document.
 * 
 * @param idempotencyKey - Unique string to ensure idempotency of desk orders
 * @returns Promise resolving with DeskOrderDoc or null
 */
export async function findDeskOrderByIdempotencyKey(
  idempotencyKey: string,
): Promise<DeskOrderDoc | null> {
  // Query the 'desk_orders' collection using a filtered search on idempotency_key with a limit of 1
  const result = await db().queryDocs<DeskOrderDoc>({
    collection: 'desk_orders',
    filters: [{ field: 'idempotency_key', operator: '==', value: idempotencyKey }],
    pagination: { limit: 1 },
  })

  // Handle query errors or absence of a suitable document gracefully by returning null
  if (!result.success || !result.data?.length) {
    return null // No matching desk order found (idempotency is safe)
  }

  // Return the first result (should be unique by idempotency key if constraints are enforced)
  return result.data[0]
}

/**
 * Creates a new desk order by generating a unique order id and adding timestamp metadata.
 * Persists the desk order into the database. Throws detailed error if any insertion step fails.
 * 
 * @param order - DeskOrder data structure (user-supplied)
 * @returns Promise resolving with saved DeskOrderDoc (with id and timestamps)
 */
// TODO: With Next.js 16+/React 19, consider using server actions for mutation logic to reduce API boilerplate and enable progressive enhancements.
// TODO: Switch to server functions for desk order mutation routes (see experimental/actions API in Next.js 16).
export async function createDeskOrder(order: DeskOrder): Promise<DeskOrderDoc> {
  // Generate a cryptographically-strong unique id for identification.
  // TODO: Ensure fallback for crypto.randomUUID for legacy Node.js (<19) compatibility.
  const id = `desk_${crypto.randomUUID()}`
  
  // Prepare a payload by merging order with creation and update timestamps
  const now = new Date().toISOString()
  const payload = {
    ...order,
    created_at: now,
    updated_at: now,
  }

  // Insert the desk order document into the database under 'desk_orders' collection.
  // MOCK CODE, TODO: Replace db().createDoc with direct database SDK/API integration for improved type safety and atomicity.
  //   1. Replace with direct server action call (if possible) in future codemod.
  //   2. Add error logging and tracing (e.g. Sentry) for visibility.
  const result = await db().createDoc('desk_orders', payload, { id })

  if (!result.success) {
    // If insertion failed, throw an error with context for debugging.
    throw new Error(result.error?.message ?? 'Failed to create desk order')
  }

  // Return the created object, including id and all payload properties.
  return { id, ...payload }
}

/**
 * Updates the status and (optional) additional fields of the specified desk order.
 * Always updates the 'updated_at' field to reflect the patch.
 * Throws error if update fails.
 * 
 * @param orderId - Unique string identifying desk order document
 * @param status - New DeskOrderStatus to apply
 * @param patch - Additional field overrides as key-value pairs (optional)
 * @returns Promise<void> (throws on error)
 */
// TODO: For Next.js 16+/React 19, refactor to server action to handle atomic status updates and concurrency tracking.
// TODO: Add optimistic UI mutation support via server actions or cache helpers in Next.js app router.
export async function updateDeskOrderStatus(
  orderId: string,
  status: DeskOrderStatus,
  patch: Partial<DeskOrder> = {},
): Promise<void> {
  // Compose document update: always set status and update timestamp, include patch overrides.
  const result = await db().updateDoc('desk_orders', orderId, {
    status,
    ...patch, // Patch may include fields such as notes, prices, etc.
    updated_at: new Date().toISOString(),
  })

  if (!result.success) {
    // Log error details (could be replaced with structured logger or error tracking)
    throw new Error(result.error?.message ?? 'Failed to update desk order')
  }
}
