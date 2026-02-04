'use client'

/**
 * Vendor Products List - Client Component
 * 
 * Displays vendor's products in a 3-column grid with:
 * - Filter by status (all/active/inactive/pending/approved/rejected)
 * - Search by product name
 * - Sort by date, price, stock
 * - Product cards with approval status badges
 * - Empty state for first-time vendors
 * 
 * Tech: React 19 + useOptimistic for instant updates
 */

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Plus, Search, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import VendorProductCard from '@/components/vendor/vendor-product-card'
import { ROUTES } from '@/constants/routes'
import { getDatabaseService, initializeDatabase } from '@/lib/database/DatabaseService'
import type { Locale } from '@/i18n-config'

interface VendorProductsListProps {
  locale: string
  vendorEntityId: string
}

export default function VendorProductsList({ locale, vendorEntityId }: VendorProductsListProps) {
  const t = useTranslations('vendor.products')
  const tFilters = useTranslations('vendor.products.filters')
  
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')

  // Load vendor products
  useEffect(() => {
    async function loadProducts() {
      try {
        setLoading(true)
        
        // Fetch products via API endpoint
        const response = await fetch(`/api/vendor/products?entity_id=${vendorEntityId}`)
        if (response.ok) {
          const data = await response.json()
          setProducts(data.products || [])
        }
      } catch (error) {
        console.error('Error loading products:', error)
      } finally {
        setLoading(false)
      }
    }

    loadProducts()
  }, [vendorEntityId])

  // Filter and sort products
  const filteredProducts = products
    .filter(product => {
      // Search filter
      if (searchQuery && !product.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }
      
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'active' && product.status !== 'active') return false
        if (statusFilter === 'inactive' && product.status !== 'inactive') return false
        if (statusFilter === 'pending' && product.data?.approvalStatus !== 'pending') return false
        if (statusFilter === 'approved' && product.data?.approvalStatus !== 'approved') return false
        if (statusFilter === 'rejected' && product.data?.approvalStatus !== 'rejected') return false
      }
      
      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'priceAsc':
          return a.price - b.price
        case 'priceDesc':
          return b.price - a.price
        case 'nameAsc':
          return a.name.localeCompare(b.name)
        case 'nameDesc':
          return b.name.localeCompare(a.name)
        default:
          return 0
      }
    })

  const handleProductUpdated = () => {
    // Reload products after update
    setLoading(true)
    setTimeout(() => window.location.reload(), 500)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('totalProducts', { count: products.length })}
          </p>
        </div>
        
        <Link href={ROUTES.VENDOR_PRODUCTS_ADD(locale as Locale)}>
          <Button className="bg-gradient-to-r from-emerald-600 to-lime-600 hover:from-emerald-700 hover:to-lime-700">
            <Plus className="w-4 h-4 mr-2" />
            {t('addProduct')}
          </Button>
        </Link>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={tFilters('search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder={tFilters('all')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tFilters('all')}</SelectItem>
                <SelectItem value="active">{tFilters('active')}</SelectItem>
                <SelectItem value="inactive">{tFilters('inactive')}</SelectItem>
                <SelectItem value="pending">{tFilters('pendingApproval')}</SelectItem>
                <SelectItem value="approved">{tFilters('approved')}</SelectItem>
                <SelectItem value="rejected">{tFilters('rejected')}</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder={tFilters('sortBy')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">{tFilters('sortNewest')}</SelectItem>
                <SelectItem value="oldest">{tFilters('sortOldest')}</SelectItem>
                <SelectItem value="priceAsc">{tFilters('sortPriceAsc')}</SelectItem>
                <SelectItem value="priceDesc">{tFilters('sortPriceDesc')}</SelectItem>
                <SelectItem value="nameAsc">{tFilters('sortNameAsc')}</SelectItem>
                <SelectItem value="nameDesc">{tFilters('sortNameDesc')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Products Grid or Empty State */}
      {filteredProducts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
              <Plus className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('noProducts')}</h3>
            <p className="text-muted-foreground mb-6">{t('addFirstProduct')}</p>
            <Link href={ROUTES.VENDOR_PRODUCTS_ADD(locale as Locale)}>
              <Button className="bg-gradient-to-r from-emerald-600 to-lime-600">
                <Plus className="w-4 h-4 mr-2" />
                {t('addProduct')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map(product => (
            <VendorProductCard 
              key={product.id} 
              product={product}
              onProductUpdated={handleProductUpdated}
            />
          ))}
        </div>
      )}
    </div>
  )
}

