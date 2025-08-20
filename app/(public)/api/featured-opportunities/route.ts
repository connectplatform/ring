import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    // TODO: Implement featured opportunities API
  return NextResponse.json({ opportunities: [] })
}

export const dynamic = 'force-dynamic'


