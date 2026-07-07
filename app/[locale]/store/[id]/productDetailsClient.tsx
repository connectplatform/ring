'use client'

// Product Details Page - LEGENDARY Edition
// Features: Hero gallery, variant selector, animated cart, reviews, AI-products, responsive, stock tracking, SEO
// Next.js Client Component

// --- React/Next streaming, Suspense, and "use" hooks enabled ---

import React, { useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Package, Truck, Shield, Heart } from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import { ProductAgentChatTopBar } from '@/features/store/components/product-agent-chat-shell'
import { useStore } from '@/features/store/context'
import { useOptionalStoreCurrency, useStoreCurrency } from '@/features/store/currency-context'
import type { Locale } from '@/i18n/shared'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { useToast } from '@/hooks/use-toast'
import { useTranslations } from 'next-intl'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Components encapsulating individual product page features
import ProductImageGallery from '@/components/store/product-image-gallery'
import ProductVariantSelector from '@/components/store/product-variant-selector'
import AddToCartButton from '@/components/store/add-to-cart-button'
import ProductReviews from '@/components/store/product-reviews'
import RelatedProductsCarousel from '@/components/store/related-products-carousel'

// --- Data loaders for React 19/Next 16 streaming via "use" ---
// These can be moved to a separate file as needed for cleanness

async function fetchProductDetails(products: any[], id: string) {
  // products[] may be from store context (if SSR preload); otherwise fetch from API as backup
  let product = products.find((p) => p.id === id);
  if (!product) {
    const res = await fetch(`/api/store/products/${id}`, { cache: 'force-cache' });
    if (!res.ok) return null;
    product = await res.json();
  }
  return product;
}

async function fetchProductReviews(productId: string) {
  const res = await fetch(`/api/store/products/${productId}/reviews`, { cache: 'no-store' });
  if (!res.ok)
    return {
      reviews: [],
      averageRating: 0,
    };
  const data = await res.json();
  return {
    reviews: (data.reviews || []).map((review: any) => ({
      id: review.id,
      author: review.author,
      rating: review.rating,
      title: review.title ?? '',
      content: review.content,
      verifiedPurchase: review.verifiedPurchase,
      helpful: review.helpful,
      date: review.date,
      sellerResponse: review.sellerResponse,
    })),
    averageRating: data.averageRating || 0,
  };
}

// No longer need useEffect/useMemo to derive list of related products using React "use"
async function fetchRelatedProducts(allProducts: any[], product: any, id: string, locale: string) {
  if (!product?.category) return [];
  return (
    allProducts
      .filter((p) => p.id !== id && p.category === product.category)
      .slice(0, 8)
      .map((p) => ({
        id: p.id,
        name: p.name,
        image: p.images && p.images.length > 0 ? p.images[0] : '/placeholder.png',
        price: parseFloat(p.price), // Ensure numeric
        currency: p.currency,
        rating: 4.5, // MOCK
        reviewCount: 0, // MOCK
        inStock: (p.stock || 0) > 0,
        category: p.category || '',
        url: `${ROUTES.STORE(locale as Locale)}/${p.id}`,
      })) || []
  );
}

// Helper to calculate rating distribution (by star)
function calcRatingDistribution(reviews: { rating: number }[]): number[] {
  const stars = [0, 0, 0, 0, 0];
  for (const r of reviews) {
    // ratings are 1..5
    if (r.rating >= 1 && r.rating <= 5) stars[5 - r.rating]++;
  }
  return stars.reverse(); // index 0=5 stars, 4=1 star
}

// --- Suspense boundaries for streaming SSR/CSR hydration ---
function ProductDetailsContent({
  locale,
  id,
  products,
}: {
  locale: Locale;
  id: string;
  products: any[];
}) {
  const router = useRouter();

  const { addToCart, updateQuantity } = useStore();

  // Persist user's favorites ("wishlist") in localStorage
  const [favorites, setFavorites] = useLocalStorage<string[]>('ring_favorites', []);

  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [finalPrice, setFinalPrice] = useState(0);

  const { success } = useToast();

  const t = useTranslations('modules.store');
  const tCommon = useTranslations('common');

  const storeCurrencyContext = useStoreCurrency();

  const convertPrice =
    storeCurrencyContext?.convertPrice || ((price: number) => price);
  const formatPrice =
    storeCurrencyContext?.formatPrice ||
    ((price: number) => `${price.toFixed(2)} ₴`);

  // --- streaming product, reviews, related ---
  const product = React.use(fetchProductDetails(products, id));
  const { reviews, averageRating } = React.use(fetchProductReviews(id));
  const relatedProducts = React.use(
    fetchRelatedProducts(products, product, id, locale)
  );

  // Is product in favorites? Derived JS
  const isFavorite = favorites.includes(id);

  // Toggle favorite (add/remove): triggers toast when adding
  const toggleFavorite = () => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    if (!isFavorite) {
      success({ title: t('product.addedToFavorites', { name: product?.name }) });
    }
  };

  // Extract and memoize available product variants (color, size etc) for selector
  const variants =
    product?.variants && product.variants.length > 0
      ? product.variants
      : [];

  // Prepare main image(s) for gallery component, fallback to placeholder.
  const productImages =
    !product || !product.images || product.images.length === 0
      ? [{ url: '/placeholder.png', alt: product?.name || 'Product' }]
      : product.images.map((url: string, index: number) => ({
          url,
          alt: `${product.name}${index > 0 ? ` - View ${index + 1}` : ''}`,
        }));

  // Handlers
  const handleAddToCart = useCallback(
    async (quantity: number) => {
      if (!product) return;

      await Promise.resolve(addToCart(product));
      if (quantity > 1) {
        updateQuantity(product.id, quantity);
      }
      success({
        title: t('product.addedToCart', { name: product.name }),
        description: `Quantity: ${quantity}`,
      });
    },
    [product, addToCart, updateQuantity, success, t]
  );

  const handleVariantChange = useCallback(
    (variants: Record<string, string>, price: string | number) => {
      setSelectedVariants(variants);
      setFinalPrice(typeof price === 'string' ? parseFloat(price) : price);
    },
    []
  );

  const handleQuickAdd = useCallback(
    async (productId: string) => {
      const productToAdd =
        products.find((p) => p.id === productId);
      if (productToAdd) {
        await Promise.resolve(addToCart(productToAdd));
        success({ title: `Added ${productToAdd.name} to cart!` });
      }
    },
    [products, addToCart, success]
  );

  // Skeleton fallback if streaming not ready
  if (!product && products.length === 0) {
    return (
      <div className="animate-pulse space-y-8 max-w-7xl mx-auto">
        {/* Skeletons for title, image, details */}
        <div className="h-8 w-32 bg-muted rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="aspect-square bg-muted rounded-xl" />
          <div className="space-y-4">
            <div className="h-8 bg-muted rounded" />
            <div className="h-24 bg-muted rounded" />
            <div className="h-12 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-16 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Product not found</h1>
        <Link
          className="text-primary hover:underline"
          href={ROUTES.STORE(locale)}
        >
          Back to store
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Breadcrumb & Back Button */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()} // Go back to previous page
          className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-muted transition-colors font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{tCommon('actions.back')}</span>
        </button>
        <ProductAgentChatTopBar />
      </div>

      {/* Main product content section (gallery and info/CTA) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* Left: Hero image gallery with lightbox/zoom */}
        <div className="flex justify-center lg:justify-start">
          <ProductImageGallery
            images={productImages}
            productName={product.name}
          />
        </div>

        {/* Right: Product info, price, variants, CTAs, badges, vendor */}
        <div className="space-y-6">
          {/* Title and Price */}
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">{product.name}</h1>
            <div className="flex items-baseline gap-3 mb-4">
              <span className="text-4xl font-bold text-primary">
                {/* Price formatted for store currency */}
                {formatPrice(
                  convertPrice(finalPrice || parseFloat(product.price),
                  product.currency,
                  storeCurrencyContext.currency),
                  storeCurrencyContext.currency
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
            onClick={toggleFavorite}
            className="w-full py-3 px-6 border-2 rounded-xl font-medium transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
          >
            {/* Heart icon filled if favorited */}
            <Heart className={isFavorite ? "fill-red-500 text-red-500" : ""} />
            {isFavorite ? t('favorites.savedToFavorites') : t('favorites.saveToFavorites')}
          </button>
          <div className="grid grid-cols-3 gap-4 pt-6 border-t">
            <div className="text-center">
              <Package className="h-8 w-8 mx-auto mb-2 text-primary" />
              <div className="text-xs font-medium">{t('freeShipping')}</div>
            </div>
            <div className="text-center">
              <Truck className="h-8 w-8 mx-auto mb-2 text-primary" />
              <div className="text-xs font-medium">{t('fastDelivery')}</div>
            </div>
            <div className="text-center">
              <Shield className="h-8 w-8 mx-auto mb-2 text-primary" />
              <div className="text-xs font-medium">{t('securePayment')}</div>
            </div>
          </div>
          {product.vendorName && (
            <div className="p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{t('product.soldBy')}:</span>
                <span className="text-sm font-semibold text-primary">{product.vendorName}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Product specification table, if exists */}
      {product.specifications && Object.keys(product.specifications).length > 0 && (
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">{t('product.specifications')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 bg-card border rounded-xl">
            {Object.entries(product.specifications).map(([key, value]) => (
              <div key={key} className="flex justify-between py-2 border-b last:border-b-0">
                <span className="font-medium capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}:
                </span>
                <span className="text-muted-foreground">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabbed info: overview, longDescription, reviews */}
      <div className="mb-12">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">{t('product.overview')}</TabsTrigger>
            <TabsTrigger value="description">{t('product.description')}</TabsTrigger>
            <TabsTrigger value="reviews">{t('product.reviews')} ({reviews.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-6">
            <div className="prose prose-lg max-w-none">
              {product.description ? (
                <p className="text-lg text-muted-foreground leading-relaxed">
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
                <div className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {product.longDescription}
                </div>
              ) : (
                <p className="text-muted-foreground">{t('product.noDescription')}</p>
              )}
            </div>
          </TabsContent>
          <TabsContent value="reviews" className="mt-6">
            <ProductReviews
              reviews={reviews}
              averageRating={averageRating}
              totalReviews={reviews.length}
              ratingDistribution={calcRatingDistribution(reviews)}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Related products carousel; AI suggested; quick add supported */}
      {relatedProducts.length > 0 && (
        <RelatedProductsCarousel
          products={relatedProducts}
          title={t('youMightAlsoLike')}
          onQuickAdd={handleQuickAdd}
          aiPowered={true}
        />
      )}
    </div>
  );
}

// --- Main exported component with Suspense boundaries ---

export default function ProductDetailsClient({ locale, id }: { locale: Locale; id: string }) {
  // Store provides: products list, cart actions
  const { products } = useStore();

  // The fallback shows skeleton UI while streaming renders product/reviews
  return (
    <Suspense
      fallback={
        <div className="animate-pulse space-y-8 max-w-7xl mx-auto">
          <div className="h-8 w-32 bg-muted rounded" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="aspect-square bg-muted rounded-xl" />
            <div className="space-y-4">
              <div className="h-8 bg-muted rounded" />
              <div className="h-24 bg-muted rounded" />
              <div className="h-12 bg-muted rounded" />
            </div>
          </div>
        </div>
      }
    >
      <ProductDetailsContent locale={locale} id={id} products={products} />
    </Suspense>
  );
}
