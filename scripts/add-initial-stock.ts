#!/usr/bin/env npx ts-node
/**
 * Add Initial Stock to All Products
 * 
 * This script populates the zero-warehouse (main warehouse) with initial stock
 * for all products in the GreenFood.live store.
 * 
 * Usage:
 *   npx ts-node scripts/add-initial-stock.ts [quantity]
 * 
 * Example:
 *   npx ts-node scripts/add-initial-stock.ts 100
 *   npx ts-node scripts/add-initial-stock.ts      # Default: 100 units
 * 
 * @author Legiox Commander - AI-ERP Stock Management
 * @date 2025-12-08
 */

import { ERPStockService, ZERO_WAREHOUSE_ID, DEFAULT_WAREHOUSE_NAME } from '@/features/store/services/erp-stock-service'

async function main() {
  const quantity = parseInt(process.argv[2]) || 100
  
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║     🏭 AI-ERP Initial Stock Population                       ║')
  console.log('║     Warehouse Manager AI Agent - GreenFood.live              ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log('')
  console.log(`📦 Warehouse: ${DEFAULT_WAREHOUSE_NAME} (${ZERO_WAREHOUSE_ID})`)
  console.log(`📊 Quantity per product: ${quantity} units`)
  console.log('')
  console.log('Starting stock population...')
  console.log('')

  const startTime = Date.now()
  
  try {
    const result = await ERPStockService.addInitialStockToAllProducts(quantity, ZERO_WAREHOUSE_ID)
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    
    console.log('')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('                      📊 RESULTS                               ')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('')
    console.log(`Total Products:      ${result.totalProducts}`)
    console.log(`Successful Updates:  ${result.successfulUpdates} ✅`)
    console.log(`Failed Updates:      ${result.failedUpdates} ${result.failedUpdates > 0 ? '❌' : ''}`)
    console.log(`Duration:            ${duration}s`)
    console.log('')
    
    if (result.errors.length > 0) {
      console.log('❌ Errors:')
      result.errors.forEach(err => {
        console.log(`   - Product ${err.productId}: ${err.error}`)
      })
      console.log('')
    }
    
    if (result.success) {
      console.log('✅ Initial stock population completed successfully!')
      console.log('')
      console.log('🎯 Next steps:')
      console.log('   1. Test checkout flow with WayForPay')
      console.log('   2. Verify stock deduction after successful purchase')
      console.log('   3. Check low stock alerts in AI-ERP dashboard')
    } else {
      console.log('⚠️  Stock population completed with some errors.')
      console.log('   Please review the errors above and retry failed products.')
    }
    
    console.log('')
    console.log('═══════════════════════════════════════════════════════════════')
    
    // Get and display stock summary
    const summary = await ERPStockService.getStockSummary()
    console.log('')
    console.log('📈 Current Stock Summary:')
    console.log(`   Total Products:     ${summary.totalProducts}`)
    console.log(`   In Stock:           ${summary.inStockProducts} ✅`)
    console.log(`   Low Stock:          ${summary.lowStockProducts} ⚠️`)
    console.log(`   Critical Stock:     ${summary.criticalStockProducts} 🔴`)
    console.log(`   Out of Stock:       ${summary.outOfStockProducts} ❌`)
    console.log(`   Total Stock Value:  ₴${summary.totalStockValue.toLocaleString()}`)
    console.log('')
    
    process.exit(result.success ? 0 : 1)
  } catch (error) {
    console.error('')
    console.error('❌ Fatal error during stock population:')
    console.error(error)
    process.exit(1)
  }
}

main()

