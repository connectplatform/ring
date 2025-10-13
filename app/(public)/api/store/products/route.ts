import { NextResponse } from 'next/server'
import { getStoreAdapter } from '@/features/store/config'
import { auth } from '@/auth'
import { UserRole } from '@/features/auth/types'
import { getVendorByUserId } from '@/features/store/services/get-vendor-by-user'

export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role
    let vendorId: string
    let vendorName: string

    // Admin/Superadmin: Use Ring Portal Store
    if (userRole === UserRole.ADMIN || userRole === UserRole.SUPERADMIN) {
      vendorId = 'vendor_ring_portal_store'
      vendorName = 'Ring Portal Store'
    } else {
      // Regular users: Check/create vendor profile
      const vendorLookup = await getVendorByUserId(session.user.id, session.user.email || undefined)

      if (!vendorLookup.found) {
        return NextResponse.json({ 
          error: 'Failed to retrieve or create vendor profile. Please try again.' 
        }, { status: 500 })
      }

      // Check if vendor is approved
      if (!vendorLookup.isApproved) {
        if (vendorLookup.isPending) {
          return NextResponse.json({ 
            error: 'Your vendor application is pending approval. Please complete the vendor onboarding process.',
            vendorStatus: 'pending',
            vendorId: vendorLookup.vendorId
          }, { status: 403 })
        } else {
          return NextResponse.json({ 
            error: 'Vendor access required. Please apply to become a verified vendor.',
            vendorStatus: 'not_applied'
          }, { status: 403 })
        }
      }

      vendorId = vendorLookup.vendorId!
      vendorName = vendorLookup.vendorName!
    }

    const productData = await request.json()

    // Validate required fields
    if (!productData.name || !productData.price) {
      return NextResponse.json({ error: 'Name and price are required' }, { status: 400 })
    }

    const adapter = await getStoreAdapter()
    const product = await adapter.createProduct({
      ...productData,
      vendorId,
      vendorName
    })

    return NextResponse.json(product, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to create product' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const search = (url.searchParams.get('search') || '').toLowerCase()
    const currency = (url.searchParams.get('currency') || '') as '' | 'DAAR' | 'DAARION'
    const sortKey = (url.searchParams.get('sortKey') || 'name') as 'name' | 'price'
    const sortDir = (url.searchParams.get('sortDir') || 'asc') as 'asc' | 'desc'
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 1), 100)
    const afterId = url.searchParams.get('afterId') || ''

    const adapter = await getStoreAdapter()
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


