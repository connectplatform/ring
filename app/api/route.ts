import { NextResponse } from 'next/server'

/**
 * Root API route handler - returns API status/health check
 * Located at /api - no dynamic segments available here
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    name: 'Ring Platform API',
    version: '1.50',
    timestamp: new Date().toISOString(),
  })
}
