/**
 * Inventory Synchronization Service
 * 
 * Manages real-time inventory updates across multiple stores,
 * handles reservations for pending orders, and prevents overselling.
 * 
 * Uses PostgreSQL transactions for atomic inventory operations
 */

import { initializeDatabase, getDatabaseService } from '@/lib/database'
import { StoreProduct } from '@/features/store/types'
import { InventorySyncStrategy, StoreEvent } from '@/constants/store'
import { publishEvent } from '@/lib/events/event-bus.server'

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
  await initializeDatabase()
  const db = getDatabaseService()
  
  await db.transaction(async (transaction) => {
    // Get current inventory level
    const inventoryId = `${productId}_${storeId}`
    const currentLevelDoc = await transaction.read('inventoryLevels', inventoryId)
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

    // Update inventory level
    if (currentLevel) {
      await transaction.update('inventoryLevels', inventoryId, newLevel)
    } else {
      await transaction.create('inventoryLevels', newLevel, { id: inventoryId })
    }

    // Update product stock status
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
  await initializeDatabase()
  const db = getDatabaseService()
  
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

  await db.transaction(async (transaction) => {
    // Get current inventory level
    const inventoryId = `${productId}_${storeId}`
    const currentLevelDoc = await transaction.read('inventoryLevels', inventoryId)
    const currentLevel = currentLevelDoc?.data as InventoryLevel | undefined

    if (!currentLevel || currentLevel.available < quantity) {
      throw new Error(`Insufficient inventory for product ${productId}`)
    }

    // Update inventory levels
    const updatedLevel: Partial<InventoryLevel> = {
      available: currentLevel.available - quantity,
      reserved: currentLevel.reserved + quantity,
      lastUpdated: now.toISOString(),
      syncVersion: currentLevel.syncVersion + 1
    }

    await transaction.update('inventoryLevels', inventoryId, updatedLevel)

    // Create reservation
    await transaction.create('inventoryReservations', reservation, { id: reservationId })
  })

  return reservation
}

/**
 * Release inventory reservation
 */
export async function releaseReservation(
  reservationId: string,
  fulfilled: boolean = false
): Promise<void> {
  await initializeDatabase()
  const db = getDatabaseService()
  
  // Get reservation first
  const reservationResult = await db.findById('inventoryReservations', reservationId)
  if (!reservationResult.success || !reservationResult.data) {
    return // Already processed or doesn't exist
  }
  
  const reservationData = reservationResult.data.data || reservationResult.data
  const reservation = { id: reservationId, ...reservationData } as InventoryReservation

  if (reservation.status !== 'active') {
    return // Already processed
  }

  await db.transaction(async (transaction) => {
    // Update reservation status
    await transaction.update(
      'inventoryReservations',
      reservationId,
      { 
        status: fulfilled ? 'fulfilled' : 'cancelled',
        updatedAt: new Date().toISOString()
      }
    )

    if (!fulfilled) {
      // Return reserved inventory to available pool
      const inventoryId = `${reservation.productId}_${reservation.storeId}`
      const currentLevelDoc = await transaction.read('inventoryLevels', inventoryId)
      const currentLevel = currentLevelDoc?.data as InventoryLevel | undefined

      if (currentLevel) {
        const updatedLevel: Partial<InventoryLevel> = {
          available: currentLevel.available + reservation.quantity,
          reserved: Math.max(0, currentLevel.reserved - reservation.quantity),
          lastUpdated: new Date().toISOString(),
          syncVersion: currentLevel.syncVersion + 1
        }

        await transaction.update('inventoryLevels', inventoryId, updatedLevel)
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
  await initializeDatabase()
  const db = getDatabaseService()
  
  const productResult = await db.findById('store_products', productId)
  if (!productResult.success || !productResult.data) {
    return
  }
  
  const productData = productResult.data.data || productResult.data
  const product = { id: productId, ...productData } as StoreProduct
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
  const db = getDatabaseService()
  
  const masterResult = await db.findById('inventoryLevels', `${productId}_${masterStoreId}`)
  if (!masterResult.success || !masterResult.data) {
    return
  }
  const masterInventory = (masterResult.data.data || masterResult.data) as InventoryLevel

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
  const db = getDatabaseService()
  
  // Get total inventory across all stores
  const inventoryLevels = await Promise.all(
    storeIds.map(async storeId => {
      const result = await db.findById('inventoryLevels', `${productId}_${storeId}`)
      return result.success && result.data 
        ? (result.data.data || result.data) as InventoryLevel
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
  const db = getDatabaseService()
  
  // This strategy maintains a minimum reserved level at each store
  // and redistributes excess inventory as needed
  const MIN_RESERVED = 5 // Configurable minimum per store

  for (const storeId of storeIds) {
    const inventoryResult = await db.findById('inventoryLevels', `${productId}_${storeId}`)
    const inventory = inventoryResult.success && inventoryResult.data
      ? (inventoryResult.data.data || inventoryResult.data) as InventoryLevel
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
  const db = getDatabaseService()
  
  // Find stores with excess inventory
  const result = await db.query({
    collection: 'inventoryLevels',
    filters: [
      { field: 'productId', operator: '=', value: productId },
      { field: 'available', operator: '>', value: quantity }
    ],
    orderBy: [{ field: 'available', direction: 'desc' }],
    pagination: { limit: 1 }
  })

  if (!result.success || !result.data) {
    return // No stores with sufficient excess
  }

  const data = Array.isArray(result.data) ? result.data : (result.data as any).data || []
  if (data.length === 0) {
    return
  }

  const sourceStoreItem = data[0]
  const sourceStore = { id: sourceStoreItem.id, ...(sourceStoreItem.data || sourceStoreItem) } as InventoryLevel
  
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

  await db.create('inventoryTransfers', transfer, { id: transfer.id })
  
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
  await initializeDatabase()
  const db = getDatabaseService()
  
  // Get transfer first
  const transferResult = await db.findById('inventoryTransfers', transferId)
  if (!transferResult.success || !transferResult.data) {
    return
  }
  
  const transferData = transferResult.data.data || transferResult.data
  const transfer = { id: transferId, ...transferData } as InventoryTransfer

  if (transfer.status !== 'pending') {
    return
  }

  await db.transaction(async (transaction) => {
    // Subtract from source store
    const sourceId = `${transfer.productId}_${transfer.fromStoreId}`
    const sourceLevelDoc = await transaction.read('inventoryLevels', sourceId)
    const sourceLevel = sourceLevelDoc?.data as InventoryLevel | undefined
    
    if (sourceLevel) {
      await transaction.update('inventoryLevels', sourceId, {
        available: Math.max(0, sourceLevel.available - transfer.quantity),
        syncVersion: sourceLevel.syncVersion + 1,
        lastUpdated: new Date().toISOString()
      })
    }

    // Add to destination store
    const destId = `${transfer.productId}_${transfer.toStoreId}`
    const destLevelDoc = await transaction.read('inventoryLevels', destId)
    const destLevel = destLevelDoc?.data as InventoryLevel | undefined
    
    if (destLevel) {
      await transaction.update('inventoryLevels', destId, {
        available: destLevel.available + transfer.quantity,
        syncVersion: destLevel.syncVersion + 1,
        lastUpdated: new Date().toISOString()
      })
    }

    // Update transfer status
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
  await initializeDatabase()
  const db = getDatabaseService()
  
  const now = new Date().toISOString()
  
  const result = await db.query({
    collection: 'inventoryReservations',
    filters: [
      { field: 'status', operator: '=', value: 'active' },
      { field: 'expiresAt', operator: '<', value: now }
    ]
  })

  if (!result.success || !result.data) {
    return
  }

  const data = Array.isArray(result.data) ? result.data : (result.data as any).data || []
  const expiredReservations = data.map(item => ({
    id: item.id,
    ...(item.data || item)
  })) as InventoryReservation[]

  for (const reservation of expiredReservations) {
    await releaseReservation(reservation.id, false)
  }
}
