import { connection } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { normalizeNovaPostQuery, novaPostApiKey, searchNovaPostSettlements } from '@/lib/shipping/nova-post'

export async function GET(req: NextRequest) {
  await connection()
  const apiKey = novaPostApiKey()
  if (!apiKey) return NextResponse.json({ enabled: false, cities: [] })

  const q = normalizeNovaPostQuery(req.nextUrl.searchParams.get('q'))
  if (!q) return NextResponse.json({ enabled: true, cities: [] })

  try {
    const cities = await searchNovaPostSettlements(apiKey, q)
    return NextResponse.json({ enabled: true, cities })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to search cities'
    return NextResponse.json({ enabled: true, cities: [], error: message }, { status: 502 })
  }
}
