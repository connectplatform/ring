import { NextResponse, connection} from 'next/server'
import { getStoreAdapter } from '@/features/store/config'
import { auth } from '@/auth'
import { UserRole } from '@/features/auth/types'
import { getVendorByUserId } from '@/features/store/services/get-vendor-by-user'

export async function POST(request: Request) {
  await connection() // Next.js 16: opt out of prerendering

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
  await connection() // Next.js 16: opt out of prerendering

  try {
    const url = new URL(request.url)
    
    // Parse query parameters - NEW FORMAT (supports filters!)
    const search = (url.searchParams.get('search') || '').toLowerCase()
    const categoriesParam = url.searchParams.get('categories') || ''
    const categories = categoriesParam ? categoriesParam.split(',') : []
    const priceMin = parseFloat(url.searchParams.get('priceMin') || '0')
    const priceMax = parseFloat(url.searchParams.get('priceMax') || '999999')
    const inStockParam = url.searchParams.get('inStock')
    const inStock = inStockParam === 'true' ? true : inStockParam === 'false' ? false : null
    const sortBy = url.searchParams.get('sortBy') || 'name-asc' // Format: "name-asc", "price-desc", etc
    const currency = (url.searchParams.get('currency') || '') as '' | 'DAAR' | 'DAARION'
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '24', 10) || 24, 1), 100)
    const afterId = url.searchParams.get('afterId') || ''

    console.log('🔍 Store API: Filters received:', {
      search,
      categories,
      priceMin,
      priceMax,
      inStock,
      sortBy,
      currency,
      limit,
      afterId
    })

    const adapter = await getStoreAdapter()
    let allProducts = await adapter.listProducts()
    const totalProducts = allProducts.length // Total count BEFORE filters

    console.log(`📊 Total products in DB: ${totalProducts}`)

    // Apply filters
    let filteredProducts = allProducts

    // Filter by search
    if (search) {
      filteredProducts = filteredProducts.filter(p => 
        p.name.toLowerCase().includes(search) || 
        (p.description || '').toLowerCase().includes(search)
      )
    }

    // Filter by categories
    if (categories.length > 0) {
      filteredProducts = filteredProducts.filter(p => 
        p.category && categories.includes(p.category)
      )
    }

    // Filter by price range
    filteredProducts = filteredProducts.filter(p => {
      const price = parseFloat(p.price || '0')
      return price >= priceMin && price <= priceMax
    })

    // Filter by stock availability
    if (inStock !== null) {
      filteredProducts = filteredProducts.filter(p => p.inStock === inStock)
    }

    // Filter by currency (if specified)
    if (currency) {
      filteredProducts = filteredProducts.filter(p => p.currency === currency)
    }

    const filteredCount = filteredProducts.length // Count AFTER filters
    console.log(`📊 Filtered products: ${filteredCount}`)

    // Parse sortBy (format: "name-asc", "price-desc", etc)
    const [sortKey, sortDir] = sortBy.split('-') as [string, 'asc' | 'desc']
    
    // Sort products
    filteredProducts = [...filteredProducts].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'name') {
        return a.name.localeCompare(b.name) * dir
      }
      if (sortKey === 'price') {
        const pa = parseFloat(a.price || '0')
        const pb = parseFloat(b.price || '0')
        return (pa - pb) * dir
      }
      return 0
    })

    // Pagination
    let startIndex = 0
    if (afterId) {
      const idx = filteredProducts.findIndex(p => p.id === afterId)
      startIndex = idx >= 0 ? idx + 1 : 0
    }
    const slice = filteredProducts.slice(startIndex, startIndex + limit)
    const lastVisible = slice.length > 0 ? slice[slice.length - 1].id : null

    console.log(`📦 Returning ${slice.length} products (page), total: ${totalProducts}, filtered: ${filteredCount}`)

    // FIXED: Return correct format with 'total' and 'filteredTotal'
    return NextResponse.json({ 
      items: slice, 
      lastVisible,
      total: totalProducts, // Total in DB (before filters)
      filteredTotal: filteredCount // Count after filters applied
    })
  } catch (e: any) {
    console.error('❌ Store API error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to fetch' }, { status: 500 })
  }
}
