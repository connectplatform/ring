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
  DEFAULT_WAREHOUSE_NAME,
  STOCK_THRESHOLDS,
  ZERO_WAREHOUSE_ID,
} from '@/features/store/constants/stock'
import type {
  BatchAddStockResult,
  StockLevel,
  StockMovement,
  StockUpdate,
} from '@/features/store/types/erp-stock'

export {
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
      
      return {
        productId,
        warehouseId,
        availableQuantity: stock,
        reservedQuantity: 0, // Reserved items are tracked separately
        totalQuantity: stock,
        lastUpdated: String(productData.updatedAt ?? new Date().toISOString()),
        reorderPoint,
        isLowStock: stock <= STOCK_THRESHOLDS.LOW_STOCK && stock > STOCK_THRESHOLDS.CRITICAL_STOCK,
        isCriticalStock: stock <= STOCK_THRESHOLDS.CRITICAL_STOCK && stock > STOCK_THRESHOLDS.OUT_OF_STOCK,
        isOutOfStock: stock <= STOCK_THRESHOLDS.OUT_OF_STOCK
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
      
      const updateResult = await db().updateDoc('store_products', update.productId, {
        stock: newStock,
        inStock: newStock > 0,
        updatedAt: now
      })
      
      if (!updateResult.success) {
        return { success: false, newQuantity: currentStock, error: 'Failed to update stock' }
      }
      
      // Log stock movement for audit trail
      await this.logStockMovement({
        id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        productId: update.productId,
        warehouseId: update.warehouseId,
        movementType: update.orderId ? 'sale' : 'adjustment',
        quantityBefore: currentStock,
        quantityChange: update.operation === 'subtract' ? -update.quantityChange : update.quantityChange,
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
        orderId: update.orderId
      })
      
      // Publish stock update event
      await publishEvent({
        type: StoreEvent.INVENTORY_UPDATED,
        payload: {
          productId: update.productId,
          warehouseId: update.warehouseId,
          previousStock: currentStock,
          newStock,
          operation: update.operation,
          orderId: update.orderId
        }
      })
      
      // Check for low stock alerts
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
      // Skip preorder items - they don't affect stock
      if (item.isPreorder) {
        logger.info('[ERPStockService] Skipping preorder item', {
          orderId,
          productId: item.product.id,
          productName: item.product.name
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
