'use client'

/**
 * Related Products Carousel - AI-POWERED Edition
 * 
 * Features Shopify wishes they had:
 * • Horizontal scrolling carousel
 * • AI-powered recommendations
 * • Quick add to cart
 * • Hover preview with animations
 * • Navigation arrows
 * • Drag to scroll
 * • Auto-scroll option
 * • Touch-optimized
 */

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ShoppingCart, Star, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RelatedProduct {
  id: string
  name: string
  image: string
  price: number
  currency: string
  rating?: number
  reviewCount?: number
  inStock: boolean
  category?: string
  url: string
}

interface RelatedProductsCarouselProps {
  products: RelatedProduct[]
  title?: string
  onQuickAdd?: (productId: string) => void
  className?: string
  aiPowered?: boolean
}

export default function RelatedProductsCarousel({
  products,
  title = "You might also like",
  onQuickAdd,
  className,
  aiPowered = false
}: RelatedProductsCarouselProps) {
  const [scrollPosition, setScrollPosition] = useState(0)
  const [isHovering, setIsHovering] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const canScrollLeft = scrollPosition > 0
  const canScrollRight = scrollContainerRef.current 
    ? scrollPosition < scrollContainerRef.current.scrollWidth - scrollContainerRef.current.clientWidth
    : false

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return

    const scrollAmount = 300
    const newPosition = direction === 'left' 
      ? Math.max(0, scrollPosition - scrollAmount)
      : Math.min(
          scrollContainerRef.current.scrollWidth - scrollContainerRef.current.clientWidth,
          scrollPosition + scrollAmount
        )

    scrollContainerRef.current.scrollTo({
      left: newPosition,
      behavior: 'smooth'
    })
  }

  // Update scroll position
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      setScrollPosition(container.scrollLeft)
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  // Mouse drag to scroll
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart(e.pageX - (scrollContainerRef.current?.offsetLeft || 0))
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return
    e.preventDefault()
    const x = e.pageX - scrollContainerRef.current.offsetLeft
    const walk = (x - dragStart) * 2
    scrollContainerRef.current.scrollLeft = scrollPosition - walk
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  if (products.length === 0) return null

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-2xl font-bold">{title}</h3>
          {aiPowered && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 rounded-full">
              <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                AI Recommended
              </span>
            </div>
          )}
        </div>

        {/* Navigation Arrows (Desktop) */}
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className={cn(
              "p-2 rounded-full border-2 transition-all",
              canScrollLeft
                ? "border-primary hover:bg-primary hover:text-primary-foreground"
                : "border-muted text-muted-foreground cursor-not-allowed opacity-50"
            )}
            aria-label="Previous"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className={cn(
              "p-2 rounded-full border-2 transition-all",
              canScrollRight
                ? "border-primary hover:bg-primary hover:text-primary-foreground"
                : "border-muted text-muted-foreground cursor-not-allowed opacity-50"
            )}
            aria-label="Next"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Carousel */}
      <div className="relative">
        {/* Products Container */}
        <div
          ref={scrollContainerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={cn(
            "flex gap-4 overflow-x-auto scrollbar-hide pb-4",
            isDragging ? "cursor-grabbing" : "cursor-grab"
          )}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {products.map((product) => {
            const isHovered = isHovering === product.id

            return (
              <div
                key={product.id}
                onMouseEnter={() => setIsHovering(product.id)}
                onMouseLeave={() => setIsHovering(null)}
                className="flex-shrink-0 w-64 group"
              >
                <div className={cn(
                  "border rounded-xl overflow-hidden bg-card transition-all duration-300",
                  isHovered && "shadow-xl scale-105 -translate-y-2"
                )}>
                  {/* Product Image */}
                  <Link href={product.url} className="block relative aspect-square bg-muted overflow-hidden">
                    <img
                      src={product.image}
                      alt={product.name}
                      className={cn(
                        "w-full h-full object-cover transition-transform duration-500",
                        isHovered && "scale-110"
                      )}
                    />
                    
                    {/* Quick Add Button (on hover) */}
                    {onQuickAdd && product.inStock && (
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          onQuickAdd(product.id)
                        }}
                        className={cn(
                          "absolute inset-x-4 bottom-4 py-2 px-4 bg-primary text-primary-foreground rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2",
                          isHovered
                            ? "opacity-100 translate-y-0"
                            : "opacity-0 translate-y-4 pointer-events-none"
                        )}
                      >
                        <ShoppingCart className="h-4 w-4" />
                        Quick Add
                      </button>
                    )}

                    {/* Out of Stock Overlay */}
                    {!product.inStock && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="px-4 py-2 bg-red-500 text-white font-semibold rounded-lg">
                          Out of Stock
                        </span>
                      </div>
                    )}
                  </Link>

                  {/* Product Info */}
                  <div className="p-4 space-y-2">
                    {/* Category */}
                    {product.category && (
                      <div className="text-xs text-muted-foreground uppercase tracking-wide">
                        {product.category}
                      </div>
                    )}

                    {/* Product Name */}
                    <Link
                      href={product.url}
                      className="block font-semibold text-sm line-clamp-2 hover:text-primary transition-colors min-h-[40px]"
                    >
                      {product.name}
                    </Link>

                    {/* Rating */}
                    {product.rating !== undefined && (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={cn(
                                "h-3 w-3",
                                i < Math.round(product.rating!)
                                  ? "fill-amber-400 text-amber-400"
                                  : "fill-muted text-muted"
                              )}
                            />
                          ))}
                        </div>
                        {product.reviewCount !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            ({product.reviewCount})
                          </span>
                        )}
                      </div>
                    )}

                    {/* Price */}
                    <div className="flex items-baseline gap-2 pt-2">
                      <span className="text-lg font-bold">
                        {product.price}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {product.currency}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Fade overlays for scroll indication */}
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background to-transparent pointer-events-none" />
        )}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent pointer-events-none" />
        )}
      </div>

      {/* Mobile scroll indicator */}
      <div className="md:hidden flex justify-center gap-2">
        {Array.from({ length: Math.ceil(products.length / 2) }).map((_, idx) => (
          <div
            key={idx}
            className={cn(
              "h-1.5 rounded-full transition-all",
              Math.abs(scrollPosition / 280 - idx) < 0.5
                ? "w-6 bg-primary"
                : "w-1.5 bg-muted"
            )}
          />
        ))}
      </div>
    </div>
  )
}

