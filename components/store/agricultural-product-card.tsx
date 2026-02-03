'use client'

/**
 * Agricultural Product Card with Vendor Attribution
 * GreenFood.live product-focused design
 * Features: Product image, vendor bar, certifications, sustainability indicators, pricing
 */

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { VendorAttributionBarCompact, type VendorInfo } from './vendor-attribution-bar'
import { 
  ShoppingCart, Heart, Share2, MapPin, Clock, Star, Leaf, Shield, Link as LinkIcon,
  CloudOff, Sprout, Tractor, BadgeCheck
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AgriculturalProductCardData {
  id: string
  title: string
  description?: string
  image: string
  price: number
  currency: string
  
  // Vendor info (required)
  vendor: VendorInfo
  
  // Location & freshness
  distance?: number // km
  harvestedDaysAgo?: number
  inStock: boolean
  stockLevel?: 'high' | 'medium' | 'low'
  
  // Certifications
  certifications: {
    organic?: boolean
    regenerative?: boolean
    fairTrade?: boolean
    carbonNegative?: boolean
    fsmaCompliant?: boolean
  }
  
  // Ratings & reviews
  rating?: number
  reviewCount?: number
  
  // Token economy
  daarPrice?: number
  daarBonus?: number
  daarBonusReason?: string
  
  // Blockchain traceability
  blockchainTraceability?: boolean
  traceabilityScore?: number
}

interface AgriculturalProductCardProps {
  product: AgriculturalProductCardData
  variant?: 'grid' | 'list'
  onAddToCart?: (productId: string) => void
  onFavorite?: (productId: string) => void
  className?: string
}

export function AgriculturalProductCard({
  product,
  variant = 'grid',
  onAddToCart,
  onFavorite,
  className = '',
}: AgriculturalProductCardProps) {
  const [isFavorited, setIsFavorited] = useState(false)
  const [imageError, setImageError] = useState(false)

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onAddToCart?.(product.id)
  }

  const handleFavorite = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsFavorited(!isFavorited)
    onFavorite?.(product.id)
  }

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (navigator.share) {
      navigator.share({
        title: product.title,
        text: `Check out ${product.title} from ${product.vendor.vendorName} on GreenFood.live`,
        url: `/store/products/${product.id}`,
      })
    }
  }

  const formatPrice = () => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: product.currency,
    }).format(product.price)
  }

  // Render certifications
  const renderCertifications = () => {
    const badges = []
    
    if (product.certifications.organic) {
      badges.push(
        <Badge key="organic" variant="secondary" className="bg-lime-100 text-lime-700 dark:bg-lime-950 dark:text-lime-400 text-xs flex items-center gap-1">
          <Leaf className="w-3 h-3" />
          Organic
        </Badge>
      )
    }
    
    if (product.certifications.regenerative) {
      badges.push(
        <Badge key="regenerative" variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 text-xs flex items-center gap-1">
          <Sprout className="w-3 h-3" />
          Regenerative
        </Badge>
      )
    }
    
    if (product.certifications.carbonNegative) {
      badges.push(
        <Badge key="carbon" variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 text-xs flex items-center gap-1">
          <CloudOff className="w-3 h-3" />
          Carbon-
        </Badge>
      )
    }
    
    if (product.certifications.fsmaCompliant) {
      badges.push(
        <Badge key="fsma" variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 text-xs flex items-center gap-1">
          <Shield className="w-3 h-3" />
          FSMA
        </Badge>
      )
    }
    
    if (product.blockchainTraceability) {
      badges.push(
        <Badge key="blockchain" variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 text-xs flex items-center gap-1">
          <LinkIcon className="w-3 h-3" />
          Blockchain
        </Badge>
      )
    }
    
    return badges
  }

  return (
    <Link href={`/store/products/${product.id}`}>
      <Card className={cn(
        'group overflow-hidden',
        'border border-gray-200 dark:border-gray-800',
        'shadow-md hover:shadow-xl',
        'transition-all duration-300',
        'hover:scale-[1.02]',
        'hover:border-emerald-300 dark:hover:border-emerald-700',
        !product.inStock && 'opacity-60',
        className
      )}>
        {/* Product Image Area */}
        <div className="relative h-64 bg-gray-100 dark:bg-gray-900 overflow-hidden">
          <Image
            src={imageError ? '/images/placeholder-product.jpg' : product.image}
            alt={product.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImageError(true)}
          />
          
          {/* Certification Badges Overlay */}
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 max-w-[70%]">
            {renderCertifications().slice(0, 3)}
          </div>
          
          {/* Quick Actions (visible on hover) */}
          <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon"
              variant="secondary"
              className="w-9 h-9 bg-white/90 hover:bg-white dark:bg-gray-900/90 dark:hover:bg-gray-900 shadow-lg"
              onClick={handleFavorite}
            >
              <Heart className={cn('w-4 h-4', isFavorited && 'fill-red-500 text-red-500')} />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="w-9 h-9 bg-white/90 hover:bg-white dark:bg-gray-900/90 dark:hover:bg-gray-900 shadow-lg"
              onClick={handleShare}
            >
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Freshness Indicator */}
          {product.harvestedDaysAgo !== undefined && product.harvestedDaysAgo <= 3 && (
            <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-full bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm shadow-lg flex items-center gap-1.5">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                Harvested {product.harvestedDaysAgo}d ago
              </span>
            </div>
          )}
          
          {/* Out of Stock Overlay */}
          {!product.inStock && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Badge className="text-lg px-4 py-2 bg-red-600 text-white">
                Out of Stock
              </Badge>
            </div>
          )}
          
          {/* Low Stock Badge */}
          {product.inStock && product.stockLevel === 'low' && (
            <div className="absolute bottom-3 left-3">
              <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400">
                Only a few left!
              </Badge>
            </div>
          )}
        </div>
        
        {/* Vendor Attribution Bar */}
        <VendorAttributionBarCompact vendor={product.vendor} />
        
        {/* Product Details Section */}
        <div className="p-4 space-y-3">
          {/* Product Title */}
          <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 leading-tight break-words">
            {product.title}
          </h3>
          
          {/* Product Meta */}
          <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400 flex-wrap">
            {product.distance !== undefined && (
              <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <MapPin className="w-3.5 h-3.5" />
                <span>{product.distance.toFixed(1)} km</span>
              </div>
            )}
            
            {product.harvestedDaysAgo !== undefined && (
              <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                <Clock className="w-3.5 h-3.5" />
                <span>{product.harvestedDaysAgo}d ago</span>
              </div>
            )}
            
            {product.rating && (
              <div className="flex items-center gap-1 text-yellow-500">
                <Star className="w-3.5 h-3.5 fill-yellow-500" />
                <span className="text-gray-900 dark:text-gray-100 font-medium">{product.rating.toFixed(1)}</span>
                {product.reviewCount && (
                  <span className="text-gray-600 dark:text-gray-400">({product.reviewCount})</span>
                )}
              </div>
            )}
          </div>
          
          {/* Sustainability Indicators */}
          {product.daarBonus && product.daarBonus > 0 && (
            <div className="flex gap-2 flex-wrap">
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 text-xs font-semibold">
                +{product.daarBonus}% DAAR Bonus
              </Badge>
              {product.daarBonusReason && (
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {product.daarBonusReason}
                </span>
              )}
            </div>
          )}
        </div>
        
        {/* Action/Purchase Bar */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
          {/* Price Display */}
          <div className="flex flex-col">
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {formatPrice()}
            </div>
            {product.daarPrice && (
              <div className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                {product.daarPrice.toFixed(2)} DAAR
              </div>
            )}
          </div>
          
          {/* Add to Cart Button */}
          <Button
            onClick={handleAddToCart}
            disabled={!product.inStock}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors"
            size="default"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Add to Cart
          </Button>
        </div>
      </Card>
    </Link>
  )
}

/**
 * Product Grid Layout
 */
export function AgriculturalProductGrid({
  products,
  onAddToCart,
  onFavorite,
  className = '',
}: {
  products: AgriculturalProductCardData[]
  onAddToCart?: (productId: string) => void
  onFavorite?: (productId: string) => void
  className?: string
}) {
  return (
    <div className={cn(
      'grid gap-6',
      'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
      className
    )}>
      {products.map((product) => (
        <AgriculturalProductCard
          key={product.id}
          product={product}
          onAddToCart={onAddToCart}
          onFavorite={onFavorite}
        />
      ))}
    </div>
  )
}

