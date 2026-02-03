'use client'

import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { ProductCard } from './product-card'
import { useOptionalStore } from '../context'
import { getVectorSimilarity } from '@/lib/vector-search'
import type { StoreProduct } from '../types'
import type { Locale } from '@/i18n-config'

interface SimilarProductsProps {
  currentProduct: StoreProduct
  locale: Locale
  className?: string
}

/**
 * Similar Products Component - Vector Matching Recommendations
 * Features:
 * - Vector similarity matching using product embeddings
 * - Displays 3 most similar products
 * - React 19 optimized with proper memoization
 * - Framer Motion animations with stagger effect
 * - Responsive grid layout
 */
export function SimilarProducts({ currentProduct, locale, className }: SimilarProductsProps) {
  const t = useTranslations('modules.store')
  const store = useOptionalStore()

  const similarProducts = useMemo(() => {
    if (!store?.enhancedProducts || !currentProduct.embedding) {
      return []
    }

    // Calculate similarity scores for all other products
    const similarities = store.enhancedProducts
      .filter(product => product.id !== currentProduct.id && product.embedding)
      .map(product => ({
        product,
        similarity: getVectorSimilarity(currentProduct.embedding!, product.embedding!)
      }))
      .sort((a, b) => b.similarity - a.similarity)

    // Return top 3 most similar products
    return similarities.slice(0, 3).map(item => item.product)
  }, [store?.enhancedProducts, currentProduct])

  if (similarProducts.length === 0) {
    return (
      <motion.div
        className="text-sm text-muted-foreground p-6 bg-muted/30 rounded-xl text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="text-muted-foreground/70">
          No similar products found at this time.
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <motion.div
          className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        />
        <h3 className="text-lg font-semibold text-foreground">
          {t('relatedProducts')}
        </h3>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 gap-3">
        {similarProducts.map((product, index) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              delay: index * 0.1,
              duration: 0.3,
              ease: "easeOut"
            }}
            className="group"
          >
            {/* Compact Product Card for Sidebar */}
            <div className="bg-card border border-border rounded-lg p-3 hover:shadow-md transition-all duration-200 hover:border-primary/50">
              <div className="flex gap-3">
                {/* Product Image - Smaller */}
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 bg-muted rounded-md overflow-hidden flex items-center justify-center">
                    {product.images && product.images.length > 0 ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 text-muted-foreground">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm line-clamp-2 mb-1 group-hover:text-primary transition-colors">
                    {product.name}
                  </h4>
                  <div className="text-sm font-semibold text-primary">
                    {product.price} {product.currency}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
