import { connection } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  normalizeNovaPostQuery,
  novaPostApiKey,
  searchNovaPostDivisions,
} from '@/lib/shipping/nova-post'

export async function GET(req: NextRequest) {
  await connection()
  const apiKey = novaPostApiKey()
  if (!apiKey) return NextResponse.json({ enabled: false, warehouses: [] })

  const cityRef = (req.nextUrl.searchParams.get('cityRef') || '').trim()
  if (!cityRef) return NextResponse.json({ enabled: true, warehouses: [] })

  const q = normalizeNovaPostQuery(req.nextUrl.searchParams.get('q'))

  try {
    const warehouses = await searchNovaPostDivisions(apiKey, cityRef, q)
    return NextResponse.json({ enabled: true, warehouses })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to search branches'
    return NextResponse.json({ enabled: true, warehouses: [], error: message }, { status: 502 })
  }
}
