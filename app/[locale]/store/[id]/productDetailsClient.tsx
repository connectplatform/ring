'use client'

/**
 * Product Details Client — server props SSOT (no React.use(fetch) promises).
 */

import { useState, useCallback, useEffect } from 'react'
import { Package, Truck, Shield, Heart } from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import { ProductAgentChatTopBar } from '@/features/store/components/product-agent-chat-shell'
import { useStore } from '@/features/store/context'
import { useStoreCurrency } from '@/features/store/currency-context'
import type { Locale } from '@/i18n/shared'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { useToast } from '@/hooks/use-toast'
import { useTranslations } from 'next-intl'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RingBreadcrumbs } from '@/components/common/ring-breadcrumbs'
import ProductImageGallery from '@/components/store/product-image-gallery'
import ProductVariantSelector from '@/components/store/product-variant-selector'
import AddToCartButton from '@/components/store/add-to-cart-button'
import ProductReviews from '@/components/store/product-reviews'
import RelatedProductsCarousel from '@/components/store/related-products-carousel'
import FloatingButtons from '@/components/store/floating-buttons'
import type { StoreProduct } from '@/features/store/types'
import type { ProductReviewView } from '@/features/store/services/product-reviews'
import type { RailProductCard } from '@/features/store/services/product-details-rail'

function calcRatingDistribution(reviews: { rating: number }[]): number[] {
  const stars = [0, 0, 0, 0, 0]
  for (const r of reviews) {
    if (r.rating >= 1 && r.rating <= 5) stars[5 - r.rating]++
  }
  return stars.reverse()
}

export type ProductDetailsClientProps = {
  locale: Locale
  id: string
  product: StoreProduct
  reviews: ProductReviewView[]
  averageRating: number
  relatedProducts: RailProductCard[]
}

export default function ProductDetailsClient({
  locale,
  id,
  product,
  reviews,
  averageRating,
  relatedProducts,
}: ProductDetailsClientProps) {
  const { addToCart, updateQuantity, products } = useStore()
  const [favorites, setFavorites] = useLocalStorage<string[]>('ring_favorites', [])
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({})
  const [finalPrice, setFinalPrice] = useState(0)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    const openReviews = () => setActiveTab('reviews')
    window.addEventListener('store:open-product-reviews', openReviews)
    return () => window.removeEventListener('store:open-product-reviews', openReviews)
  }, [])

  const { success } = useToast()
  const t = useTranslations('modules.store')
  const storeCurrencyContext = useStoreCurrency()

  const convertPrice = storeCurrencyContext?.convertPrice || ((price: number) => price)
  const formatPrice =
    storeCurrencyContext?.formatPrice || ((price: number) => `${price.toFixed(2)} ₴`)

  const isFavorite = favorites.includes(id)

  const toggleFavorite = () => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
    if (!isFavorite) {
      success({ title: t('product.addedToFavorites', { name: product.name }) })
    }
  }

  const variants = product.variants && product.variants.length > 0 ? product.variants : []

  const productImages =
    !product.images || product.images.length === 0
      ? [{ url: '/placeholder-product.png', alt: product.name || 'Product' }]
      : product.images.map((url: string, index: number) => ({
          url,
          alt: `${product.name}${index > 0 ? ` - View ${index + 1}` : ''}`,
        }))

  const handleAddToCart = useCallback(
    async (quantity: number) => {
      await Promise.resolve(addToCart(product))
      if (quantity > 1) {
        updateQuantity(product.id, quantity)
      }
      success({
        title: t('product.addedToCart', { name: product.name }),
        description: `Quantity: ${quantity}`,
      })
    },
    [product, addToCart, updateQuantity, success, t],
  )

  const handleVariantChange = useCallback(
    (variantsMap: Record<string, string>, price: string | number) => {
      setSelectedVariants(variantsMap)
      setFinalPrice(typeof price === 'string' ? parseFloat(price) : price)
    },
    [],
  )

  const handleQuickAdd = useCallback(
    async (productId: string) => {
      const productToAdd = products.find((p) => p.id === productId)
      if (productToAdd) {
        await Promise.resolve(addToCart(productToAdd))
        success({ title: `Added ${productToAdd.name} to cart!` })
      }
    },
    [products, addToCart, success],
  )

  const breadcrumbItems = [
    { label: t('title', { defaultValue: 'Store' }), href: ROUTES.STORE(locale) },
    ...(product.category
      ? [{ label: product.category, href: ROUTES.STORE(locale) }]
      : []),
    { label: product.name },
  ]

  // Keep selectedVariants for future variant summary UI
  void selectedVariants

  return (
    <div className="relative mx-auto max-w-7xl space-y-8">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <RingBreadcrumbs items={breadcrumbItems} className="flex-1" />
        <ProductAgentChatTopBar />
      </div>

      <div className="mb-12 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="flex justify-center lg:justify-start">
          <ProductImageGallery images={productImages} productName={product.name} />
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="mb-2 text-3xl font-bold md:text-4xl">{product.name}</h1>
            <div className="mb-4 flex items-baseline gap-3">
              <span className="text-4xl font-bold text-primary">
                {formatPrice(
                  convertPrice(
                    finalPrice || parseFloat(product.price),
                    product.currency,
                    storeCurrencyContext.currency,
                  ),
                  storeCurrencyContext.currency,
                )}
              </span>
            </div>
          </div>

          {variants.length > 0 && (
            <ProductVariantSelector
              variants={variants}
              basePrice={parseFloat(product.price)}
              currency={product.currency}
              onVariantChange={handleVariantChange}
            />
          )}

          <AddToCartButton
            productId={product.id}
            productName={product.name}
            price={finalPrice || parseFloat(product.price)}
            currency={product.currency}
            stock={product.stock || 25}
            allowPreorder={product.allowPreorder || false}
            onAddToCart={handleAddToCart}
            showQuantitySelector={true}
          />

          <button
            type="button"
            onClick={toggleFavorite}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 px-6 py-3 font-medium transition-all hover:scale-[1.02]"
          >
            <Heart className={isFavorite ? 'fill-red-500 text-red-500' : ''} />
            {isFavorite ? t('favorites.savedToFavorites') : t('favorites.saveToFavorites')}
          </button>

          <div className="grid grid-cols-3 gap-4 border-t pt-6">
            <div className="text-center">
              <Package className="mx-auto mb-2 h-8 w-8 text-primary" />
              <div className="text-xs font-medium">{t('freeShipping')}</div>
            </div>
            <div className="text-center">
              <Truck className="mx-auto mb-2 h-8 w-8 text-primary" />
              <div className="text-xs font-medium">{t('fastDelivery')}</div>
            </div>
            <div className="text-center">
              <Shield className="mx-auto mb-2 h-8 w-8 text-primary" />
              <div className="text-xs font-medium">{t('securePayment')}</div>
            </div>
          </div>

          {product.vendorName ? (
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{t('product.soldBy')}:</span>
                <span className="text-sm font-semibold text-primary">{product.vendorName}</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {product.specifications && Object.keys(product.specifications).length > 0 ? (
        <div className="mb-12">
          <h2 className="mb-6 text-2xl font-bold">{t('product.specifications')}</h2>
          <div className="grid grid-cols-1 gap-4 rounded-xl border bg-card p-6 md:grid-cols-2">
            {Object.entries(product.specifications).map(([key, value]) => (
              <div key={key} className="flex justify-between border-b py-2 last:border-b-0">
                <span className="font-medium capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}:
                </span>
                <span className="text-muted-foreground">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div id="product-reviews" className="mb-12 scroll-mt-24">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">{t('product.overview')}</TabsTrigger>
            <TabsTrigger value="description">{t('product.description')}</TabsTrigger>
            <TabsTrigger value="reviews">
              {t('product.reviews')} ({reviews.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-6">
            <div className="prose prose-lg max-w-none">
              {product.description ? (
                <p className="text-lg leading-relaxed text-muted-foreground">
                  {product.description}
                </p>
              ) : (
                <p className="text-muted-foreground">{t('product.noOverview')}</p>
              )}
            </div>
          </TabsContent>
          <TabsContent value="description" className="mt-6">
            <div className="prose prose-lg max-w-none">
              {product.longDescription ? (
                <div className="whitespace-pre-wrap leading-relaxed text-muted-foreground">
                  {product.longDescription}
                </div>
              ) : (
                <p className="text-muted-foreground">{t('product.noDescription')}</p>
              )}
            </div>
          </TabsContent>
          <TabsContent value="reviews" className="mt-6">
            <ProductReviews
              reviews={reviews.map((r) => ({
                id: r.id,
                author: r.author,
                rating: r.rating,
                title: r.title ?? '',
                content: r.content,
                verifiedPurchase: r.verifiedPurchase,
                helpful: r.helpful,
                date: r.date,
                images: Array.isArray(r.images)
                  ? (r.images as Array<string | { url: string }>).map((img) =>
                      typeof img === 'string' ? { url: img } : { url: img.url },
                    )
                  : undefined,
                sellerResponse:
                  r.sellerResponse &&
                  typeof r.sellerResponse === 'object' &&
                  'content' in (r.sellerResponse as object)
                    ? (r.sellerResponse as { content: string; date: string })
                    : undefined,
              }))}
              averageRating={averageRating}
              totalReviews={reviews.length}
              ratingDistribution={calcRatingDistribution(reviews)}
            />
          </TabsContent>
        </Tabs>
      </div>

      {relatedProducts.length > 0 ? (
        <RelatedProductsCarousel
          products={relatedProducts}
          title={t('youMightAlsoLike')}
          onQuickAdd={handleQuickAdd}
          aiPowered={false}
        />
      ) : null}

      {/* Cart FAB after add-to-cart (no sort on PDP) */}
      <FloatingButtons locale={locale} showSort={false} />
    </div>
  )
}
