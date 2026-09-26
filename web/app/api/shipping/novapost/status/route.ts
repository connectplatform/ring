import { connection } from 'next/server'
import { NextResponse } from 'next/server'
import { isNovaPostEnabled } from '@/lib/shipping/nova-post'

/** Public gate. Does not reveal whether a key is configured beyond enabled/disabled. */
export async function GET() {
  await connection()
  return NextResponse.json({ enabled: isNovaPostEnabled() })
}
