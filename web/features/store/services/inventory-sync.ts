/**
 * Inventory Synchronization Service
 *
 * Manages reservations, inventory_levels mirror of store_products.stock,
 * and atomic paid-sale commit (fulfill reserved + deduct stock).
 *
 * Locked invariant:
 *   store_products.stock === inventory_levels.available + inventory_levels.reserved
 *   sellable === inventory_levels.available
 *
 * Uses PostgreSQL transactions for atomic inventory operations
 */

import { db } from '@/lib/database'
import { logger } from '@/lib/logger'
import { StoreProduct, CartItem } from '@/features/store/types'
import { InventorySyncStrategy, StoreEvent } from '@/constants/store'
import { publishEvent } from '@/lib/events/event-bus.server'
import {
  CART_SOFT_HOLD_MINUTES,
  cartHoldOrderId,
  DEFAULT_INVENTORY_STORE_ID,
  ORDER_RESERVATION_MINUTES,
  shouldSkipPhysicalStock,
  STOCK_THRESHOLDS,
  ZERO_WAREHOUSE_ID,
} from '@/features/store/constants/stock'
import { STORE_COLLECTIONS } from '@/features/store/constants/collections'
import type { StockMovement } from '@/features/store/types/erp-stock'
import {
  chooseFulfillmentWarehouse,
  explainFulfillmentShortfall,
  getFulfillmentWarehouse,
  levelsForProduct,
} from '@/features/store/services/warehouse-fulfillment'
import {
  movementDocId,
  movementValue,
  isKnownUnitCost,
  remainingReturnable,
  returnedAgainstSale,
} from '@/features/store/services/fulfillment-ledger'

/** PostgreSQL tables (snake_case — see data/migrations/008_inventory_schema.sql). */
export const INVENTORY_COLLECTIONS = {
  levels: 'inventory_levels',
  reservations: 'inventory_reservations',
} as const

export function inventoryLevelId(
  productId: string,
  storeId: string = DEFAULT_INVENTORY_STORE_ID,
): string {
  return `${productId}_${storeId}`
}

// Inventory reservation for pending orders
export interface InventoryReservation {
  id: string
  productId: string
  storeId: string
  warehouseId?: string
  orderId: string
  quantity: number
  reservedAt: string
  expiresAt: string
  status: 'active' | 'fulfilled' | 'expired' | 'cancelled'
}

// Inventory level tracking
export interface InventoryLevel {
  productId: string
  storeId: string
  available: number
  reserved: number
  total: number
  lastUpdated: string
  syncVersion: number // For optimistic concurrency control
}

// Inventory transfer between stores
export interface InventoryTransfer {
  id: string
  productId: string
  fromStoreId: string
  toStoreId: string
  quantity: number
  status: 'pending' | 'in_transit' | 'completed' | 'cancelled'
  initiatedAt: string
  completedAt?: string
  notes?: string
}

/**
 * Ensure inventory_levels row exists for product (bootstrap from store_products.stock).
 * Creates { available: stock, reserved: 0, total: stock } when missing.
 */
export async function ensureInventoryLevel(
  productId: string,
  storeId: string = DEFAULT_INVENTORY_STORE_ID,
): Promise<InventoryLevel> {
  const inventoryId = inventoryLevelId(productId, storeId)
  const existing = await db().findDocById<InventoryLevel & Record<string, unknown>>(
    INVENTORY_COLLECTIONS.levels,
    inventoryId,
  )
  if (existing.success && existing.data) {
    return existing.data as InventoryLevel
  }

  const productResult = await db().findDocById<StoreProduct & Record<string, unknown>>(
    'store_products',
    productId,
  )
  const siblingLevels = await levelsForProduct(productId)
  const bootstrapFromProduct = storeId === DEFAULT_INVENTORY_STORE_ID && siblingLevels.length === 0
  const stock = bootstrapFromProduct && productResult.success && productResult.data
    ? Number((productResult.data as StoreProduct).stock ?? 0)
    : 0

  const now = new Date().toISOString()
  const level: InventoryLevel = {
    productId,
    storeId,
    available: Math.max(0, stock),
    reserved: 0,
    total: Math.max(0, stock),
    lastUpdated: now,
    syncVersion: 1,
  }

  await db().createDoc(INVENTORY_COLLECTIONS.levels, level as InventoryLevel & Record<string, unknown>, {
    id: inventoryId,
  })
  return level
}

/**
 * Sync levels after a standalone stock change (restock / adjust / set).
 * Does NOT touch reserved. Rejects set when newStock < reserved.
 */
export async function syncLevelsAfterStockChange(params: {
  productId: string
  newStock: number
  operation: 'add' | 'subtract' | 'set'
  quantityChange: number
  storeId?: string
}): Promise<void> {
  const storeId = params.storeId ?? DEFAULT_INVENTORY_STORE_ID
  const inventoryId = inventoryLevelId(params.productId, storeId)
  const now = new Date().toISOString()

  await db().transaction(async (transaction) => {
    const currentLevelDoc = await transaction.read(INVENTORY_COLLECTIONS.levels, inventoryId)
    const currentLevel = currentLevelDoc?.data as InventoryLevel | undefined
    const reserved = currentLevel?.reserved ?? 0

    if (params.operation === 'set' && params.newStock < reserved) {
      throw new Error(
        `Cannot set stock (${params.newStock}) below reserved (${reserved}) for product ${params.productId}`,
      )
    }

    let available: number
    if (!currentLevel) {
      available = Math.max(0, params.newStock - reserved)
    } else if (params.operation === 'add') {
      available = currentLevel.available + params.quantityChange
    } else if (params.operation === 'subtract') {
      available = Math.max(0, currentLevel.available - params.quantityChange)
    } else {
      available = Math.max(0, params.newStock - reserved)
    }

    const newLevel: InventoryLevel = {
      productId: params.productId,
      storeId,
      available,
      reserved,
      total: available + reserved,
      lastUpdated: now,
      syncVersion: (currentLevel?.syncVersion || 0) + 1,
    }

    if (currentLevel) {
      await transaction.update(INVENTORY_COLLECTIONS.levels, inventoryId, newLevel)
    } else {
      await transaction.create(INVENTORY_COLLECTIONS.levels, newLevel, { id: inventoryId })
    }
  })
}

/**
 * Update inventory levels for a product across listed stores
 */
export async function updateInventoryLevels(
  productId: string,
  storeId: string,
  quantityChange: number,
  operation: 'add' | 'subtract' | 'set'
): Promise<void> {
  await db().transaction(async (transaction) => {
    const inventoryId = inventoryLevelId(productId, storeId)
    const currentLevelDoc = await transaction.read(INVENTORY_COLLECTIONS.levels, inventoryId)
    const currentLevel = currentLevelDoc?.data as InventoryLevel | undefined

    let newAvailable: number

    if (operation === 'set') {
      newAvailable = quantityChange
    } else if (operation === 'add') {
      newAvailable = (currentLevel?.available || 0) + quantityChange
    } else {
      newAvailable = Math.max(0, (currentLevel?.available || 0) - quantityChange)
    }

    const reserved = currentLevel?.reserved || 0
    const newLevel: InventoryLevel = {
      productId,
      storeId,
      available: newAvailable,
      reserved,
      total: newAvailable + reserved,
      lastUpdated: new Date().toISOString(),
      syncVersion: (currentLevel?.syncVersion || 0) + 1
    }

    if (currentLevel) {
      await transaction.update(INVENTORY_COLLECTIONS.levels, inventoryId, newLevel)
    } else {
      await transaction.create(INVENTORY_COLLECTIONS.levels, newLevel, { id: inventoryId })
    }

    const productDoc = await transaction.read('store_products', productId)
    if (productDoc) {
      // Keep product.stock aligned when adjusting available alone (legacy helper).
      const newStock = newAvailable + reserved
      await transaction.update('store_products', productId, {
        stock: newStock,
        inStock: newStock > 0,
      })
    }
  })

  await publishEvent({
    type: StoreEvent.INVENTORY_UPDATED,
    payload: { productId, storeId, quantityChange, operation }
  })
}

/**
 * Reserve inventory for an order
 */
export async function reserveInventory(
  productId: string,
  storeId: string,
  orderId: string,
  quantity: number,
  reservationMinutes: number = 15,
  warehouseId: string = ZERO_WAREHOUSE_ID,
): Promise<InventoryReservation> {
  const reservationId = `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const now = new Date()
  const expiresAt = new Date(now.getTime() + reservationMinutes * 60000)

  const reservation: InventoryReservation = {
    id: reservationId,
    productId,
    storeId,
    warehouseId,
    orderId,
    quantity,
    reservedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: 'active'
  }

  await db().transaction(async (transaction) => {
    const inventoryId = inventoryLevelId(productId, storeId)
    const currentLevelDoc = await transaction.read(INVENTORY_COLLECTIONS.levels, inventoryId)
    const currentLevel = currentLevelDoc?.data as InventoryLevel | undefined

    if (!currentLevel || currentLevel.available < quantity) {
      throw new Error(`One warehouse must cover ${quantity}. Not enough remaining stock for product ${productId}.`)
    }

    const available = currentLevel.available - quantity
    const reserved = currentLevel.reserved + quantity
    const updatedLevel: Partial<InventoryLevel> = {
      available,
      reserved,
      total: available + reserved,
      lastUpdated: now.toISOString(),
      syncVersion: currentLevel.syncVersion + 1
    }

    await transaction.update(INVENTORY_COLLECTIONS.levels, inventoryId, updatedLevel)
    await transaction.create(INVENTORY_COLLECTIONS.reservations, reservation, { id: reservationId })
  })

  return reservation
}

/**
 * Reserve stock for each order item. Bootstraps inventory_levels from product.stock when missing.
 * Never skips physical stock items — sellable gate is levels.available after bootstrap.
 * Digital / preorder / instantDelivery lines are omitted (Wave 1).
 */
export async function reserveInventoryForOrder(
  orderId: string,
  items: Array<{
    productId: string
    quantity: number
    storeId?: string
    warehouseId?: string
    fulfillmentWarehouseId?: string
    isPreorder?: boolean
    digitalProduct?: boolean
    instantDelivery?: boolean
  }>,
  reservationMinutes: number = ORDER_RESERVATION_MINUTES
): Promise<{ reserved: InventoryReservation[]; skipped: string[] }> {
  const reserved: InventoryReservation[] = []
  const skipped: string[] = []
  const planned: Array<{ productId: string; quantity: number; storeId: string; warehouseId: string }> = []

  for (const item of items) {
    if (!item.productId) continue
    if (
      shouldSkipPhysicalStock({
        isPreorder: item.isPreorder,
        product: {
          digitalProduct: item.digitalProduct,
          instantDelivery: item.instantDelivery,
        },
      })
    ) {
      skipped.push(item.productId)
      continue
    }
    let storeId = item.storeId
    let warehouseId = item.warehouseId || item.fulfillmentWarehouseId
    if (!storeId) {
      const existing = await levelsForProduct(item.productId)
      if (existing.length === 0) await ensureInventoryLevel(item.productId)
      const choice = await chooseFulfillmentWarehouse({
        productId: item.productId,
        quantity: item.quantity,
        explicitWarehouseId: warehouseId,
      })
      if (!choice) {
        const shortfall = await explainFulfillmentShortfall({
          productId: item.productId,
          quantity: item.quantity,
        })
        throw new Error(shortfall.message)
      }
      storeId = choice.storeId
      warehouseId = choice.warehouseId
    }
    planned.push({
      productId: item.productId,
      quantity: item.quantity,
      storeId,
      warehouseId: warehouseId || ZERO_WAREHOUSE_ID,
    })
  }

  for (const item of planned) {
    await ensureInventoryLevel(item.productId, item.storeId)
    const reservation = await reserveInventory(
      item.productId,
      item.storeId,
      orderId,
      item.quantity,
      reservationMinutes,
      item.warehouseId,
    )
    reserved.push(reservation)
  }

  return { reserved, skipped }
}

/**
 * Release inventory reservation.
 * - Cancel (fulfilled=false): restore available, decrease reserved
 * - Fulfill (fulfilled=true): decrease reserved only; available unchanged (Flaw E fix)
 */
export async function releaseReservation(
  reservationId: string,
  fulfilled: boolean = false
): Promise<void> {
  const reservationResult = await db().findDocById<InventoryReservation & Record<string, unknown>>(
    INVENTORY_COLLECTIONS.reservations,
    reservationId
  )
  if (!reservationResult.success || !reservationResult.data) {
    return
  }

  const reservation = reservationResult.data as InventoryReservation

  if (reservation.status !== 'active') {
    return
  }

  await db().transaction(async (transaction) => {
    await transaction.update(
      INVENTORY_COLLECTIONS.reservations,
      reservationId,
      {
        status: fulfilled ? 'fulfilled' : 'cancelled',
        updatedAt: new Date().toISOString()
      }
    )

    const inventoryId = inventoryLevelId(reservation.productId, reservation.storeId)
    const currentLevelDoc = await transaction.read(INVENTORY_COLLECTIONS.levels, inventoryId)
    const currentLevel = currentLevelDoc?.data as InventoryLevel | undefined

    if (!currentLevel) return

    if (fulfilled) {
      // Flaw E fix: clear reserved without restoring available
      const reserved = Math.max(0, currentLevel.reserved - reservation.quantity)
      await transaction.update(INVENTORY_COLLECTIONS.levels, inventoryId, {
        reserved,
        total: currentLevel.available + reserved,
        lastUpdated: new Date().toISOString(),
        syncVersion: currentLevel.syncVersion + 1,
      })
    } else {
      const available = currentLevel.available + reservation.quantity
      const reserved = Math.max(0, currentLevel.reserved - reservation.quantity)
      await transaction.update(INVENTORY_COLLECTIONS.levels, inventoryId, {
        available,
        reserved,
        total: available + reserved,
        lastUpdated: new Date().toISOString(),
        syncVersion: currentLevel.syncVersion + 1,
      })
    }
  })
}

export async function listActiveReservationsForOrder(
  orderId: string,
): Promise<InventoryReservation[]> {
  const result = await db().queryDocs<InventoryReservation & Record<string, unknown>>({
    collection: INVENTORY_COLLECTIONS.reservations,
    filters: [
      { field: 'orderId', operator: '=', value: orderId },
      { field: 'status', operator: '=', value: 'active' },
    ],
    pagination: { limit: 200 },
  })
  if (!result.success || !result.data) return []
  return result.data as InventoryReservation[]
}

/** Cancel path: restore available for all active holds on order. */
export async function releaseReservationsForOrder(orderId: string): Promise<number> {
  const active = await listActiveReservationsForOrder(orderId)
  for (const reservation of active) {
    await releaseReservation(reservation.id, false)
  }
  return active.length
}

/** Release part of one active hold. The rest of the hold stays active. */
export async function releaseReservationQuantity(reservationId: string, quantity: number): Promise<void> {
  const qty = Math.floor(quantity)
  if (qty < 1) throw new Error('Quantity is required')
  await db().transaction(async (transaction) => {
    const reservationDoc = await transaction.read(INVENTORY_COLLECTIONS.reservations, reservationId)
    const reservation = reservationDoc?.data as InventoryReservation | undefined
    if (!reservation || reservation.status !== 'active') return
    const release = Math.min(qty, reservation.quantity)
    const now = new Date().toISOString()
    if (release >= reservation.quantity) {
      await transaction.update(INVENTORY_COLLECTIONS.reservations, reservationId, {
        status: 'cancelled',
        updatedAt: now,
      })
    } else {
      await transaction.update(INVENTORY_COLLECTIONS.reservations, reservationId, {
        quantity: reservation.quantity - release,
        updatedAt: now,
      })
    }
    const inventoryId = inventoryLevelId(reservation.productId, reservation.storeId)
    const levelDoc = await transaction.read(INVENTORY_COLLECTIONS.levels, inventoryId)
    const level = levelDoc?.data as InventoryLevel | undefined
    if (!level) return
    const available = level.available + release
    const reserved = Math.max(0, level.reserved - release)
    await transaction.update(INVENTORY_COLLECTIONS.levels, inventoryId, {
      available,
      reserved,
      total: available + reserved,
      lastUpdated: now,
      syncVersion: level.syncVersion + 1,
    })
  })
}

/** Fulfill path: clear reserved without restoring available (Flaw E). Prefer commitSaleForOrder txn. */
export async function fulfillReservationsForOrder(orderId: string): Promise<number> {
  const active = await listActiveReservationsForOrder(orderId)
  for (const reservation of active) {
    await releaseReservation(reservation.id, true)
  }
  return active.length
}

async function hasSaleMovementsForOrder(orderId: string): Promise<boolean> {
  const result = await db().queryDocs<StockMovement & Record<string, unknown>>({
    collection: STORE_COLLECTIONS.stockMovements,
    filters: [
      { field: 'orderId', operator: '=', value: orderId },
      { field: 'movementType', operator: '=', value: 'sale' },
    ],
    pagination: { limit: 1 },
  })
  return Boolean(result.success && result.data && result.data.length > 0)
}

async function hasRefundMovementsForOrder(orderId: string): Promise<boolean> {
  const result = await db().queryDocs<StockMovement & Record<string, unknown>>({
    collection: STORE_COLLECTIONS.stockMovements,
    filters: [
      { field: 'orderId', operator: '=', value: orderId },
      { field: 'movementType', operator: '=', value: 'return' },
    ],
    pagination: { limit: 1 },
  })
  return Boolean(result.success && result.data && result.data.length > 0)
}

export type CommitSaleResult = {
  success: boolean
  skipped: boolean
  deductedProducts: string[]
  failedProducts: string[]
  fulfilledReservations: number
}

/**
 * Atomic paid-sale: fulfill reservations (reserved−=q) + deduct stock in one transaction.
 * Idempotent when sale movements already exist for orderId.
 */
export async function commitSaleForOrder(
  orderId: string,
  items: CartItem[],
  userId?: string,
  referralMeta?: { referralCode?: string; assisted?: boolean },
): Promise<CommitSaleResult> {
  if (await hasSaleMovementsForOrder(orderId)) {
    logger.info('[InventorySync] commitSaleForOrder idempotent skip', { orderId })
    return {
      success: true,
      skipped: true,
      deductedProducts: [],
      failedProducts: [],
      fulfilledReservations: 0,
    }
  }

  const activeReservations = await listActiveReservationsForOrder(orderId)
  const deductedProducts: string[] = []
  const failedProducts: string[] = []
  const lowStockAlerts: Array<{ productId: string; stock: number }> = []
  const now = new Date().toISOString()

  try {
    await db().transaction(async (transaction) => {
      // 1. Fulfill active reservations (reserved−=q, available unchanged)
      for (const reservation of activeReservations) {
        if (reservation.status !== 'active') continue
        await transaction.update(INVENTORY_COLLECTIONS.reservations, reservation.id, {
          status: 'fulfilled',
          updatedAt: now,
        })
        const inventoryId = inventoryLevelId(reservation.productId, reservation.storeId)
        const levelDoc = await transaction.read(INVENTORY_COLLECTIONS.levels, inventoryId)
        const level = levelDoc?.data as InventoryLevel | undefined
        if (level) {
          const reserved = Math.max(0, level.reserved - reservation.quantity)
          await transaction.update(INVENTORY_COLLECTIONS.levels, inventoryId, {
            reserved,
            total: level.available + reserved,
            lastUpdated: now,
            syncVersion: level.syncVersion + 1,
          })
        }
      }

      // 2. Deduct the fulfilling warehouse. A reservation already moved available → reserved.
      const holdsByProduct = new Map<string, InventoryReservation[]>()
      for (const reservation of activeReservations) {
        const queue = holdsByProduct.get(reservation.productId) || []
        queue.push(reservation)
        holdsByProduct.set(reservation.productId, queue)
      }
      const lineWarehouses: Array<{ productId: string; warehouseId: string }> = []

      for (const item of items) {
        if (shouldSkipPhysicalStock(item)) continue
        const productId = item.product?.id
        if (!productId) {
          failedProducts.push('unknown')
          continue
        }

        const productDoc = await transaction.read('store_products', productId)
        if (!productDoc?.data) {
          failedProducts.push(productId)
          continue
        }

        const productData = productDoc.data as StoreProduct & Record<string, unknown>
        if (
          shouldSkipPhysicalStock({
            isPreorder: item.isPreorder,
            product: {
              digitalProduct: Boolean(productData.digitalProduct ?? item.product?.digitalProduct),
              instantDelivery: Boolean(
                productData.instantDelivery ?? item.product?.instantDelivery,
              ),
            },
          })
        ) {
          continue
        }

        const qty = item.quantity || 1
        const hold = holdsByProduct.get(productId)?.shift()
        const explicit = (item as { fulfillmentWarehouseId?: string }).fulfillmentWarehouseId
        const choice = hold
          ? {
              warehouseId: hold.warehouseId || ZERO_WAREHOUSE_ID,
              storeId: hold.storeId || DEFAULT_INVENTORY_STORE_ID,
            }
          : await chooseFulfillmentWarehouse({
              productId,
              quantity: qty,
              explicitWarehouseId: explicit,
            })
        if (!choice) {
          failedProducts.push(productId)
          throw new Error(`One warehouse must cover ${qty}. Not enough remaining stock for product ${productId}.`)
        }

        const inventoryId = inventoryLevelId(productId, choice.storeId)
        const levelDoc = await transaction.read(INVENTORY_COLLECTIONS.levels, inventoryId)
        const level = levelDoc?.data as InventoryLevel | undefined
        const beforeAvailable = Number(level?.available ?? 0)
        const beforeReserved = Number(level?.reserved ?? 0)
        let available = beforeAvailable
        const reserved = beforeReserved
        if (!hold) {
          if (beforeAvailable < qty) {
            failedProducts.push(productId)
            throw new Error(`One warehouse must cover ${qty}. Not enough remaining stock for product ${productId}.`)
          }
          available = beforeAvailable - qty
          const next: InventoryLevel = {
            productId,
            storeId: choice.storeId,
            available,
            reserved,
            total: available + reserved,
            lastUpdated: now,
            syncVersion: (level?.syncVersion || 0) + 1,
          }
          if (level) {
            await transaction.update(INVENTORY_COLLECTIONS.levels, inventoryId, next)
          } else {
            await transaction.create(INVENTORY_COLLECTIONS.levels, next, { id: inventoryId })
          }
        }

        const currentStock = Number(productData.stock ?? beforeAvailable + beforeReserved)
        const newStock = Math.max(0, currentStock - qty)
        await transaction.update('store_products', productId, {
          stock: newStock,
          inStock: newStock > 0,
          updatedAt: now,
        })

        const movement: StockMovement = {
          id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          productId,
          warehouseId: choice.warehouseId,
          movementType: 'sale',
          quantityBefore: beforeAvailable + beforeReserved,
          quantityChange: -qty,
          quantityAfter: (hold ? beforeAvailable : available) + reserved,
          orderId,
          userId,
          reason: `Order #${orderId} - ${item.product?.name ?? productId} x${qty}`,
          timestamp: now,
          referralCode: referralMeta?.referralCode,
          assisted: referralMeta?.assisted,
        }
        await transaction.create(STORE_COLLECTIONS.stockMovements, movement, { id: movement.id })
        lineWarehouses.push({ productId, warehouseId: choice.warehouseId })
        deductedProducts.push(productId)
        if (newStock <= STOCK_THRESHOLDS.LOW_STOCK) {
          lowStockAlerts.push({ productId, stock: newStock })
        }
      }

      if (lineWarehouses.length > 0) {
        const orderDoc = await transaction.read('orders', orderId)
        const orderItems = Array.isArray((orderDoc?.data as { items?: unknown[] } | undefined)?.items)
          ? ([...(orderDoc?.data as { items: Array<Record<string, unknown>> }).items])
          : []
        if (orderItems.length > 0) {
          const pending = [...lineWarehouses]
          const nextItems = orderItems.map((entry) => {
            const productId = String(entry.productId || (entry.product as { id?: string } | undefined)?.id || '')
            const matchIndex = pending.findIndex((row) => row.productId === productId)
            if (matchIndex < 0) return entry
            const match = pending.splice(matchIndex, 1)[0]
            return { ...entry, fulfillmentWarehouseId: match.warehouseId }
          })
          await transaction.update('orders', orderId, { items: nextItems })
        }
      }
    })
  } catch (error) {
    logger.error('[InventorySync] commitSaleForOrder failed', { orderId, error })
    return {
      success: false,
      skipped: false,
      deductedProducts,
      failedProducts: failedProducts.length ? failedProducts : ['transaction'],
      fulfilledReservations: 0,
    }
  }

  for (const alert of lowStockAlerts) {
    try {
      const isCritical = alert.stock <= STOCK_THRESHOLDS.CRITICAL_STOCK
      const alertLevel = alert.stock === 0 ? 'OUT_OF_STOCK' : isCritical ? 'CRITICAL' : 'LOW'
      await publishEvent({
        type: 'erp.stock.alert' as never,
        payload: {
          productId: alert.productId,
          currentStock: alert.stock,
          alertLevel,
          timestamp: new Date().toISOString(),
          suggestedAction:
            alert.stock === 0
              ? 'IMMEDIATE_REORDER'
              : isCritical
                ? 'URGENT_REORDER'
                : 'SCHEDULE_REORDER',
        },
      })
    } catch {
      // non-fatal
    }
  }

  await publishEvent({
    type: StoreEvent.INVENTORY_UPDATED,
    payload: { orderId, deductedProducts, operation: 'commit_sale' },
  })

  logger.info('[InventorySync] commitSaleForOrder completed', {
    orderId,
    deductedCount: deductedProducts.length,
    fulfilledReservations: activeReservations.length,
  })

  return {
    success: failedProducts.length === 0,
    skipped: false,
    deductedProducts,
    failedProducts,
    fulfilledReservations: activeReservations.length,
  }
}

/**
 * Restore stock after paid Refunded/Voided. Idempotent via return movements.
 * Also releases any lingering active reservations (cancel restore).
 */
export async function restoreStockForOrder(orderId: string): Promise<{
  success: boolean
  skipped: boolean
  restoredProducts: string[]
}> {
  if (await hasRefundMovementsForOrder(orderId)) {
    logger.info('[InventorySync] restoreStockForOrder idempotent skip', { orderId })
    return { success: true, skipped: true, restoredProducts: [] }
  }

  // Unpaid leftover holds → cancel-release
  await releaseReservationsForOrder(orderId)

  const salesResult = await db().queryDocs<StockMovement & Record<string, unknown>>({
    collection: STORE_COLLECTIONS.stockMovements,
    filters: [
      { field: 'orderId', operator: '=', value: orderId },
      { field: 'movementType', operator: '=', value: 'sale' },
    ],
    pagination: { limit: 200 },
  })

  const sales = (salesResult.success && salesResult.data
    ? salesResult.data
    : []) as StockMovement[]

  if (sales.length === 0) {
    return { success: true, skipped: false, restoredProducts: [] }
  }

  const restoredProducts: string[] = []
  const now = new Date().toISOString()

  await db().transaction(async (transaction) => {
    for (const sale of sales) {
      const qty = Math.abs(sale.quantityChange)
      if (qty <= 0) continue

      const productDoc = await transaction.read('store_products', sale.productId)
      if (!productDoc?.data) continue

      const productData = productDoc.data as StoreProduct & Record<string, unknown>
      const currentStock = Number(productData.stock ?? 0)
      const newStock = currentStock + qty
      const warehouse =
        (await getFulfillmentWarehouse(sale.warehouseId || ZERO_WAREHOUSE_ID)) || {
          id: ZERO_WAREHOUSE_ID,
          name: 'Main warehouse',
          code: 'main',
          address: '',
          active: true,
          isDefault: true,
          inventoryStoreId: DEFAULT_INVENTORY_STORE_ID,
        }

      await transaction.update('store_products', sale.productId, {
        stock: newStock,
        inStock: true,
        updatedAt: now,
      })

      const inventoryId = inventoryLevelId(sale.productId, warehouse.inventoryStoreId)
      const levelDoc = await transaction.read(INVENTORY_COLLECTIONS.levels, inventoryId)
      const level = levelDoc?.data as InventoryLevel | undefined
      const reserved = level?.reserved ?? 0
      const available = Number(level?.available ?? 0) + qty

      const aligned: InventoryLevel = {
        productId: sale.productId,
        storeId: warehouse.inventoryStoreId,
        available,
        reserved,
        total: available + reserved,
        lastUpdated: now,
        syncVersion: (level?.syncVersion || 0) + 1,
      }

      if (level) {
        await transaction.update(INVENTORY_COLLECTIONS.levels, inventoryId, aligned)
      } else {
        await transaction.create(INVENTORY_COLLECTIONS.levels, aligned, { id: inventoryId })
      }

      const movement: StockMovement = {
        id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        productId: sale.productId,
        warehouseId: warehouse.id,
        movementType: 'return',
        quantityBefore: currentStock,
        quantityChange: qty,
        quantityAfter: newStock,
        orderId,
        reason: `Refund/void restore for order #${orderId}`,
        timestamp: now,
      }
      await transaction.create(STORE_COLLECTIONS.stockMovements, movement, { id: movement.id })
      restoredProducts.push(sale.productId)
    }
  })

  logger.info('[InventorySync] restoreStockForOrder completed', {
    orderId,
    restoredCount: restoredProducts.length,
  })

  return { success: true, skipped: false, restoredProducts }
}

/**
 * Return part of one sale. Resellable units go back to that warehouse.
 * Damaged units stay out of available and are valued at the current average.
 * The same idempotency key posts once.
 */
export async function restoreSaleQuantity(input: {
  saleMovementId: string
  quantity: number
  userId?: string
  idempotencyKey?: string
  mode: 'resellable' | 'damaged'
}): Promise<void> {
  const requested = Math.floor(input.quantity)
  if (requested < 1) throw new Error('Quantity is required')
  const saleResult = await db().findDocById<StockMovement>('stock_movements', input.saleMovementId)
  if (!saleResult.success || !saleResult.data || saleResult.data.movementType !== 'sale') {
    throw new Error('Sale movement not found')
  }
  const sale = saleResult.data
  const related = await db().queryDocs<StockMovement & { id: string }>({
    collection: STORE_COLLECTIONS.stockMovements,
    filters: [{ field: 'reversesMovementId', operator: '=', value: input.saleMovementId }],
    pagination: { limit: 50 },
  })
  const already = returnedAgainstSale(related.success && related.data ? related.data : [])
  const remaining = remainingReturnable(Number(sale.quantityChange || 0), already)
  if (remaining < 1 || requested > remaining) {
    throw new Error(
      remaining < 1
        ? 'Nothing left to return for this line'
        : `Only ${remaining} left to return for this line`,
    )
  }

  const warehouse =
    (await getFulfillmentWarehouse(sale.warehouseId || ZERO_WAREHOUSE_ID)) || {
      id: ZERO_WAREHOUSE_ID,
      inventoryStoreId: DEFAULT_INVENTORY_STORE_ID,
    }
  const now = new Date().toISOString()
  const movementId = movementDocId(input.idempotencyKey)
  const inventoryId = inventoryLevelId(sale.productId, warehouse.inventoryStoreId)

  await db().transaction(async (transaction) => {
    await transaction.read('store_products', sale.productId)
    const existing = await transaction.read(STORE_COLLECTIONS.stockMovements, movementId)
    if (existing?.data) return
    const relatedNow = await db().queryDocs<StockMovement & { id: string }>({
      collection: STORE_COLLECTIONS.stockMovements,
      filters: [{ field: 'reversesMovementId', operator: '=', value: input.saleMovementId }],
      pagination: { limit: 50 },
    })
    if (!relatedNow.success) throw new Error('Could not read prior returns for this line')
    const alreadyNow = returnedAgainstSale(relatedNow.data || [])
    const remainingNow = remainingReturnable(Number(sale.quantityChange || 0), alreadyNow)
    if (remainingNow < 1 || requested > remainingNow) {
      throw new Error(
        remainingNow < 1
          ? 'Nothing left to return for this line'
          : `Only ${remainingNow} left to return for this line`,
      )
    }
    const qty = requested
    const levelDoc = await transaction.read(INVENTORY_COLLECTIONS.levels, inventoryId)
    const level = levelDoc?.data as InventoryLevel | undefined
    const available = Number(level?.available ?? 0)
    const reserved = Number(level?.reserved ?? 0)
    const average = Number((level as { unitCost?: number } | undefined)?.unitCost || 0)
    const nextAvailable = input.mode === 'resellable' ? available + qty : available
    const aligned = {
      productId: sale.productId,
      storeId: warehouse.inventoryStoreId,
      available: nextAvailable,
      reserved,
      total: nextAvailable + reserved,
      lastUpdated: now,
      syncVersion: (level?.syncVersion || 0) + 1,
      unitCost: isKnownUnitCost(average) ? average : 0,
    }
    if (level) {
      await transaction.update(INVENTORY_COLLECTIONS.levels, inventoryId, aligned)
    } else if (input.mode === 'resellable') {
      await transaction.create(INVENTORY_COLLECTIONS.levels, aligned, { id: inventoryId })
    }
    if (input.mode === 'resellable') {
      const productDoc = await transaction.read('store_products', sale.productId)
      const currentStock = Number((productDoc?.data as { stock?: number } | undefined)?.stock || 0)
      const stock = currentStock + qty
      await transaction.update('store_products', sale.productId, {
        stock,
        inStock: stock > 0,
        updatedAt: now,
      })
    }
    const movement: StockMovement = {
      id: movementId,
      productId: sale.productId,
      warehouseId: warehouse.id,
      movementType: input.mode === 'resellable' ? 'return' : 'damaged',
      quantityBefore: available + reserved,
      quantityChange: input.mode === 'resellable' ? qty : 0,
      quantityAfter: nextAvailable + reserved,
      orderId: sale.orderId,
      userId: input.userId,
      reason:
        input.mode === 'resellable'
          ? `Returned parcel restock for sale ${input.saleMovementId}`
          : `Returned parcel damaged for sale ${input.saleMovementId}`,
      timestamp: now,
      unitCost: isKnownUnitCost(average) ? average : 0,
      value: movementValue(qty, average),
      reversesMovementId: input.saleMovementId,
      unsellableQuantity: input.mode === 'damaged' ? qty : undefined,
    }
    await transaction.create(STORE_COLLECTIONS.stockMovements, movement, { id: movement.id })
  })
}

/**
 * Sync inventory across multiple stores
 */
export async function syncInventoryAcrossStores(
  productId: string,
  strategy: InventorySyncStrategy = InventorySyncStrategy.MASTER
): Promise<void> {
  const productResult = await db().findDocById<StoreProduct & Record<string, unknown>>(
    'store_products',
    productId
  )
  if (!productResult.success || !productResult.data) {
    return
  }

  const product = productResult.data as StoreProduct
  if (!product.productListedAt) {
    return
  }

  const storeIds = product.productListedAt

  switch (strategy) {
    case InventorySyncStrategy.MASTER:
      await syncFromMasterStore(productId, product.storeId || storeIds[0], storeIds)
      break

    case InventorySyncStrategy.DISTRIBUTED:
      await distributeInventoryEvenly(productId, storeIds)
      break

    case InventorySyncStrategy.RESERVED:
      await maintainReservedLevels(productId, storeIds)
      break

    default:
      throw new Error(`Unknown sync strategy: ${strategy}`)
  }
}

async function syncFromMasterStore(
  productId: string,
  masterStoreId: string,
  storeIds: string[]
): Promise<void> {
  const masterResult = await db().findDocById<InventoryLevel & Record<string, unknown>>(
    INVENTORY_COLLECTIONS.levels,
    inventoryLevelId(productId, masterStoreId)
  )
  if (!masterResult.success || !masterResult.data) {
    return
  }
  const masterInventory = masterResult.data as InventoryLevel

  const updates = storeIds
    .filter(id => id !== masterStoreId)
    .map(storeId =>
      updateInventoryLevels(productId, storeId, masterInventory.available, 'set')
    )

  await Promise.all(updates)
}

async function distributeInventoryEvenly(
  productId: string,
  storeIds: string[]
): Promise<void> {
  const inventoryLevels = await Promise.all(
    storeIds.map(async storeId => {
      const result = await db().findDocById<InventoryLevel & Record<string, unknown>>(
        INVENTORY_COLLECTIONS.levels,
        inventoryLevelId(productId, storeId)
      )
      return result.success && result.data
        ? (result.data as InventoryLevel)
        : null
    })
  )

  const totalInventory = inventoryLevels.reduce(
    (sum, level) => sum + (level?.available || 0),
    0
  )

  const perStoreInventory = Math.floor(totalInventory / storeIds.length)
  const remainder = totalInventory % storeIds.length

  const updates = storeIds.map((storeId, index) => {
    const quantity = perStoreInventory + (index < remainder ? 1 : 0)
    return updateInventoryLevels(productId, storeId, quantity, 'set')
  })

  await Promise.all(updates)
}

async function maintainReservedLevels(
  productId: string,
  storeIds: string[]
): Promise<void> {
  const MIN_RESERVED = 5

  for (const storeId of storeIds) {
    const inventoryResult = await db().findDocById<InventoryLevel & Record<string, unknown>>(
      INVENTORY_COLLECTIONS.levels,
      inventoryLevelId(productId, storeId)
    )
    const inventory = inventoryResult.success && inventoryResult.data
      ? (inventoryResult.data as InventoryLevel)
      : null

    if (!inventory || inventory.available < MIN_RESERVED) {
      await requestInventoryTransfer(productId, storeId, MIN_RESERVED - (inventory?.available || 0))
    }
  }
}

async function requestInventoryTransfer(
  productId: string,
  toStoreId: string,
  quantity: number
): Promise<void> {
  const result = await db().queryDocs<InventoryLevel & Record<string, unknown>>({
    collection: INVENTORY_COLLECTIONS.levels,
    filters: [
      { field: 'productId', operator: '=', value: productId },
      { field: 'available', operator: '>', value: quantity }
    ],
    orderBy: [{ field: 'available', direction: 'desc' }],
    pagination: { limit: 1 }
  })

  if (!result.success || !result.data || result.data.length === 0) {
    return
  }

  const sourceStore = result.data[0] as InventoryLevel

  const transfer: InventoryTransfer = {
    id: `transfer_${Date.now()}`,
    productId,
    fromStoreId: sourceStore.storeId,
    toStoreId,
    quantity,
    status: 'pending',
    initiatedAt: new Date().toISOString()
  }

  await db().createDoc('inventoryTransfers', transfer as InventoryTransfer & Record<string, unknown>, {
    id: transfer.id
  })

  await processInventoryTransfer(transfer.id)
}

export async function processInventoryTransfer(
  transferId: string
): Promise<void> {
  const transferResult = await db().findDocById<InventoryTransfer & Record<string, unknown>>(
    'inventoryTransfers',
    transferId
  )
  if (!transferResult.success || !transferResult.data) {
    return
  }

  const transfer = transferResult.data as InventoryTransfer

  if (transfer.status !== 'pending') {
    return
  }

  await db().transaction(async (transaction) => {
    const sourceId = inventoryLevelId(transfer.productId, transfer.fromStoreId)
    const sourceLevelDoc = await transaction.read(INVENTORY_COLLECTIONS.levels, sourceId)
    const sourceLevel = sourceLevelDoc?.data as InventoryLevel | undefined

    if (sourceLevel) {
      await transaction.update(INVENTORY_COLLECTIONS.levels, sourceId, {
        available: Math.max(0, sourceLevel.available - transfer.quantity),
        syncVersion: sourceLevel.syncVersion + 1,
        lastUpdated: new Date().toISOString()
      })
    }

    const destId = inventoryLevelId(transfer.productId, transfer.toStoreId)
    const destLevelDoc = await transaction.read(INVENTORY_COLLECTIONS.levels, destId)
    const destLevel = destLevelDoc?.data as InventoryLevel | undefined

    if (destLevel) {
      await transaction.update(INVENTORY_COLLECTIONS.levels, destId, {
        available: destLevel.available + transfer.quantity,
        syncVersion: destLevel.syncVersion + 1,
        lastUpdated: new Date().toISOString()
      })
    }

    await transaction.update('inventoryTransfers', transferId, {
      status: 'completed',
      completedAt: new Date().toISOString()
    })
  })
}

/**
 * Clean up expired reservations (cancel path — restore available)
 */
export type ReservationCleanupResult = {
  seen: number
  released: number
  failed: number
  failedIds: string[]
  capped: boolean
}

/**
 * Release expired holds one at a time. A failure is counted and the next hold
 * is still attempted. The page is always the still-active set, so a released
 * row drops out instead of being skipped by an offset.
 */
export async function cleanupExpiredReservations(): Promise<ReservationCleanupResult> {
  const now = new Date().toISOString()
  const pageSize = 200
  const max = 1000
  const attempted = new Set<string>()
  let seen = 0
  let released = 0
  let failed = 0
  const failedIds: string[] = []
  let capped = false

  while (seen < max) {
    const result = await db().queryDocs<InventoryReservation & Record<string, unknown>>({
      collection: INVENTORY_COLLECTIONS.reservations,
      filters: [
        { field: 'status', operator: '=', value: 'active' },
        { field: 'expiresAt', operator: '<', value: now },
      ],
      pagination: { limit: pageSize },
    })
    if (!result.success || !result.data || result.data.length === 0) break
    const fresh = (result.data as InventoryReservation[]).filter((row) => row.id && !attempted.has(row.id))
    if (fresh.length === 0) {
      capped = result.data.length >= pageSize
      break
    }
    for (const reservation of fresh) {
      if (seen >= max) {
        capped = true
        break
      }
      attempted.add(reservation.id)
      seen += 1
      try {
        await releaseReservation(reservation.id, false)
        released += 1
      } catch {
        failed += 1
        if (failedIds.length < 20) failedIds.push(reservation.id)
      }
    }
  }

  if (seen >= max && !capped) {
    const more = await db().queryDocs<InventoryReservation & Record<string, unknown>>({
      collection: INVENTORY_COLLECTIONS.reservations,
      filters: [
        { field: 'status', operator: '=', value: 'active' },
        { field: 'expiresAt', operator: '<', value: now },
      ],
      pagination: { limit: pageSize },
    })
    const leftover = (more.success && more.data ? more.data : []).some((row) => row.id && !attempted.has(row.id))
    if (leftover) capped = true
  }

  return { seen, released, failed, failedIds, capped }
}

export async function returnableForLines(
  orderId: string,
  lines: Array<{ productId?: string; fulfillmentWarehouseId?: string }>,
): Promise<Map<string, number>> {
  const remaining = new Map<string, number>()
  const result = await db().queryDocs<StockMovement & { id: string }>({
    collection: STORE_COLLECTIONS.stockMovements,
    filters: [{ field: 'orderId', operator: '=', value: orderId }],
    pagination: { limit: 200 },
  })
  const rows = result.success && result.data ? result.data : []
  if (rows.length >= 200) return remaining
  for (const line of lines) {
    const productId = line.productId || ''
    if (!productId) continue
    const sales = rows.filter((row) => row.movementType === 'sale' && row.productId === productId)
    const sale = line.fulfillmentWarehouseId
      ? sales.find((row) => (row.warehouseId || ZERO_WAREHOUSE_ID) === line.fulfillmentWarehouseId)
      : sales[0]
    if (!sale) continue
    const returned = returnedAgainstSale(
      rows.filter((row) => row.reversesMovementId === sale.id),
    )
    remaining.set(
      `${productId}:${line.fulfillmentWarehouseId || ''}`,
      remainingReturnable(Number(sale.quantityChange || 0), returned),
    )
  }
  return remaining
}

/**
 * Wave 1: sync authenticated cart soft-holds.
 * Releases prior cart_${userId} holds, then reserves current physical lines (5-min TTL).
 */
export async function syncCartSoftHolds(
  userId: string,
  items: Array<{
    productId: string
    quantity: number
    isPreorder?: boolean
    digitalProduct?: boolean
    instantDelivery?: boolean
  }>,
): Promise<{ reserved: InventoryReservation[]; skipped: string[]; released: number }> {
  const holdId = cartHoldOrderId(userId)
  const released = await releaseReservationsForOrder(holdId)

  const physical = items.filter(
    (item) =>
      item.productId &&
      item.quantity > 0 &&
      !shouldSkipPhysicalStock({
        isPreorder: item.isPreorder,
        product: {
          digitalProduct: item.digitalProduct,
          instantDelivery: item.instantDelivery,
        },
      }),
  )

  if (physical.length === 0) {
    return { reserved: [], skipped: items.map((i) => i.productId).filter(Boolean), released }
  }

  const { reserved, skipped } = await reserveInventoryForOrder(
    holdId,
    physical,
    CART_SOFT_HOLD_MINUTES,
  )
  return { reserved, skipped, released }
}

export type InventoryDriftSample = {
  productId: string
  stock: number
  available: number
  reserved: number
  expectedStock: number
  delta: number
  storeId?: string
  reservationQuantity?: number
  reservationDelta?: number
}

/**
 * Wave 1: assert stock === available + reserved across leveled products.
 * Repairs nothing — reports drift for ops / cron alerts.
 */
export async function detectInventoryDrift(limit: number = 500): Promise<{
  checked: number
  drifted: number
  samples: InventoryDriftSample[]
}> {
  const levelsResult = await db().queryDocs<InventoryLevel & Record<string, unknown>>({
    collection: INVENTORY_COLLECTIONS.levels,
    pagination: { limit },
  })

  const levels = (levelsResult.success && levelsResult.data
    ? levelsResult.data
    : []) as InventoryLevel[]

  const samples: InventoryDriftSample[] = []
  const byProduct = new Map<string, { available: number; reserved: number }>()
  for (const level of levels) {
    const current = byProduct.get(level.productId) || { available: 0, reserved: 0 }
    current.available += Number(level.available ?? 0)
    current.reserved += Number(level.reserved ?? 0)
    byProduct.set(level.productId, current)
  }

  let checked = 0
  for (const [productId, totals] of byProduct) {
    checked += 1
    const productResult = await db().findDocById<StoreProduct & Record<string, unknown>>(
      'store_products',
      productId,
    )
    const stock = Number(
      productResult.success && productResult.data
        ? (productResult.data as StoreProduct).stock ?? 0
        : 0,
    )
    const expectedStock = totals.available + totals.reserved
    if (stock !== expectedStock) {
      samples.push({
        productId,
        stock,
        available: totals.available,
        reserved: totals.reserved,
        expectedStock,
        delta: stock - expectedStock,
      })
    }
  }

  const reservationLimit = 2000
  const reservationResult = await db().queryDocs<InventoryReservation & Record<string, unknown>>({
    collection: INVENTORY_COLLECTIONS.reservations,
    filters: [{ field: 'status', operator: '=', value: 'active' }],
    pagination: { limit: reservationLimit },
  })
  const reservationRows = reservationResult.success && reservationResult.data ? reservationResult.data : []
  const reservationPageComplete = reservationRows.length < reservationLimit
  const openByLevel = new Map<string, number>()
  if (reservationPageComplete) {
  for (const reservation of reservationRows) {
    const key = `${reservation.productId}:${reservation.storeId}`
    openByLevel.set(key, (openByLevel.get(key) || 0) + Number(reservation.quantity || 0))
  }
  for (const level of levels) {
    const key = `${level.productId}:${level.storeId}`
    const reservationQuantity = openByLevel.get(key) || 0
    const reserved = Number(level.reserved || 0)
    if (reserved === reservationQuantity) continue
    samples.push({
      productId: level.productId,
      storeId: level.storeId,
      stock: reserved,
      available: Number(level.available || 0),
      reserved,
      expectedStock: reservationQuantity,
      delta: reserved - reservationQuantity,
      reservationQuantity,
      reservationDelta: reserved - reservationQuantity,
    })
  }
  }

  if (samples.length > 0) {
    logger.warn('[InventorySync] inventory drift detected', {
      checked,
      drifted: samples.length,
      sampleProductIds: samples.slice(0, 10).map((s) => s.productId),
    })
  }

  return { checked, drifted: samples.length, samples: samples.slice(0, 50) }
}
