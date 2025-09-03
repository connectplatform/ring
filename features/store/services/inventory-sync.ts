/**
 * Inventory Synchronization Service
 * 
 * Manages real-time inventory updates across multiple stores,
 * handles reservations for pending orders, and prevents overselling.
 */

import { 
  getCachedDocumentTyped,
  updateDocumentTyped,
  runTransaction,
  getCachedCollectionTyped,
  createDocumentTyped
} from '@/lib/services/firebase-service-manager'
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
  await runTransaction(async (transaction) => {
    // Get current inventory level
    const inventoryId = `${productId}_${storeId}`
    const currentLevel = await getCachedDocumentTyped<InventoryLevel>(
      'inventoryLevels',
      inventoryId
    )

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
      await updateDocumentTyped('inventoryLevels', inventoryId, newLevel)
    } else {
      await createDocumentTyped('inventoryLevels', inventoryId, newLevel)
    }

    // Update product stock status
    const product = await getCachedDocumentTyped<StoreProduct>('products', productId)
    if (product) {
      await updateDocumentTyped(
        'products',
        productId,
        { inStock: newAvailable > 0 }
      )
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

  await runTransaction(async (transaction) => {
    // Get current inventory level
    const inventoryId = `${productId}_${storeId}`
    const currentLevel = await getCachedDocumentTyped<InventoryLevel>(
      'inventoryLevels',
      inventoryId
    )

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

    await updateDocumentTyped('inventoryLevels', inventoryId, updatedLevel)

    // Create reservation
    await createDocumentTyped('inventoryReservations', reservationId, reservation)
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
  const reservation = await getCachedDocumentTyped<InventoryReservation>(
    'inventoryReservations',
    reservationId
  )

  if (!reservation || reservation.status !== 'active') {
    return // Already processed or doesn't exist
  }

  await runTransaction(async (transaction) => {
    // Update reservation status
    await updateDocumentTyped(
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
      const currentLevel = await getCachedDocumentTyped<InventoryLevel>(
        'inventoryLevels',
        inventoryId
      )

      if (currentLevel) {
        const updatedLevel: Partial<InventoryLevel> = {
          available: currentLevel.available + reservation.quantity,
          reserved: Math.max(0, currentLevel.reserved - reservation.quantity),
          lastUpdated: new Date().toISOString(),
          syncVersion: currentLevel.syncVersion + 1
        }

        await updateDocumentTyped('inventoryLevels', inventoryId, updatedLevel)
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
  const product = await getCachedDocumentTyped<StoreProduct>('products', productId)
  if (!product || !product.productListedAt) {
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
  const masterInventory = await getCachedDocumentTyped<InventoryLevel>(
    'inventoryLevels',
    `${productId}_${masterStoreId}`
  )

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
  // Get total inventory across all stores
  const inventoryLevels = await Promise.all(
    storeIds.map(storeId =>
      getCachedDocumentTyped<InventoryLevel>('inventoryLevels', `${productId}_${storeId}`)
    )
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
  // This strategy maintains a minimum reserved level at each store
  // and redistributes excess inventory as needed
  const MIN_RESERVED = 5 // Configurable minimum per store

  for (const storeId of storeIds) {
    const inventory = await getCachedDocumentTyped<InventoryLevel>(
      'inventoryLevels',
      `${productId}_${storeId}`
    )

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
  // Find stores with excess inventory
  const inventoryLevels = await getCachedCollectionTyped<InventoryLevel>(
    'inventoryLevels',
    {
      filters: [
        { field: 'productId', operator: '==', value: productId },
        { field: 'available', operator: '>', value: quantity }
      ],
      orderBy: { field: 'available', direction: 'desc' },
      limit: 1
    }
  )

  if (inventoryLevels.items.length === 0) {
    return // No stores with sufficient excess
  }

  const sourceStore = inventoryLevels.items[0]
  
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

  await createDocumentTyped('inventoryTransfers', transfer.id, transfer)
  
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
  const transfer = await getCachedDocumentTyped<InventoryTransfer>(
    'inventoryTransfers',
    transferId
  )

  if (!transfer || transfer.status !== 'pending') {
    return
  }

  await runTransaction(async (transaction) => {
    // Subtract from source store
    await updateInventoryLevels(
      transfer.productId,
      transfer.fromStoreId,
      transfer.quantity,
      'subtract'
    )

    // Add to destination store
    await updateInventoryLevels(
      transfer.productId,
      transfer.toStoreId,
      transfer.quantity,
      'add'
    )

    // Update transfer status
          await updateDocumentTyped(
        'inventoryTransfers',
        transferId,
        {
          status: 'completed',
          completedAt: new Date().toISOString()
        }
      )
  })
}

/**
 * Clean up expired reservations
 */
export async function cleanupExpiredReservations(): Promise<void> {
  const now = new Date().toISOString()
  
  const expiredReservations = await getCachedCollectionTyped<InventoryReservation>(
    'inventoryReservations',
    {
      filters: [
        { field: 'status', operator: '==', value: 'active' },
        { field: 'expiresAt', operator: '<', value: now }
      ]
    }
  )

  for (const reservation of expiredReservations.items) {
    await releaseReservation(reservation.id, false)
  }
}

// createDocumentTyped is now imported from firebase-helpers
