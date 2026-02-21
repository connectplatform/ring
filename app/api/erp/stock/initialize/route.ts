/**
 * AI-ERP Stock Initialization API
 * 
 * POST /api/erp/stock/initialize
 * 
 * Initializes stock levels for all products in the warehouse.
 * Requires admin authentication in production.
 * 
 * @author Legion Commander - AI-ERP Warehouse Manager
 * @date 2025-12-08
 */

import { NextRequest, NextResponse, connection} from 'next/server'
import { auth } from '@/auth'
import { logger } from '@/lib/logger'
import { ERPStockService, ZERO_WAREHOUSE_ID, DEFAULT_WAREHOUSE_NAME } from '@/features/store/services/erp-stock-service'
import { UserRole } from '@/features/auth/types'

export async function POST(request: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    // Check authentication
    const session = await auth()
    
    // In production, require admin role
    const isAdmin = session?.user?.role === UserRole.ADMIN || session?.user?.role === UserRole.SUPERADMIN
    const isDev = process.env.NODE_ENV === 'development'
    
    if (!isDev && !isAdmin) {
      logger.warn('[ERP Stock Init] Unauthorized access attempt', {
        userId: session?.user?.id
      })
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }
    
    // Parse request body
    const body = await request.json().catch(() => ({}))
    const quantity = body.quantity || 100
    const warehouseId = body.warehouseId || ZERO_WAREHOUSE_ID
    
    logger.info('[ERP Stock Init] Starting stock initialization', {
      quantity,
      warehouseId,
      userId: session?.user?.id
    })
    
    // Initialize stock
    const result = await ERPStockService.addInitialStockToAllProducts(quantity, warehouseId)
    
    // Get updated summary
    const summary = await ERPStockService.getStockSummary()
    
    logger.info('[ERP Stock Init] Stock initialization completed', {
      success: result.success,
      totalProducts: result.totalProducts,
      successfulUpdates: result.successfulUpdates,
      failedUpdates: result.failedUpdates
    })
    
    return NextResponse.json({
      success: result.success,
      message: result.success 
        ? `Successfully initialized ${result.successfulUpdates} products with ${quantity} units each`
        : `Completed with ${result.failedUpdates} errors`,
      result,
      summary,
      warehouse: {
        id: warehouseId,
        name: DEFAULT_WAREHOUSE_NAME
      }
    })
    
  } catch (error) {
    logger.error('[ERP Stock Init] Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to initialize stock',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  await connection() // Next.js 16: opt out of prerendering

  try {
    // Get stock summary
    const summary = await ERPStockService.getStockSummary()
    
    // Get low stock products
    const lowStockProducts = await ERPStockService.getLowStockProducts()
    
    return NextResponse.json({
      status: 'active',
      service: 'AI-ERP Stock Management',
      warehouse: {
        id: ZERO_WAREHOUSE_ID,
        name: DEFAULT_WAREHOUSE_NAME
      },
      summary,
      lowStockAlerts: lowStockProducts.length,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    logger.error('[ERP Stock Init] Error getting summary:', error)
    return NextResponse.json(
      { error: 'Failed to get stock summary' },
      { status: 500 }
    )
  }
}

