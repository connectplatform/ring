/**
 * Analytics Errors API Endpoint
 * Logs client-side errors to PostgreSQL for monitoring and debugging
 * Used by error boundaries and global error handlers
 */

import { NextRequest, NextResponse, connection} from 'next/server'
import { auth } from '@/auth'
import { getDatabaseService } from '@/lib/database'

const db = getDatabaseService()


interface ErrorLogPayload {
  message: string
  stack?: string
  component?: string
  url?: string
  userAgent?: string
  timestamp?: string
  severity?: 'error' | 'warning' | 'info'
  metadata?: Record<string, any>
}

/**
 * POST /api/analytics/errors
 * Log client-side error to database
 */
export async function POST(request: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    // Get session (optional - errors can be logged for anonymous users)
    const session = await auth().catch(() => null)

    // Parse error payload
    const payload: ErrorLogPayload = await request.json()

    // Validate required fields
    if (!payload.message) {
      return NextResponse.json(
        { success: false, error: 'Error message is required' },
        { status: 400 }
      )
    }

    // Prepare error document
    const errorDoc = {
      message: payload.message,
      stack: payload.stack || null,
      component: payload.component || 'unknown',
      url: payload.url || request.url,
      userAgent: payload.userAgent || request.headers.get('user-agent') || 'unknown',
      userId: session?.user?.id || null,
      userEmail: session?.user?.email || null,
      severity: payload.severity || 'error',
      metadata: payload.metadata || {},
      timestamp: payload.timestamp || new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      createdAt: new Date().toISOString()
    }

    // Log to database (analytics_errors collection)
    const result = await db.create('analytics_errors', errorDoc)

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[Analytics Error Logged]', {
        message: errorDoc.message,
        component: errorDoc.component,
        userId: errorDoc.userId
      })
    }

    return NextResponse.json({
      success: true,
      errorId: result.data?.id,
      message: 'Error logged successfully'
    })

  } catch (error) {
    // Fallback error logging to console if database fails
    console.error('[Analytics Errors API] Failed to log error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to log error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/analytics/errors
 * Retrieve error logs (admin only)
 */
export async function GET(request: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    // Require authentication
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check admin role
    const isAdmin = session.user.role === 'admin' || session.user.role === 'superadmin'
    
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const severity = searchParams.get('severity')
    const component = searchParams.get('component')

    // Build filters
    const filters: any[] = []
    if (severity) {
      filters.push({ field: 'severity', operator: '==', value: severity })
    }
    if (component) {
      filters.push({ field: 'component', operator: '==', value: component })
    }

    // Fetch errors from database
    const result = await db.query({
      collection: 'analytics_errors',
      filters,
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      pagination: { limit: Math.min(limit, 100) }
    })

    return NextResponse.json({
      success: true,
      errors: result.data || [],
      count: result.data?.length || 0
    })

  } catch (error) {
    console.error('[Analytics Errors API] Failed to fetch errors:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch errors',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

