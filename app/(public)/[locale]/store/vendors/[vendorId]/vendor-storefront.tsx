'use client'

/**
 * Vendor Storefront - Public Page
 * 
 * Customer-facing vendor store with vendor branding and products.
 * 
 * Features:
 * - Vendor header (cover photo, avatar, name, trust badge, rating, sales)
 * - Tabs (Products, About, Reviews, Contact)
 * - Products grid (vendor's active products)
 * - Vendor branding colors
 * - "Powered by GreenFood.live" footer
 * 
 * Tech: React 19 + Agricultural theme
 */

import React, { useState, useTransition, useCallback } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { 
  Store, 
  MapPin, 
  Star, 
  TrendingUp, 
  Calendar, 
  Award, 
  Clock,
  Heart,
  MessageCircle 
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface VendorStorefrontProps {
  locale: string
  vendorEntity: any
  products: any[]
}

export default function VendorStorefront({ locale, vendorEntity, products }: VendorStorefrontProps) {
  const t = useTranslations('vendor.storefront')

  // React 19 useTransition for non-blocking tab changes
  const [isPending, startTransition] = useTransition()

  const [activeTab, setActiveTab] = useState('products')

  const vendorName = vendorEntity.name || 'Vendor Store'
  const vendorDescription = vendorEntity.description || ''
  const vendorLogo = vendorEntity.storeLogo || '/placeholder-vendor.jpg'
  const vendorTier = vendorEntity.vendorTier || 'NEW'
  const vendorRating = vendorEntity.vendorRating || 0
  const vendorSales = vendorEntity.vendorTotalSales || 0
  const memberSince = new Date(vendorEntity.createdAt || Date.now()).getFullYear()
  const categories = vendorEntity.storeCategories || []

  // Trust tier badge colors
  const tierColors = {
    NEW: 'bg-amber-500/20 text-amber-700 border-amber-500/30',
    BRONZE: 'bg-orange-500/20 text-orange-700 border-orange-500/30',
    SILVER: 'bg-gray-400/20 text-gray-700 border-gray-400/30',
    GOLD: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30',
    PREMIUM: 'bg-emerald-500/20 text-emerald-700 border-emerald-500/30'
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Vendor Header (Hero) */}
      <div className="relative h-64 bg-gradient-to-br from-emerald-500/20 via-green-500/20 to-lime-500/20 border-b">
        {/* Cover Photo (placeholder for now) */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 to-lime-600 opacity-30" />
        
        {/* Vendor Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 pb-6">
          <div className="container mx-auto px-4">
            <div className="flex items-end gap-6">
              {/* Vendor Avatar */}
              <div className="relative">
                <div className="w-32 h-32 rounded-full border-4 border-background shadow-2xl overflow-hidden bg-gradient-to-br from-emerald-600 to-lime-600 flex items-center justify-center text-white text-3xl font-bold">
                  {vendorLogo ? (
                    <Image src={vendorLogo} alt={vendorName} fill className="object-cover" />
                  ) : (
                    vendorName.slice(0, 2).toUpperCase()
                  )}
                </div>
                
                {/* Trust Badge */}
                <div className="absolute -bottom-2 -right-2">
                  <Badge className={cn(
                    "text-xs px-2 py-1",
                    tierColors[vendorTier as keyof typeof tierColors] || tierColors.NEW
                  )}>
                    <Award className="w-3 h-3 mr-1" />
                    {vendorTier}
                  </Badge>
                </div>
              </div>
              
              {/* Vendor Details */}
              <div className="flex-1 pb-2">
                <h1 className="text-3xl font-bold text-foreground mb-2">{vendorName}</h1>
                <p className="text-muted-foreground max-w-2xl">{vendorDescription}</p>
                
                {/* Stats Row */}
                <div className="flex items-center gap-6 mt-3 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span className="font-medium">{vendorRating.toFixed(1)}</span>
                    <span className="text-muted-foreground">{t('rating')}</span>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <span className="font-medium">{vendorSales}</span>
                    <span className="text-muted-foreground">{t('totalSales')}</span>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {t('memberSince')} {memberSince}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-3 pb-2">
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <Heart className="w-4 h-4 mr-2" />
                  {t('followVendor')}
                </Button>
                <Button variant="outline">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  {t('messageVendor')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-0 py-0">
        <Tabs value={activeTab} onValueChange={(value) => startTransition(() => setActiveTab(value))} className="space-y-6">
          {/* Tabs Navigation */}
          <TabsList className="bg-muted">
            <TabsTrigger value="products">{t('tabs.products')}</TabsTrigger>
            <TabsTrigger value="about">{t('tabs.about')}</TabsTrigger>
            <TabsTrigger value="reviews">{t('tabs.reviews')}</TabsTrigger>
            <TabsTrigger value="contact">{t('tabs.contact')}</TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-6">
            {products.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Store className="w-16 h-16 text-muted-foreground mb-4" />
                  <p className="text-lg text-muted-foreground">No products available yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
                {products.map(product => (
                  <Card key={product.id} className="overflow-hidden hover:shadow-xl transition-all">
                    <div className="relative aspect-square bg-muted">
                      <Image
                        src={product.images?.[0] || '/placeholder-product.jpg'}
                        alt={product.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-sm line-clamp-2 mb-2">{product.name}</h3>
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-emerald-600">
                          {product.price.toFixed(2)} {product.currency}
                        </p>
                        <Button size="sm">Add to Cart</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* About Tab */}
          <TabsContent value="about">
            <Card>
              <CardContent className="pt-6 space-y-6">
                <div>
                  <h3 className="font-semibold text-lg mb-3">{t('about.story')}</h3>
                  <p className="text-muted-foreground">{vendorDescription}</p>
                </div>
                
                {categories.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Categories</h3>
                    <div className="flex flex-wrap gap-2">
                      {categories.map((cat: string) => (
                        <Badge key={cat} variant="secondary">{cat}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reviews Tab */}
          <TabsContent value="reviews">
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground py-8">
                  No reviews yet. Be the first to review this vendor!
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contact Tab */}
          <TabsContent value="contact">
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground py-8">
                  Contact information will be displayed here.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer */}
      <footer className="border-t py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>
            {t('poweredBy')} <span className="font-semibold text-emerald-600">GreenFood.live</span>
          </p>
        </div>
      </footer>
    </div>
  )
}

