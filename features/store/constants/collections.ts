/** PostgreSQL table names for store/ERP collections (adapter uses collection === table). */
export const STORE_COLLECTIONS = {
  vendorProfiles: 'vendor_profiles',
  merchantConfigs: 'merchant_configs',
  settlements: 'settlements',
  payoutBatches: 'payout_batches',
  vendorSettlements: 'vendor_settlements',
  stockMovements: 'stock_movements',
  erpSalesAssists: 'erp_sales_assists',
  orders: 'orders',
  storeProducts: 'store_products',
} as const
