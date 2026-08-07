/**
 * AI-ERP Stock Initialization API
 * 
 * POST /api/erp/stock/initialize
 * 
 * Initializes stock levels for all products in the warehouse.
 * Requires admin authentication in production.
 * 
 * @author Legiox Commander - AI-ERP Warehouse Manager
 * @date 2025-12-08
 */

import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { logger } from '@/lib/logger'
import { ERPStockService, ZERO_WAREHOUSE_ID, DEFAULT_WAREHOUSE_NAME } from '@/features/store/services/erp-stock-service'
import { isPlatformAdmin } from '@/features/auth/user-role'

export async function POST(request: NextRequest) {
  // Ensures use of a persistent database connection and disables prerendering.
  await connection() // Next.js 16: opt out of prerendering

  try {
    // Obtain the current user session (authentication)
    const session = await auth()
    
    // Determine if the user is an admin and if the environment is development
    const isAdmin = isPlatformAdmin(session?.user?.role)
    const isDev = process.env.NODE_ENV === 'development'
    
    // In non-development environments, require that the caller is an admin
    if (!isDev && !isAdmin) {
      logger.warn('[ERP Stock Init] Unauthorized access attempt', {
        userId: session?.user?.id
      })
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    // Parse request body, safely handling invalid JSON
    // TODO: Validate schema of request body using e.g. Zod for stricter input handling
    const body = await request.json().catch(() => ({}))

    // Extract quantity and warehouseId, setting defaults if not present
    const quantity = body.quantity || 100
    const warehouseId = body.warehouseId || ZERO_WAREHOUSE_ID
    
    // Log the beginning of the stock initialization process
    logger.info('[ERP Stock Init] Starting stock initialization', {
      quantity,
      warehouseId,
      userId: session?.user?.id
    })
    
    // Call service to initialize stock levels for all products
    // TODO: Consider triggering this as a background job if product count is very large
    const result = await ERPStockService.addInitialStockToAllProducts(quantity, warehouseId)
    
    // Retrieve the latest stock summary after initialization
    const summary = await ERPStockService.getStockSummary()
    
    // Log completion of the initialization
    logger.info('[ERP Stock Init] Stock initialization completed', {
      success: result.success,
      totalProducts: result.totalProducts,
      successfulUpdates: result.successfulUpdates,
      failedUpdates: result.failedUpdates
    })
    
    // Respond with details about the operation, updated summary, and warehouse info
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
    // Log and report server/internal errors
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
  // Ensure persistent connection to database; disables prerendering in Next.js 16.
  await connection() // Next.js 16: opt out of prerendering

  try {
    // Fetch an overall summary of all stock in the system
    const summary = await ERPStockService.getStockSummary()
    
    // Retrieve which products are currently low in stock
    const lowStockProducts = await ERPStockService.getLowStockProducts()
    
    // Respond with the current service status, warehouse info, stock summary, and low-stock count
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
    // Log and report any errors encountered retrieving the summary
    logger.error('[ERP Stock Init] Error getting summary:', error)
    return NextResponse.json(
      { error: 'Failed to get stock summary' },
      { status: 500 }
    )
  }
}
