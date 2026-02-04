import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Return empty list in dev; replace with real data later
  return NextResponse.json({ entities: [] })
}

// Allow caching for featured entities with moderate revalidation for curated content
export const dynamic = 'auto'
export const revalidate = 300 // 5 minutes for featured content


