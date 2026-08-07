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
  const stock =
    productResult.success && productResult.data
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
  reservationMinutes: number = 15
): Promise<InventoryReservation> {
  const reservationId = `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const now = new Date()
  const expiresAt = new Date(now.getTime() + reservationMinutes * 60000)

  const reservation: InventoryReservation = {
    id: reservationId,
    productId,
    storeId,
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
      throw new Error(`Insufficient inventory for product ${productId}`)
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
    isPreorder?: boolean
    digitalProduct?: boolean
    instantDelivery?: boolean
  }>,
  reservationMinutes: number = ORDER_RESERVATION_MINUTES
): Promise<{ reserved: InventoryReservation[]; skipped: string[] }> {
  const reserved: InventoryReservation[] = []
  const skipped: string[] = []

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
    const storeId = item.storeId || DEFAULT_INVENTORY_STORE_ID
    await ensureInventoryLevel(item.productId, storeId)
    const reservation = await reserveInventory(
      item.productId,
      storeId,
      orderId,
      item.quantity,
      reservationMinutes,
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

      // 2. Deduct stock per line; re-assert available = stock - reserved (covers no-hold paid path)
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
        // Prefer live product flags if cart item omitted them
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

        const currentStock = Number(productData.stock ?? 0)
        const qty = item.quantity || 1
        const newStock = Math.max(0, currentStock - qty)

        await transaction.update('store_products', productId, {
          stock: newStock,
          inStock: newStock > 0,
          updatedAt: now,
        })

        const storeId = DEFAULT_INVENTORY_STORE_ID
        const inventoryId = inventoryLevelId(productId, storeId)
        const levelDoc = await transaction.read(INVENTORY_COLLECTIONS.levels, inventoryId)
        const level = levelDoc?.data as InventoryLevel | undefined
        const reserved = level?.reserved ?? 0
        // Always re-assert invariant after stock change (fixes unpaid→paid without hold drift)
        const available = Math.max(0, newStock - reserved)

        const aligned: InventoryLevel = {
          productId,
          storeId,
          available,
          reserved,
          total: available + reserved,
          lastUpdated: now,
          syncVersion: (level?.syncVersion || 0) + 1,
        }

        if (level) {
          await transaction.update(INVENTORY_COLLECTIONS.levels, inventoryId, aligned)
        } else {
          await transaction.create(
            INVENTORY_COLLECTIONS.levels,
            {
              ...aligned,
              available: newStock,
              reserved: 0,
              total: newStock,
            },
            { id: inventoryId },
          )
        }

        const movement: StockMovement = {
          id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          productId,
          warehouseId: ZERO_WAREHOUSE_ID,
          movementType: 'sale',
          quantityBefore: currentStock,
          quantityChange: -qty,
          quantityAfter: newStock,
          orderId,
          userId,
          reason: `Order #${orderId} - ${item.product?.name ?? productId} x${qty}`,
          timestamp: now,
          referralCode: referralMeta?.referralCode,
          assisted: referralMeta?.assisted,
        }
        await transaction.create(STORE_COLLECTIONS.stockMovements, movement, { id: movement.id })

        deductedProducts.push(productId)
        if (newStock <= STOCK_THRESHOLDS.LOW_STOCK) {
          lowStockAlerts.push({ productId, stock: newStock })
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

      await transaction.update('store_products', sale.productId, {
        stock: newStock,
        inStock: true,
        updatedAt: now,
      })

      const inventoryId = inventoryLevelId(sale.productId, DEFAULT_INVENTORY_STORE_ID)
      const levelDoc = await transaction.read(INVENTORY_COLLECTIONS.levels, inventoryId)
      const level = levelDoc?.data as InventoryLevel | undefined
      const reserved = level?.reserved ?? 0
      const available = (level?.available ?? currentStock - reserved) + qty

      const aligned: InventoryLevel = {
        productId: sale.productId,
        storeId: DEFAULT_INVENTORY_STORE_ID,
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
        warehouseId: ZERO_WAREHOUSE_ID,
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
export async function cleanupExpiredReservations(): Promise<void> {
  const now = new Date().toISOString()

  const result = await db().queryDocs<InventoryReservation & Record<string, unknown>>({
    collection: INVENTORY_COLLECTIONS.reservations,
    filters: [
      { field: 'status', operator: '=', value: 'active' },
      { field: 'expiresAt', operator: '<', value: now }
    ]
  })

  if (!result.success || !result.data) {
    return
  }

  const expiredReservations = result.data as InventoryReservation[]

  for (const reservation of expiredReservations) {
    await releaseReservation(reservation.id, false)
  }
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
  let checked = 0

  for (const level of levels) {
    checked += 1
    const productResult = await db().findDocById<StoreProduct & Record<string, unknown>>(
      'store_products',
      level.productId,
    )
    const stock = Number(
      productResult.success && productResult.data
        ? (productResult.data as StoreProduct).stock ?? 0
        : 0,
    )
    const available = Number(level.available ?? 0)
    const reserved = Number(level.reserved ?? 0)
    const expectedStock = available + reserved
    if (stock !== expectedStock) {
      samples.push({
        productId: level.productId,
        stock,
        available,
        reserved,
        expectedStock,
        delta: stock - expectedStock,
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
