/**
 * AI-ERP Stock Management Service
 * 
 * Warehouse Manager AI Agent - Inventory optimization and warehouse operations
 * 
 * Implements:
 * - Real-time inventory tracking across locations (zero-warehouse = main warehouse)
 * - Automatic stock deduction on successful orders
 * - Low stock alerts and reorder point triggers
 * - Batch and lot tracking for FSMA 204 compliance
 * - Integration with WayForPay webhook for automatic updates
 * 
 * @see AI-CONTEXT/ring-greenfood-live/concepts/ai-erp-stock-management.json
 */

import 'server-only'

import { db } from '@/lib/database'
import { logger } from '@/lib/logger'
import { StoreProduct, CartItem } from '@/features/store/types'
import { publishEvent } from '@/lib/events/event-bus.server'
import { StoreEvent } from '@/constants/store'
import { STORE_COLLECTIONS } from '@/features/store/constants/collections'
import {
  DEFAULT_INVENTORY_STORE_ID,
  DEFAULT_WAREHOUSE_NAME,
  shouldSkipPhysicalStock,
  STOCK_THRESHOLDS,
  ZERO_WAREHOUSE_ID,
} from '@/features/store/constants/stock'
import {
  ensureInventoryLevel,
} from '@/features/store/services/inventory-sync'
import type {
  BatchAddStockResult,
  StockLevel,
  StockMovement,
  StockUpdate,
} from '@/features/store/types/erp-stock'

export {
  DEFAULT_INVENTORY_STORE_ID,
  DEFAULT_WAREHOUSE_NAME,
  STOCK_THRESHOLDS,
  ZERO_WAREHOUSE_ID,
} from '@/features/store/constants/stock'
export type {
  BatchAddStockResult,
  StockLevel,
  StockMovement,
  StockUpdate,
} from '@/features/store/types/erp-stock'

type StoreProductRow = StoreProduct & Record<string, unknown>

/**
 * AI-ERP Stock Service - Warehouse Manager AI Agent
 */
export const ERPStockService = {
  /**
   * Get current stock level for a product in a warehouse
   */
  async getStockLevel(productId: string, warehouseId: string = ZERO_WAREHOUSE_ID): Promise<StockLevel | null> {
    try {
      const result = await db().findDocById<StoreProductRow>('store_products', productId)
      if (!result.success || !result.data) {
        return null
      }

      const productData = result.data
      const stock = productData.stock ?? 0
      const reorderPoint = productData.reorderPoint ?? STOCK_THRESHOLDS.DEFAULT_REORDER_POINT

      // Sellable / reserved from inventory_levels (bootstrap if missing)
      let availableQuantity = stock
      let reservedQuantity = 0
      try {
        const level = await ensureInventoryLevel(productId, DEFAULT_INVENTORY_STORE_ID)
        availableQuantity = level.available
        reservedQuantity = level.reserved
      } catch (levelError) {
        logger.warn('[ERPStockService] getStockLevel levels fallback to product.stock', {
          productId,
          levelError,
        })
      }

      return {
        productId,
        warehouseId,
        availableQuantity,
        reservedQuantity,
        totalQuantity: stock,
        lastUpdated: String(productData.updatedAt ?? new Date().toISOString()),
        reorderPoint,
        isLowStock:
          availableQuantity <= STOCK_THRESHOLDS.LOW_STOCK &&
          availableQuantity > STOCK_THRESHOLDS.CRITICAL_STOCK,
        isCriticalStock:
          availableQuantity <= STOCK_THRESHOLDS.CRITICAL_STOCK &&
          availableQuantity > STOCK_THRESHOLDS.OUT_OF_STOCK,
        isOutOfStock: availableQuantity <= STOCK_THRESHOLDS.OUT_OF_STOCK,
      }
    } catch (error) {
      logger.error('[ERPStockService] Error getting stock level:', error)
      return null
    }
  },

  /**
   * Update stock for a single product
   */
  async updateStock(update: StockUpdate): Promise<{ success: boolean; newQuantity: number; error?: string }> {
    try {
      const result = await db().findDocById<StoreProductRow>('store_products', update.productId)
      if (!result.success || !result.data) {
        return { success: false, newQuantity: 0, error: 'Product not found' }
      }

      const productData = result.data
      const currentStock = productData.stock ?? 0
      
      // Calculate new stock based on operation
      let newStock: number
      switch (update.operation) {
        case 'add':
          newStock = currentStock + update.quantityChange
          break
        case 'subtract':
          newStock = Math.max(0, currentStock - update.quantityChange)
          break
        case 'set':
          newStock = Math.max(0, update.quantityChange)
          break
        default:
          return { success: false, newQuantity: currentStock, error: 'Invalid operation' }
      }

      const now = new Date().toISOString()

      try {
        await db().transaction(async (transaction) => {
          const inventoryId = `${update.productId}_${DEFAULT_INVENTORY_STORE_ID}`
          const levelDoc = await transaction.read('inventory_levels', inventoryId)
          const level = levelDoc?.data as
            | { available: number; reserved: number; syncVersion: number }
            | undefined
          const reserved = level?.reserved ?? 0

          if (update.operation === 'set' && newStock < reserved) {
            throw new Error(
              `Cannot set stock (${newStock}) below reserved (${reserved}) for product ${update.productId}`,
            )
          }

          let available: number
          if (!level) {
            available = Math.max(0, newStock - reserved)
          } else if (update.operation === 'add') {
            available = level.available + update.quantityChange
          } else if (update.operation === 'subtract') {
            available = Math.max(0, level.available - update.quantityChange)
          } else {
            available = Math.max(0, newStock - reserved)
          }

          const levelPayload = {
            productId: update.productId,
            storeId: DEFAULT_INVENTORY_STORE_ID,
            available,
            reserved,
            total: available + reserved,
            lastUpdated: now,
            syncVersion: (level?.syncVersion || 0) + 1,
          }

          if (level) {
            await transaction.update('inventory_levels', inventoryId, levelPayload)
          } else {
            await transaction.create('inventory_levels', levelPayload, { id: inventoryId })
          }

          await transaction.update('store_products', update.productId, {
            stock: newStock,
            inStock: newStock > 0,
            updatedAt: now,
          })
        })
      } catch (txnError) {
        return {
          success: false,
          newQuantity: currentStock,
          error: txnError instanceof Error ? txnError.message : 'Failed to update stock',
        }
      }

      await this.logStockMovement({
        id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        productId: update.productId,
        warehouseId: update.warehouseId || ZERO_WAREHOUSE_ID,
        movementType: update.orderId ? 'sale' : 'adjustment',
        quantityBefore: currentStock,
        quantityChange:
          update.operation === 'subtract' ? -update.quantityChange : update.quantityChange,
        quantityAfter: newStock,
        orderId: update.orderId,
        userId: update.userId,
        reason: update.reason,
        timestamp: now,
        referralCode: update.referralCode,
        assisted: update.assisted,
      })

      logger.info('[ERPStockService] Stock updated', {
        productId: update.productId,
        operation: update.operation,
        quantityChange: update.quantityChange,
        previousStock: currentStock,
        newStock,
        reason: update.reason,
        orderId: update.orderId,
      })

      await publishEvent({
        type: StoreEvent.INVENTORY_UPDATED,
        payload: {
          productId: update.productId,
          warehouseId: update.warehouseId || ZERO_WAREHOUSE_ID,
          previousStock: currentStock,
          newStock,
          operation: update.operation,
          orderId: update.orderId,
        },
      })

      if (newStock <= STOCK_THRESHOLDS.LOW_STOCK) {
        await this.triggerLowStockAlert(update.productId, newStock)
      }

      return { success: true, newQuantity: newStock }
    } catch (error) {
      logger.error('[ERPStockService] Error updating stock:', error)
      return { success: false, newQuantity: 0, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  },

  /**
   * Deduct stock for order items after successful payment
   * Called from WayForPay webhook on successful payment
   */
  async deductStockForOrder(
    orderId: string,
    items: CartItem[],
    userId?: string,
    referralMeta?: { referralCode?: string; assisted?: boolean },
  ): Promise<{ success: boolean; deductedProducts: string[]; failedProducts: string[] }> {
    const deductedProducts: string[] = []
    const failedProducts: string[] = []
    
    logger.info('[ERPStockService] Deducting stock for order', {
      orderId,
      itemCount: items.length,
      userId
    })
    
    for (const item of items) {
      if (shouldSkipPhysicalStock(item)) {
        logger.info('[ERPStockService] Skipping non-physical stock item', {
          orderId,
          productId: item.product.id,
          productName: item.product.name,
          isPreorder: item.isPreorder,
          digitalProduct: item.product.digitalProduct,
          instantDelivery: item.product.instantDelivery,
        })
        continue
      }
      
      const result = await this.updateStock({
        productId: item.product.id,
        warehouseId: ZERO_WAREHOUSE_ID,
        quantityChange: item.quantity,
        operation: 'subtract',
        reason: `Order #${orderId} - ${item.product.name} x${item.quantity}`,
        orderId,
        userId,
        referralCode: referralMeta?.referralCode,
        assisted: referralMeta?.assisted,
      })
      
      if (result.success) {
        deductedProducts.push(item.product.id)
      } else {
        failedProducts.push(item.product.id)
        logger.warn('[ERPStockService] Failed to deduct stock for product', {
          orderId,
          productId: item.product.id,
          error: result.error
        })
      }
    }
    
    logger.info('[ERPStockService] Stock deduction completed', {
      orderId,
      deductedCount: deductedProducts.length,
      failedCount: failedProducts.length
    })
    
    return {
      success: failedProducts.length === 0,
      deductedProducts,
      failedProducts
    }
  },

  /**
   * Add initial stock to all products in the warehouse
   * Used for initial inventory population
   */
  async addInitialStockToAllProducts(
    quantity: number = 100,
    warehouseId: string = ZERO_WAREHOUSE_ID
  ): Promise<BatchAddStockResult> {
    try {
      logger.info('[ERPStockService] Adding initial stock to all products', {
        quantity,
        warehouseId
      })
      
      const result = await db().queryDocs<StoreProductRow>({
        collection: 'store_products',
        filters: [],
        pagination: { limit: 1000 }
      })
      
      if (!result.success || !result.data) {
        return {
          success: false,
          totalProducts: 0,
          successfulUpdates: 0,
          failedUpdates: 0,
          errors: [{ productId: 'all', error: 'Failed to fetch products' }]
        }
      }

      const products = result.data
      
      const errors: Array<{ productId: string; error: string }> = []
      let successfulUpdates = 0
      let failedUpdates = 0
      
      // Update each product's stock
      for (const product of products) {
        const updateResult = await this.updateStock({
          productId: product.id,
          warehouseId,
          quantityChange: quantity,
          operation: 'set',
          reason: `Initial stock population - ${quantity} units`
        })
        
        if (updateResult.success) {
          successfulUpdates++
        } else {
          failedUpdates++
          errors.push({ productId: product.id, error: updateResult.error || 'Unknown error' })
        }
      }
      
      logger.info('[ERPStockService] Initial stock population completed', {
        totalProducts: products.length,
        successfulUpdates,
        failedUpdates
      })
      
      return {
        success: failedUpdates === 0,
        totalProducts: products.length,
        successfulUpdates,
        failedUpdates,
        errors
      }
    } catch (error) {
      logger.error('[ERPStockService] Error adding initial stock:', error)
      return {
        success: false,
        totalProducts: 0,
        successfulUpdates: 0,
        failedUpdates: 1,
        errors: [{ productId: 'all', error: error instanceof Error ? error.message : 'Unknown error' }]
      }
    }
  },

  /**
   * Get all products with low stock
   */
  async getLowStockProducts(
    threshold: number = STOCK_THRESHOLDS.LOW_STOCK
  ): Promise<StoreProduct[]> {
    try {
      const result = await db().queryDocs<StoreProductRow>({
        collection: 'store_products',
        filters: [
          { field: 'stock', operator: '<=', value: threshold }
        ],
        orderBy: [{ field: 'stock', direction: 'asc' }],
        pagination: { limit: 100 }
      })
      
      if (!result.success || !result.data) {
        return []
      }

      return result.data as StoreProduct[]
    } catch (error) {
      logger.error('[ERPStockService] Error getting low stock products:', error)
      return []
    }
  },

  /**
   * Log stock movement for audit trail
   */
  async logStockMovement(movement: StockMovement): Promise<void> {
    try {
      await db().createDoc(STORE_COLLECTIONS.stockMovements, movement, { id: movement.id })
      
      logger.debug('[ERPStockService] Stock movement logged', {
        movementId: movement.id,
        productId: movement.productId,
        type: movement.movementType,
        quantityChange: movement.quantityChange
      })
    } catch (error) {
      // Don't fail the main operation if logging fails
      logger.warn('[ERPStockService] Failed to log stock movement:', error)
    }
  },

  /**
   * Trigger low stock alert for AI monitoring
   */
  async triggerLowStockAlert(productId: string, currentStock: number): Promise<void> {
    try {
      const isCritical = currentStock <= STOCK_THRESHOLDS.CRITICAL_STOCK
      const alertLevel = currentStock === 0 ? 'OUT_OF_STOCK' : isCritical ? 'CRITICAL' : 'LOW'
      
      logger.warn(`[ERPStockService] ${alertLevel} stock alert`, {
        productId,
        currentStock,
        alertLevel,
        threshold: isCritical ? STOCK_THRESHOLDS.CRITICAL_STOCK : STOCK_THRESHOLDS.LOW_STOCK
      })
      
      // Publish alert event for AI Warehouse Manager Agent
      await publishEvent({
        type: 'erp.stock.alert' as any,
        payload: {
          productId,
          currentStock,
          alertLevel,
          timestamp: new Date().toISOString(),
          suggestedAction: currentStock === 0 
            ? 'IMMEDIATE_REORDER' 
            : isCritical 
              ? 'URGENT_REORDER' 
              : 'SCHEDULE_REORDER'
        }
      })
    } catch (error) {
      logger.error('[ERPStockService] Error triggering low stock alert:', error)
    }
  },

  /**
   * Get stock summary for dashboard
   */
  async getStockSummary(): Promise<{
    totalProducts: number
    inStockProducts: number
    lowStockProducts: number
    criticalStockProducts: number
    outOfStockProducts: number
    totalStockValue: number
  }> {
    try {
      const result = await db().queryDocs<StoreProductRow>({
        collection: 'store_products',
        filters: [],
        pagination: { limit: 1000 }
      })
      
      if (!result.success || !result.data) {
        return {
          totalProducts: 0,
          inStockProducts: 0,
          lowStockProducts: 0,
          criticalStockProducts: 0,
          outOfStockProducts: 0,
          totalStockValue: 0
        }
      }

      const products = result.data
      
      let inStock = 0
      let lowStock = 0
      let criticalStock = 0
      let outOfStock = 0
      let totalValue = 0
      
      for (const product of products) {
        const stock = product.stock ?? 0
        const price = parseFloat(String(product.price)) || 0
        totalValue += stock * price
        
        if (stock <= 0) {
          outOfStock++
        } else if (stock <= STOCK_THRESHOLDS.CRITICAL_STOCK) {
          criticalStock++
        } else if (stock <= STOCK_THRESHOLDS.LOW_STOCK) {
          lowStock++
        } else {
          inStock++
        }
      }
      
      return {
        totalProducts: products.length,
        inStockProducts: inStock,
        lowStockProducts: lowStock,
        criticalStockProducts: criticalStock,
        outOfStockProducts: outOfStock,
        totalStockValue: totalValue
      }
    } catch (error) {
      logger.error('[ERPStockService] Error getting stock summary:', error)
      return {
        totalProducts: 0,
        inStockProducts: 0,
        lowStockProducts: 0,
        criticalStockProducts: 0,
        outOfStockProducts: 0,
        totalStockValue: 0
      }
    }
  },

  async getRecentStockMovements(limit: number = 25): Promise<StockMovement[]> {
    try {
      const result = await db().queryDocs<StockMovement & Record<string, unknown>>({
        collection: STORE_COLLECTIONS.stockMovements,
        orderBy: [{ field: 'timestamp', direction: 'desc' }],
        pagination: { limit: Math.min(limit, 100) },
      })

      if (!result.success || !result.data) {
        return []
      }

      return result.data as StockMovement[]
    } catch (error) {
      logger.error('[ERPStockService] Error getting recent movements:', error)
      return []
    }
  },

  async listProductsForVendor(vendorEntityId: string): Promise<StoreProduct[]> {
    try {
      const result = await db().queryDocs<StoreProductRow>({
        collection: 'store_products',
        filters: [{ field: 'productOwner', operator: '=', value: vendorEntityId }],
        orderBy: [{ field: 'name', direction: 'asc' }],
        pagination: { limit: 200 },
      })

      if (!result.success || !result.data) {
        return []
      }

      return result.data as StoreProduct[]
    } catch (error) {
      logger.error('[ERPStockService] Error listing vendor products:', error)
      return []
    }
  },
}

export default ERPStockService
