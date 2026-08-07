'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import VendorProductCard from '@/components/vendor/vendor-product-card'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import type { StoreProduct } from '@/features/store/types'
import { resolveApprovalStatus } from '@/features/store/lib/product-document'

interface VendorProductsListProps {
  locale: Locale
  vendorEntityId: string
  initialProducts: StoreProduct[]
}

export default function VendorProductsList({
  locale,
  vendorEntityId,
  initialProducts,
}: VendorProductsListProps) {
  const t = useTranslations('vendor.products')
  const tFilters = useTranslations('vendor.products.filters')
  const router = useRouter()

  const [products] = useState<StoreProduct[]>(initialProducts)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')

  const filteredProducts = useMemo(
    () =>
      products
        .filter((product) => {
          if (searchQuery && !product.name.toLowerCase().includes(searchQuery.toLowerCase())) {
            return false
          }
          const approval = resolveApprovalStatus(product as unknown as Record<string, unknown>)
          if (statusFilter !== 'all') {
            if (statusFilter === 'active' && product.status !== 'active') return false
            if (statusFilter === 'inactive' && product.status !== 'inactive') return false
            if (statusFilter === 'pending' && approval !== 'pending') return false
            if (statusFilter === 'approved' && approval !== 'approved') return false
            if (statusFilter === 'rejected' && approval !== 'rejected') return false
          }
          return true
        })
        .sort((a, b) => {
          switch (sortBy) {
            case 'newest':
              return (
                new Date(String((b as unknown as Record<string, unknown>).createdAt ?? 0)).getTime() -
                new Date(String((a as unknown as Record<string, unknown>).createdAt ?? 0)).getTime()
              )
            case 'oldest':
              return (
                new Date(String((a as unknown as Record<string, unknown>).createdAt ?? 0)).getTime() -
                new Date(String((b as unknown as Record<string, unknown>).createdAt ?? 0)).getTime()
              )
            case 'priceAsc':
              return parseFloat(a.price) - parseFloat(b.price)
            case 'priceDesc':
              return parseFloat(b.price) - parseFloat(a.price)
            case 'nameAsc':
              return a.name.localeCompare(b.name)
            case 'nameDesc':
              return b.name.localeCompare(a.name)
            default:
              return 0
          }
        }),
    [products, searchQuery, statusFilter, sortBy],
  )

  const handleProductUpdated = () => {
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('totalProducts', { count: products.length })}
          </p>
        </div>

        <Link href={ROUTES.VENDOR_PRODUCTS_ADD(locale)}>
          <Button className="bg-gradient-to-r from-emerald-600 to-lime-600 hover:from-emerald-700 hover:to-lime-700">
            <Plus className="w-4 h-4 mr-2" />
            {t('addProduct')}
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={tFilters('search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

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

      {filteredProducts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
              <Plus className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('noProducts')}</h3>
            <p className="text-muted-foreground mb-6">{t('addFirstProduct')}</p>
            <Link href={ROUTES.VENDOR_PRODUCTS_ADD(locale)}>
              <Button className="bg-gradient-to-r from-emerald-600 to-lime-600">
                <Plus className="w-4 h-4 mr-2" />
                {t('addProduct')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <VendorProductCard
              key={product.id}
              product={product as any}
              onProductUpdated={handleProductUpdated}
            />
          ))}
        </div>
      )}
    </div>
  )
}
