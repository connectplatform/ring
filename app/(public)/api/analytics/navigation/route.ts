import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  return NextResponse.json({ ok: true })
}

export const dynamic = 'force-dynamic'


