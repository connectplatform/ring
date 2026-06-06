import { NextRequest, NextResponse } from 'next/server'
import { getStoreAdapter } from '@/features/store/config'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { items, info } = body || {}
    if (!items || !Array.isArray(items) || !info) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    const adapter = await getStoreAdapter()
    const result = await adapter.checkout(items, info)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Checkout failed' }, { status: 500 })
  }
}


