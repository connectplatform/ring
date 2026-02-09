/**
 * Cron Job: Cleanup Expired Username Reservations
 * 
 * Vercel Cron: Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/cleanup-usernames",
 *     "schedule": "every 5 minutes"
 *   }]
 * }
 * 
 * Or use external cron (GitHub Actions, etc) to hit this endpoint every 5 minutes
 * 
 * PROPAGATED FROM: ring-greenfood-live (2025-11-07)
 * FEATURE: Automatic cleanup of expired username reservations
 */

import { NextRequest, NextResponse } from 'next/server'
import { connection } from 'next/server'
import { cleanupExpiredUsernameReservations } from '@/app/_actions/users'


export async function GET(request: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering (uses request.headers)

  try {
    // Verify cron authorization (Vercel Cron secret or custom auth)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Execute cleanup
    const startTime = Date.now()
    const result = await cleanupExpiredUsernameReservations()
    const duration = Date.now() - startTime
    
    console.log(`Cron: Cleaned ${result.cleaned} expired username reservations in ${duration}ms`)
    
    return NextResponse.json({
      success: true,
      cleaned: result.cleaned,
      duration,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Cron: Username cleanup failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

