import { NextResponse } from 'next/server'
import { version } from '../../package.json'
import { clone } from '@/ring-config.json'

/**
 * Root API route handler - returns API status/health check
 * Located at /api - no dynamic segments available here
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    name: clone.displayName,
    version: version,
    timestamp: new Date().toISOString(),
  })
}
