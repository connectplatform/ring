import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Return empty list in dev; replace with real data later
  return NextResponse.json({ entities: [] })
}

export const dynamic = 'force-dynamic'


