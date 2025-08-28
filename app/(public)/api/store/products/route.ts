import { NextResponse } from 'next/server'
import { getStoreAdapterName } from '@/features/store/config'
import { MockStoreAdapter } from '@/features/store/mock-adapter'
import { FirebaseStoreAdapter } from '@/lib/services/firebase-service-manager'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const search = (url.searchParams.get('search') || '').toLowerCase()
    const currency = (url.searchParams.get('currency') || '') as '' | 'DAAR' | 'DAARION'
    const sortKey = (url.searchParams.get('sortKey') || 'name') as 'name' | 'price'
    const sortDir = (url.searchParams.get('sortDir') || 'asc') as 'asc' | 'desc'
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 1), 100)
    const afterId = url.searchParams.get('afterId') || ''

    const adapterName = getStoreAdapterName()
    const adapter = adapterName === 'firebase' ? new FirebaseStoreAdapter() : new MockStoreAdapter()
    let products = await adapter.listProducts()

    if (search) {
      products = products.filter(p => p.name.toLowerCase().includes(search) || (p.description || '').toLowerCase().includes(search))
    }
    if (currency) {
      products = products.filter(p => p.currency === currency)
    }
    products = [...products].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'name') return a.name.localeCompare(b.name) * dir
      const pa = parseFloat(a.price || '0'), pb = parseFloat(b.price || '0')
      return (pa - pb) * dir
    })

    let startIndex = 0
    if (afterId) {
      const idx = products.findIndex(p => p.id === afterId)
      startIndex = idx >= 0 ? idx + 1 : 0
    }
    const slice = products.slice(startIndex, startIndex + limit)
    const lastVisible = slice.length > 0 ? slice[slice.length - 1].id : null

    return NextResponse.json({ items: slice, lastVisible, totalCount: products.length })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch' }, { status: 500 })
  }
}


