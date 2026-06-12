/**
 * Inventory Synchronization Service
 * 
 * Manages real-time inventory updates across multiple stores,
 * handles reservations for pending orders, and prevents overselling.
 * 
 * Uses PostgreSQL transactions for atomic inventory operations
 */

import { db } from '@/lib/database'
import { StoreProduct } from '@/features/store/types'
import { InventorySyncStrategy, StoreEvent } from '@/constants/store'
import { publishEvent } from '@/lib/events/event-bus.server'

/** PostgreSQL tables (snake_case — see data/migrations/008_inventory_schema.sql). */
export const INVENTORY_COLLECTIONS = {
  levels: 'inventory_levels',
  reservations: 'inventory_reservations',
} as const

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
 * Update inventory levels for a product across listed stores
 */
export async function updateInventoryLevels(
  productId: string,
  storeId: string,
  quantityChange: number,
  operation: 'add' | 'subtract' | 'set'
): Promise<void> {
  await db().transaction(async (transaction) => {
    const inventoryId = `${productId}_${storeId}`
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

    const newLevel: InventoryLevel = {
      productId,
      storeId,
      available: newAvailable,
      reserved: currentLevel?.reserved || 0,
      total: newAvailable + (currentLevel?.reserved || 0),
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
      await transaction.update('store_products', productId, { inStock: newAvailable > 0 })
    }
  })

  // Publish inventory update event
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
    const inventoryId = `${productId}_${storeId}`
    const currentLevelDoc = await transaction.read(INVENTORY_COLLECTIONS.levels, inventoryId)
    const currentLevel = currentLevelDoc?.data as InventoryLevel | undefined

    if (!currentLevel || currentLevel.available < quantity) {
      throw new Error(`Insufficient inventory for product ${productId}`)
    }

    const updatedLevel: Partial<InventoryLevel> = {
      available: currentLevel.available - quantity,
      reserved: currentLevel.reserved + quantity,
      lastUpdated: now.toISOString(),
      syncVersion: currentLevel.syncVersion + 1
    }

    await transaction.update(INVENTORY_COLLECTIONS.levels, inventoryId, updatedLevel)
    await transaction.create(INVENTORY_COLLECTIONS.reservations, reservation, { id: reservationId })
  })

  return reservation
}

/**
 * Reserve stock for each order item that has a configured inventory level row.
 * Products without inventory_levels rows are skipped (stock tracked via ERPStockService).
 * Throws when a configured product has insufficient availability.
 */
export async function reserveInventoryForOrder(
  orderId: string,
  items: Array<{ productId: string; quantity: number; storeId?: string }>,
  reservationMinutes: number = 15
): Promise<{ reserved: InventoryReservation[]; skipped: string[] }> {
  const reserved: InventoryReservation[] = []
  const skipped: string[] = []

  for (const item of items) {
    const storeId = item.storeId || '1'
    const levelRow = await db().readDoc<InventoryLevel & Record<string, unknown>>(
      INVENTORY_COLLECTIONS.levels,
      `${item.productId}_${storeId}`
    )
    if (!levelRow.success || !levelRow.data) {
      skipped.push(item.productId)
      continue
    }
    const reservation = await reserveInventory(item.productId, storeId, orderId, item.quantity, reservationMinutes)
    reserved.push(reservation)
  }

  return { reserved, skipped }
}

/**
 * Release inventory reservation
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
    return // Already processed or doesn't exist
  }

  const reservation = reservationResult.data as InventoryReservation

  if (reservation.status !== 'active') {
    return // Already processed
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

    if (!fulfilled) {
      const inventoryId = `${reservation.productId}_${reservation.storeId}`
      const currentLevelDoc = await transaction.read(INVENTORY_COLLECTIONS.levels, inventoryId)
      const currentLevel = currentLevelDoc?.data as InventoryLevel | undefined

      if (currentLevel) {
        const updatedLevel: Partial<InventoryLevel> = {
          available: currentLevel.available + reservation.quantity,
          reserved: Math.max(0, currentLevel.reserved - reservation.quantity),
          lastUpdated: new Date().toISOString(),
          syncVersion: currentLevel.syncVersion + 1
        }

        await transaction.update(INVENTORY_COLLECTIONS.levels, inventoryId, updatedLevel)
      }
    }
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

/**
 * Sync inventory from master store to other stores
 */
async function syncFromMasterStore(
  productId: string,
  masterStoreId: string,
  storeIds: string[]
): Promise<void> {
  const masterResult = await db().findDocById<InventoryLevel & Record<string, unknown>>(
    INVENTORY_COLLECTIONS.levels,
    `${productId}_${masterStoreId}`
  )
  if (!masterResult.success || !masterResult.data) {
    return
  }
  const masterInventory = masterResult.data as InventoryLevel

  if (!masterInventory) {
    return
  }

  // Update all other stores to match master
  const updates = storeIds
    .filter(id => id !== masterStoreId)
    .map(storeId => 
      updateInventoryLevels(productId, storeId, masterInventory.available, 'set')
    )

  await Promise.all(updates)
}

/**
 * Distribute inventory evenly across stores
 */
async function distributeInventoryEvenly(
  productId: string,
  storeIds: string[]
): Promise<void> {
  const inventoryLevels = await Promise.all(
    storeIds.map(async storeId => {
      const result = await db().findDocById<InventoryLevel & Record<string, unknown>>(
        INVENTORY_COLLECTIONS.levels,
        `${productId}_${storeId}`
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

  // Distribute evenly with remainder going to first stores
  const updates = storeIds.map((storeId, index) => {
    const quantity = perStoreInventory + (index < remainder ? 1 : 0)
    return updateInventoryLevels(productId, storeId, quantity, 'set')
  })

  await Promise.all(updates)
}

/**
 * Maintain reserved inventory levels per store
 */
async function maintainReservedLevels(
  productId: string,
  storeIds: string[]
): Promise<void> {
  const MIN_RESERVED = 5

  for (const storeId of storeIds) {
    const inventoryResult = await db().findDocById<InventoryLevel & Record<string, unknown>>(
      INVENTORY_COLLECTIONS.levels,
      `${productId}_${storeId}`
    )
    const inventory = inventoryResult.success && inventoryResult.data
      ? (inventoryResult.data as InventoryLevel)
      : null

    if (!inventory || inventory.available < MIN_RESERVED) {
      // Try to transfer from other stores with excess
      await requestInventoryTransfer(productId, storeId, MIN_RESERVED - (inventory?.available || 0))
    }
  }
}

/**
 * Request inventory transfer from stores with excess
 */
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
    return // No stores with sufficient excess
  }

  const sourceStore = result.data[0] as InventoryLevel
  
  // Create transfer record
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
  
  // In a real system, this would trigger a fulfillment workflow
  // For now, we'll just update the inventory levels
  await processInventoryTransfer(transfer.id)
}

/**
 * Process an inventory transfer
 */
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
    const sourceId = `${transfer.productId}_${transfer.fromStoreId}`
    const sourceLevelDoc = await transaction.read(INVENTORY_COLLECTIONS.levels, sourceId)
    const sourceLevel = sourceLevelDoc?.data as InventoryLevel | undefined

    if (sourceLevel) {
      await transaction.update(INVENTORY_COLLECTIONS.levels, sourceId, {
        available: Math.max(0, sourceLevel.available - transfer.quantity),
        syncVersion: sourceLevel.syncVersion + 1,
        lastUpdated: new Date().toISOString()
      })
    }

    const destId = `${transfer.productId}_${transfer.toStoreId}`
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
 * Clean up expired reservations
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
