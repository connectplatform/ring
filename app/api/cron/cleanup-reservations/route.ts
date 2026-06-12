/**
 * Cron: release expired inventory reservations (inventory_reservations TTL).
 * Schedule every 5–15 minutes. Fail-closed: requires CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { connection } from 'next/server'
import { cleanupExpiredReservations } from '@/features/store/services/inventory-sync'

export async function GET(request: NextRequest) {
  await connection()

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const startTime = Date.now()
    await cleanupExpiredReservations()
    return NextResponse.json({
      success: true,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Cron: reservation cleanup failed:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
