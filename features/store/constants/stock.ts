/** Client-safe stock thresholds and warehouse ids (no database imports). */

/** Movement / UI label for the default warehouse (not a Nova Poshta point). */
export const ZERO_WAREHOUSE_ID = 'zero-warehouse'
export const DEFAULT_WAREHOUSE_NAME = 'GreenFood Main Warehouse'

/**
 * SSOT store id for `inventory_levels` / `inventory_reservations` row keys
 * (`${productId}_${storeId}`). Maps 1:1 to {@link ZERO_WAREHOUSE_ID} in UI.
 */
export const DEFAULT_INVENTORY_STORE_ID = '1'

/** Order-hold TTL (checkout / unpaid order). */
export const ORDER_RESERVATION_MINUTES = 15

/** Cart soft-hold TTL — shorter than order holds (Wave 1). Authenticated carts only. */
export const CART_SOFT_HOLD_MINUTES = 5

/** Reservation orderId prefix for cart soft-holds: `cart_${userId}`. */
export const CART_HOLD_ORDER_PREFIX = 'cart_'

export function cartHoldOrderId(userId: string): string {
  return `${CART_HOLD_ORDER_PREFIX}${userId}`
}

export function isCartHoldOrderId(orderId: string): boolean {
  return orderId.startsWith(CART_HOLD_ORDER_PREFIX)
}

export const STOCK_THRESHOLDS = {
  LOW_STOCK: 10,
  CRITICAL_STOCK: 5,
  OUT_OF_STOCK: 0,
  DEFAULT_REORDER_POINT: 15,
} as const

/** Physical stock is not reserved/deducted for digital / preorder / instant-delivery lines. */
export function shouldSkipPhysicalStock(item: {
  isPreorder?: boolean
  product?: { digitalProduct?: boolean; instantDelivery?: boolean } | null
}): boolean {
  return Boolean(
    item.isPreorder ||
      item.product?.digitalProduct ||
      item.product?.instantDelivery,
  )
}
