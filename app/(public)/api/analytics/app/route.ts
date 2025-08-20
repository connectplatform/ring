import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // Accept and discard payload in dev; stub for production analytics
  // TODO: Implement app analytics API
  return NextResponse.json({ ok: true })
}

export const dynamic = 'force-dynamic'


