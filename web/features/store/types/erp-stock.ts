/** ERP stock types — safe for client `import type` (no server dependencies). */

export interface StockUpdate {
  productId: string
  warehouseId: string
  quantityChange: number
  operation: 'add' | 'subtract' | 'set'
  reason: string
  orderId?: string
  userId?: string
  timestamp?: string
  referralCode?: string
  assisted?: boolean
}

export interface StockLevel {
  productId: string
  warehouseId: string
  availableQuantity: number
  reservedQuantity: number
  totalQuantity: number
  lastUpdated: string
  lastOrderId?: string
  reorderPoint: number
  isLowStock: boolean
  isCriticalStock: boolean
  isOutOfStock: boolean
}

export interface StockMovement {
  id: string
  productId: string
  warehouseId: string
  movementType: 'sale' | 'restock' | 'adjustment' | 'transfer' | 'return' | 'damaged'
  quantityBefore: number
  quantityChange: number
  quantityAfter: number
  orderId?: string
  userId?: string
  reason: string
  timestamp: string
  referralCode?: string
  assisted?: boolean
}

export interface BatchAddStockResult {
  success: boolean
  totalProducts: number
  successfulUpdates: number
  failedUpdates: number
  errors: Array<{ productId: string; error: string }>
}
