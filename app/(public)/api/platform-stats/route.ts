import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Return stubbed stats in dev
  // TODO: Implement platform stats API
  return NextResponse.json({
    users: 0,
    entities: 0,
    opportunities: 0,
  })
}

// Allow caching for platform statistics with moderate revalidation for analytics data


