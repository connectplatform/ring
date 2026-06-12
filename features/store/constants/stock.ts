/** Client-safe stock thresholds and warehouse ids (no database imports). */

export const ZERO_WAREHOUSE_ID = 'zero-warehouse'
export const DEFAULT_WAREHOUSE_NAME = 'GreenFood Main Warehouse'

export const STOCK_THRESHOLDS = {
  LOW_STOCK: 10,
  CRITICAL_STOCK: 5,
  OUT_OF_STOCK: 0,
  DEFAULT_REORDER_POINT: 15,
} as const
