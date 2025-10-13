'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MessageSquare, Sparkles } from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import { useStore } from '@/features/store/context'
import type { Locale } from '@/i18n-config'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { useToast } from '@/hooks/use-toast'
import { useTranslations } from 'next-intl'

export default function ProductDetailsClient({ locale, id }: { locale: Locale; id: string }) {
  const router = useRouter()
  const { products, addToCart } = useStore()
  const [adding, setAdding] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [favorites, setFavorites] = useLocalStorage<string[]>('ring_favorites', [])
  const { success } = useToast()
  const t = useTranslations('modules.store')
  const tCommon = useTranslations('common')
  const product = useMemo(() => products.find(p => p.id === id), [products, id])
  const isFavorite = useMemo(() => favorites.includes(id), [favorites, id])
  
  const toggleFavorite = () => {
    setFavorites(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  // Get related products in the same category
  const relatedProducts = useMemo(() => {
    if (!product?.category) return []
    return products
      .filter(p => p.id !== id && p.category === product.category)
      .slice(0, 5)
  }, [product, products, id])

  if (!product && products.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-xl font-semibold mb-4">Loading…</h1>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <div className="border rounded min-h-[200px] bg-muted animate-pulse" />
          </div>
          <div className="lg:col-span-1 space-y-4">
            <div className="h-40 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-xl font-semibold mb-4">Product not found</h1>
        <Link className="underline" href={ROUTES.STORE(locale)}>Back to store</Link>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content - spans 3 columns on desktop */}
        <div className="lg:col-span-3 space-y-4">
          {/* Back Button & AI Salesman Bar */}
          <div className="flex items-center gap-3">
            {/* Back Button */}
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-muted/50 transition-colors font-medium shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{tCommon('actions.back', { defaultValue: 'Back' })}</span>
            </button>

            {/* AI Salesman Collapsed Bar - takes remaining space */}
            <div className="flex-1 border rounded-lg bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 overflow-hidden shadow-sm">
              <button
                onClick={() => setChatOpen(!chatOpen)}
                className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="font-medium text-sm">AI-Salesman</span>
                    <span className="hidden sm:inline text-xs text-muted-foreground">status:</span>
                    <span className="text-green-600 dark:text-green-400 font-semibold text-sm">Ready</span>
                  </div>
                </div>
                <button
                  className="px-4 py-1.5 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 dark:from-blue-600 dark:to-purple-600 dark:hover:from-blue-700 dark:hover:to-purple-700 text-white text-sm font-medium rounded-md transition-all shadow-sm hover:shadow-md flex items-center gap-2"
                  onClick={(e) => {
                    e.stopPropagation()
                    setChatOpen(!chatOpen)
                  }}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  {chatOpen ? 'Close' : 'Chat'}
                </button>
              </button>
              
              {/* Sliding AI Assistant Panel */}
              <div 
                className={`transition-all duration-300 ease-in-out overflow-hidden ${
                  chatOpen ? 'max-h-[520px] opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="border-t bg-white dark:bg-gray-900 backdrop-blur-sm">
                  <div className="p-4">
                    <h3 className="font-semibold mb-2 text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      AI Product Consultant
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">Ask anything about this product.</p>
                    
                    {/* AI Sales Assistant - Coming Soon */}
                    <div className="h-[420px] flex items-center justify-center border rounded-lg bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20">
                      <div className="text-center p-8">
                        <Sparkles className="w-12 h-12 mx-auto text-purple-600 dark:text-purple-400 mb-4" />
                        <h4 className="font-semibold text-lg mb-2">AI Sales Assistant</h4>
                        <p className="text-sm text-muted-foreground mb-4 max-w-md">
                          Our intelligent AI assistant will help you with:
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-2 mb-6">
                          <li className="flex items-center gap-2 justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                            Product specifications & compatibility
                          </li>
                          <li className="flex items-center gap-2 justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                            Shipping & delivery information
                          </li>
                          <li className="flex items-center gap-2 justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                            Pricing & special offers
                          </li>
                          <li className="flex items-center gap-2 justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                            Returns & warranty details
                          </li>
                        </ul>
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium">
                          <Sparkles className="w-4 h-4" />
                          Coming Soon
                        </div>
                        <p className="text-xs text-muted-foreground mt-4">
                          For immediate assistance, contact {product.vendorName || 'the vendor'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Product Image */}
          <div className="border rounded-lg min-h-[300px] md:min-h-[400px] bg-muted flex items-center justify-center">
            <span className="text-muted-foreground">Product Image</span>
          </div>

          {/* Product Details */}
          <div className="space-y-4">
            <h1 className="text-3xl font-bold">{product.name}</h1>
            
            {product.description && (
              <p className="text-lg text-muted-foreground">{product.description}</p>
            )}

            {/* Vendor Information */}
            {product.vendorName && (
              <div className="p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-sm font-medium">{t('product.soldBy')}:</span>
                  <span className="text-sm font-semibold text-primary">{product.vendorName}</span>
                </div>
              </div>
            )}

            {/* Product Metadata */}
            <div className="flex flex-wrap gap-4 text-sm">
              {product.category && (
                <div>
                  <span className="font-medium">{t('product.category')}:</span>{' '}
                  <span className="text-muted-foreground">{product.category}</span>
                </div>
              )}
              {product.sku && (
                <div>
                  <span className="font-medium">SKU:</span>{' '}
                  <span className="text-muted-foreground">{product.sku}</span>
                </div>
              )}
            </div>

            {/* Tags */}
            {product.tags && product.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {product.tags.map(tag => (
                  <span key={tag} className="px-3 py-1 bg-muted rounded-full text-xs font-medium">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Price and Actions */}
            <div className="border-t pt-4 mt-4">
              <div className="flex items-baseline gap-3 mb-6">
                <span className="text-4xl font-bold">{product.price}</span>
                <span className="text-2xl text-muted-foreground">{product.currency}</span>
                {product.billingPeriod && product.billingPeriod !== 'one-time' && (
                  <span className="text-sm text-muted-foreground">/ {product.billingPeriod}</span>
                )}
              </div>

              <div className="flex gap-3 flex-wrap">
                <button
                  className={`px-6 py-3 rounded-lg bg-blue-600 text-white font-medium text-lg ${
                    adding ? 'opacity-70 cursor-not-allowed animate-pulse' : 'hover:bg-blue-700'
                  } transition-colors`}
                  onClick={async () => {
                    if (adding) return
                    setAdding(true)
                    try {
                      await Promise.resolve(addToCart(product))
                      await new Promise(r => setTimeout(r, 600))
                      success({ title: t('product.addedToCart', { name: product.name }) })
                    } finally {
                      setAdding(false)
                    }
                  }}
                  disabled={adding}
                  aria-busy={adding}
                >
                  {adding ? t('product.adding') : t('product.addToCart')}
                </button>
                
                <button 
                  className="px-6 py-3 border rounded-lg hover:bg-muted transition-colors font-medium"
                  onClick={toggleFavorite}
                >
                  {isFavorite ? '❤️ Saved' : '🤍 Save'}
                </button>
                
                <Link 
                  className="px-6 py-3 border rounded-lg hover:bg-muted transition-colors font-medium flex items-center"
                  href={ROUTES.CART(locale)}
                >
                  {t('product.goToCart')}
                </Link>
              </div>
            </div>

            {/* Long Description */}
            {product.longDescription && (
              <div className="prose dark:prose-invert max-w-none pt-6 border-t">
                <div dangerouslySetInnerHTML={{ __html: product.longDescription.replace(/\n/g, '<br />') }} />
              </div>
            )}

            {/* Specifications */}
            {product.specifications && Object.keys(product.specifications).length > 0 && (
              <div className="border-t pt-6">
                <h2 className="text-xl font-semibold mb-4">Specifications</h2>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(product.specifications).map(([key, value]) => (
                    <div key={key} className="border-b pb-2">
                      <dt className="text-sm font-medium text-muted-foreground capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </dt>
                      <dd className="text-sm mt-1">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - fixed on desktop, hidden on mobile/tablet */}
        <div className="hidden lg:block lg:col-span-1">
          <div className="sticky top-4 space-y-4">
            {/* Related Products */}
            {relatedProducts.length > 0 && (
              <div className="border rounded-lg p-4 bg-card">
                <h3 className="font-semibold mb-3 text-sm">More in {product.category}</h3>
                <div className="space-y-3">
                  {relatedProducts.map((rp) => (
                    <Link
                      key={rp.id}
                      href={`${ROUTES.STORE(locale)}/${rp.id}`}
                      className="block group"
                    >
                      <div className="p-2 rounded hover:bg-muted transition-colors">
                        <div className="text-sm font-medium group-hover:text-blue-600 line-clamp-2">
                          {rp.name}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {rp.price} {rp.currency}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
                <Link
                  href={ROUTES.STORE(locale)}
                  className="block mt-4 text-sm text-center text-blue-600 hover:underline"
                >
                  View all products →
                </Link>
              </div>
            )}

            {/* Product Info Card */}
            <div className="border rounded-lg p-4 bg-card text-sm space-y-2">
              <div className="flex items-center gap-2 text-green-600">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">In Stock</span>
              </div>
              {product.digitalProduct && (
                <div className="flex items-center gap-2 text-blue-600">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 7H7v6h6V7z" />
                    <path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd" />
                  </svg>
                  <span>Digital Product</span>
                </div>
              )}
              {product.instantDelivery && (
                <div className="flex items-center gap-2 text-purple-600">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  <span>Instant Delivery</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

