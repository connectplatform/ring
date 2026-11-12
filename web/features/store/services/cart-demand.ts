import 'server-only'

import { getSharedPgPool } from '@/lib/database/shared-pg-pool'
import { logger } from '@/lib/logger'

export type ProductCartDemand = {
  productId: string
  name: string
  stock: number
  carts: number
  waitingCarts: number
  units: number
}

const VENDOR_MATCH = `
  coalesce(
    nullif(p.data->>'entity_id', ''),
    nullif(p.data->>'entityId', ''),
    nullif(p.data->>'vendorId', ''),
    nullif(p.data->>'ownerEntityId', ''),
    nullif(p.data->>'productOwner', '')
  ) = $1
`

function asDemand(row: {
  product_id: string
  name: string | null
  stock: number | null
  carts: number | null
  waiting_carts: number | null
  units: number | null
}): ProductCartDemand {
  return {
    productId: row.product_id,
    name: row.name || row.product_id,
    stock: Number(row.stock) || 0,
    carts: Number(row.carts) || 0,
    waitingCarts: Number(row.waiting_carts) || 0,
    units: Number(row.units) || 0,
  }
}

/** Cart counts for a page of product ids. Empty map when the index table is not migrated yet. */
export async function cartDemandForProducts(
  productIds: string[],
): Promise<Map<string, ProductCartDemand>> {
  const ids = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))]
  const map = new Map<string, ProductCartDemand>()
  if (ids.length === 0) return map
  try {
    const pool = await getSharedPgPool()
    const { rows } = await pool.query<{
      product_id: string
      carts: number
      waiting_carts: number
      units: number
    }>(
      `SELECT product_id,
              count(*)::int AS carts,
              count(*) FILTER (WHERE waiting)::int AS waiting_carts,
              coalesce(sum(qty) FILTER (WHERE NOT waiting), 0)::int AS units
         FROM store_cart_lines
        WHERE product_id = ANY($1::varchar[])
        GROUP BY product_id`,
      [ids],
    )
    for (const row of rows) {
      map.set(row.product_id, asDemand({ ...row, name: null, stock: 0 }))
    }
  } catch (error) {
    logger.warn('cart demand lookup skipped', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
  return map
}

export type VendorCartInterest = {
  wanted: ProductCartDemand[]
  fillable: ProductCartDemand[]
  quiet: ProductCartDemand[]
}

/**
 * Vendor-facing demand.
 * wanted: products already sitting in carts, busiest first.
 * fillable: waiting rows whose catalog stock is already above zero.
 * quiet: stocked products nobody has in a cart.
 */
export async function vendorCartInterest(vendorEntityId: string): Promise<VendorCartInterest> {
  const empty = { wanted: [], fillable: [], quiet: [] }
  if (!vendorEntityId) return empty
  try {
    const pool = await getSharedPgPool()
    const { rows } = await pool.query<{
      product_id: string
      name: string | null
      stock: number | null
      carts: number | null
      waiting_carts: number | null
      units: number | null
    }>(
      `SELECT p.id AS product_id,
              p.data->>'name' AS name,
              max(COALESCE(
                CASE WHEN p.data->>'stock' ~ '^-?[0-9]+$' THEN (p.data->>'stock')::int END,
                CASE WHEN p.data->>'stock_quantity' ~ '^-?[0-9]+$' THEN (p.data->>'stock_quantity')::int END,
                0
              ))::int AS stock,
              count(l.user_id)::int AS carts,
              count(l.user_id) FILTER (WHERE l.waiting)::int AS waiting_carts,
              coalesce(sum(l.qty) FILTER (WHERE NOT l.waiting), 0)::int AS units
         FROM store_products p
         LEFT JOIN store_cart_lines l ON l.product_id = p.id
        WHERE ${VENDOR_MATCH}
        GROUP BY p.id, p.data->>'name'`,
      [vendorEntityId],
    )
    const all = rows.map(asDemand)
    const wanted = all
      .filter((row) => row.carts > 0)
      .sort((a, b) => b.carts - a.carts || b.waitingCarts - a.waitingCarts || b.units - a.units)
      .slice(0, 8)
    const fillable = all
      .filter((row) => row.waitingCarts > 0 && row.stock > 0)
      .sort((a, b) => b.waitingCarts - a.waitingCarts)
      .slice(0, 5)
    const quiet = all
      .filter((row) => row.stock > 0 && row.carts === 0)
      .sort((a, b) => b.stock - a.stock)
      .slice(0, 5)
    return { wanted, fillable, quiet }
  } catch (error) {
    logger.warn('vendor cart interest skipped', {
      vendorEntityId,
      error: error instanceof Error ? error.message : String(error),
    })
    return empty
  }
}
