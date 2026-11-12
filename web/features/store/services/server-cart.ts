/**
 * Server cart mirror — session-bound SSOT for authenticated buyers.
 * Client ring_cart hydrates from GET /api/store/cart; soft-holds via syncCartSoftHolds.
 */

import 'server-only'

import { db } from '@/lib/database'
import { getMainCurrencySymbol } from '@/lib/ring-config-core'
import { syncCartSoftHolds } from '@/features/store/services/inventory-sync'
import { PostgreSQLStoreAdapter } from '@/features/store/postgresql-adapter'
import type { StoreProduct } from '@/features/store/types'

export type ServerCartLine = {
  productId: string
  qty: number
  /** Backorder. qty stays 0 until a warehouse can ship. */
  waiting?: boolean
}

export type ServerCartDoc = {
  id: string
  userId: string
  items: ServerCartLine[]
  updatedAt: string
}

const COLLECTION = 'store_user_carts'

function cartDocId(userId: string): string {
  return `cart_${userId}`
}

function normalizeLines(items: ServerCartLine[]): ServerCartLine[] {
  const seen = new Set<string>()
  const lines: ServerCartLine[] = []
  for (const item of items) {
    const productId = String(item.productId || '').trim()
    if (!productId || seen.has(productId)) continue
    seen.add(productId)
    if (item.waiting) {
      lines.push({ productId, qty: 0, waiting: true })
      continue
    }
    if (!Number.isFinite(item.qty) || item.qty <= 0) continue
    lines.push({ productId, qty: Math.max(1, Math.floor(item.qty)), waiting: false })
  }
  return lines
}

async function replaceCartLineIndex(userId: string, items: ServerCartLine[]): Promise<void> {
  const { getSharedPgPool } = await import('@/lib/database/shared-pg-pool')
  const pool = await getSharedPgPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM store_cart_lines WHERE user_id = $1', [userId])
    if (items.length > 0) {
      await client.query(
        `INSERT INTO store_cart_lines (user_id, product_id, qty, waiting)
         SELECT $1, x.product_id, x.qty, x.waiting
           FROM jsonb_to_recordset($2::jsonb) AS x(product_id varchar, qty int, waiting boolean)`,
        [
          userId,
          JSON.stringify(
            items.map((line) => ({
              product_id: line.productId,
              qty: line.waiting ? 0 : line.qty,
              waiting: Boolean(line.waiting),
            })),
          ),
        ],
      )
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    const { logger } = await import('@/lib/logger')
    logger.warn('store_cart_lines index was not updated', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    })
  } finally {
    client.release()
  }
}

export async function getServerCart(userId: string): Promise<ServerCartDoc> {
  const id = cartDocId(userId)
  const existing = await db().findDocById<ServerCartDoc>(COLLECTION, id)
  if (existing.success && existing.data) {
    const items = Array.isArray(existing.data.items) ? existing.data.items : []
    return {
      id,
      userId,
      items: normalizeLines(
        items.map((i) => ({
          productId: String(i.productId || ''),
          qty: Number(i.qty),
          waiting: Boolean(i.waiting),
        })),
      ),
      updatedAt: String(existing.data.updatedAt || new Date().toISOString()),
    }
  }
  return { id, userId, items: [], updatedAt: new Date().toISOString() }
}

/** Upsert cart doc (PG createDoc does not honor merge). Soft-hold after successful write. */
export async function setServerCart(
  userId: string,
  items: ServerCartLine[],
): Promise<ServerCartDoc> {
  const id = cartDocId(userId)
  const normalized = normalizeLines(items)
  const doc: ServerCartDoc = {
    id,
    userId,
    items: normalized,
    updatedAt: new Date().toISOString(),
  }

  const existing = await db().findDocById<ServerCartDoc>(COLLECTION, id)
  if (existing.success && existing.data) {
    const updated = await db().updateDoc(COLLECTION, id, doc)
    if (!updated.success) {
      throw updated.error || new Error('Failed to update server cart')
    }
  } else {
    const created = await db().createDoc(COLLECTION, doc, { id })
    if (!created.success) {
      // Race: another writer created — retry update
      const retry = await db().updateDoc(COLLECTION, id, doc)
      if (!retry.success) {
        throw created.error || retry.error || new Error('Failed to create server cart')
      }
    }
  }

  const adapter = new PostgreSQLStoreAdapter()
  const holdItems: Array<{
    productId: string
    quantity: number
    digitalProduct?: boolean
    instantDelivery?: boolean
  }> = []

  for (const line of normalized) {
    const product = await adapter.getProductById(line.productId)
    holdItems.push({
      productId: line.productId,
      quantity: line.qty,
      digitalProduct: product?.digitalProduct,
      instantDelivery: product?.instantDelivery,
    })
  }

  await syncCartSoftHolds(
    userId,
    holdItems.filter((line) => line.quantity > 0),
  )
  await replaceCartLineIndex(userId, normalized)
  return doc
}

export async function addToServerCart(
  userId: string,
  productId: string,
  qtyDelta = 1,
): Promise<ServerCartDoc> {
  const cart = await getServerCart(userId)
  const existing = cart.items.find((i) => i.productId === productId)
  const nextItems = existing
    ? cart.items.map((i) =>
        i.productId === productId
          ? {
              productId,
              qty: (i.waiting ? 0 : i.qty) + Math.max(1, Math.floor(qtyDelta)),
              waiting: false,
            }
          : i,
      )
    : [...cart.items, { productId, qty: Math.max(1, Math.floor(qtyDelta)) }]
  return setServerCart(userId, nextItems)
}

export type CartSummaryLine = {
  productId: string
  name: string
  qty: number
  unitPrice: string
  currency: string
}

export async function summarizeServerCart(userId: string): Promise<{
  items: CartSummaryLine[]
  totalItems: number
  empty: boolean
}> {
  const cart = await getServerCart(userId)
  const adapter = new PostgreSQLStoreAdapter()
  const lines: CartSummaryLine[] = []

  for (const line of cart.items) {
    const product: StoreProduct | null = await adapter.getProductById(line.productId)
    lines.push({
      productId: line.productId,
      name: product?.name || 'Product',
      qty: line.qty,
      unitPrice: product?.price || '0',
      currency: String(product?.currency || getMainCurrencySymbol()),
    })
  }

  return {
    items: lines,
    totalItems: lines.reduce((sum, l) => sum + l.qty, 0),
    empty: lines.length === 0,
  }
}
