import { NextRequest, NextResponse } from 'next/server'
import { FirebaseStoreAdapter } from '@/lib/services/firebase-service-manager'
import { MockStoreAdapter } from '@/features/store/mock-adapter'
import { getStoreAdapterName } from '@/features/store/config'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { items, info } = body || {}
    if (!items || !Array.isArray(items) || !info) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    const adapterName = getStoreAdapterName()
    const adapter = adapterName === 'firebase' ? new FirebaseStoreAdapter() : new MockStoreAdapter()
    const result = await adapter.checkout(items, info)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Checkout failed' }, { status: 500 })
  }
}


