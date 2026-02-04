'use client'

/**
 * CART PAGE WRAPPER - Ring Platform v2.0
 * ======================================
 * Standardized 3-column responsive layout for shopping cart pages
 *
 * Layout Structure:
 * - Desktop: DesktopSidebar (280px) + Center Content + Right Sidebar (320px)
 * - iPad: DesktopSidebar (280px) + Center Content + Floating Toggle for Right Sidebar
 * - Mobile: Center Content + Bottom Navigation + Floating Toggle for Right Sidebar
 *
 * Right Sidebar Content:
 * - Order Summary
 * - Promo Codes
 * - Saved for Later
 * - Shipping Info
 * - Checkout Tips
 *
 * Strike Team:
 * - Ring Components Specialist (layout pattern)
 * - React 19 Specialist (modern patterns)
 * - E-commerce Expert (cart/checkout UX)
 * - UI/UX Optimization Agent (mobile excellence)
 */

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import type { Locale } from '@/i18n-config'
import { useSession } from 'next-auth/react'
import { useStore } from '@/features/store/context'
import { useOptionalCurrency } from '@/features/store/currency-context'
import DesktopSidebar from '@/components/navigation/desktop-sidebar'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import {
  ShoppingCart,
  Tag,
  Bookmark,
  Truck,
  Shield,
  BookOpen,
  CreditCard,
  Gift,
  Percent,
  CheckCircle,
  ArrowLeft,
  AlertCircle,
  Info
} from 'lucide-react'
import { ROUTES } from '@/constants/routes'

interface CartWrapperProps {
  children: React.ReactNode
  locale: string
  pageContext?: 'cart' | 'checkout' | 'orders' | 'wishlist'
}

export default function CartWrapper({
  children,
  locale,
  pageContext = 'cart'
}: CartWrapperProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const { cartItems, totalPriceByCurrency, totalItems } = useStore()
  const currencyContext = useOptionalCurrency()
  const t = useTranslations('modules.store.cart')
  const tCommon = useTranslations('common')
  const tStore = useTranslations('modules.store')

  // Calculate totals (converted to selected currency)
  const cartTotal = cartItems.reduce((sum, item) => {
    const priceUAH = item.finalPrice || parseFloat(item.product.price)
    const convertedPrice = currencyContext?.convertPrice(priceUAH) || priceUAH
    return sum + (convertedPrice * item.quantity)
  }, 0)

  // Get selected currency and formatting functions
  const selectedCurrency = currencyContext?.currency || 'UAH'
  const formatPrice = currencyContext?.formatPrice || ((price: number) => `${price.toFixed(2)} ₴`)
  const [mounted, setMounted] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Mock cart summary (will be dynamic later)
  const cartSummary = {
    subtotal: 89.97,
    shipping: 0,
    tax: 7.20,
    discount: 0,
    total: 97.17,
    items: 3
  }

  // Mock saved for later items (will be dynamic later)
  const savedItems = [
    { id: '1', name: 'Organic Tomatoes', price: 12.99, image: '/placeholder.jpg' },
    { id: '2', name: 'Fresh Herbs Bundle', price: 8.50, image: '/placeholder.jpg' },
  ]

  // Shipping info
  const shippingInfo = [
    { type: 'standard', name: 'Standard Shipping', cost: t('free', { defaultValue: 'Free' }), time: '3-5 business days' },
    { type: 'express', name: 'Express Shipping', cost: formatPrice(9.99), time: '1-2 business days' },
    { type: 'pickup', name: 'Local Pickup', cost: t('free', { defaultValue: 'Free' }), time: 'Same day' },
  ]

  // Checkout tips
  const checkoutTips = [
    {
      id: 'secure',
      title: t('secureCheckout', { defaultValue: 'Secure Checkout' }),
      description: t('sslEncrypted', { defaultValue: 'All payments are SSL encrypted and secure' }),
      icon: Shield
    },
    {
      id: 'returns',
      title: t('easyReturns', { defaultValue: 'Easy Returns' }),
      description: t('returnPolicy', { defaultValue: '30-day return policy on all items' }),
      icon: CheckCircle
    },
    {
      id: 'support',
      title: t('customerSupport', { defaultValue: '24/7 Support' }),
      description: t('helpAvailable', { defaultValue: 'Our team is here to help anytime' }),
      icon: Info
    },
  ]

  const handleApplyPromo = () => {
    if (promoCode.toLowerCase() === 'welcome10') {
      setAppliedPromo('WELCOME10')
      setPromoCode('')
    }
  }

  const RightSidebarContent = ({
    cartItems = [],
    totalPrice = 0,
    totalItems = 0,
    formatPrice = (price: number) => `${price.toFixed(2)} ₴`,
    locale = 'en'
  }: {
    cartItems?: any[]
    totalPrice?: number
    totalItems?: number
    formatPrice?: (price: number) => string
    locale?: string
  } = {}) => (
    <div className="space-y-6">
      {/* Order Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            {t('orderSummary', { defaultValue: 'Order Summary' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>{t('subtotal', { defaultValue: 'Subtotal' })} ({totalItems} {totalItems === 1 ? t('item', { defaultValue: 'item' }) : t('items', { defaultValue: 'items' })})</span>
            <span>{formatPrice(totalPrice)}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span>{t('shipping', { defaultValue: 'Shipping' })}</span>
            <span className="text-green-600">
              {t('free', { defaultValue: 'Free' })}
            </span>
          </div>

          <Separator />

          <div className="flex justify-between font-medium">
            <span>{t('total', { defaultValue: 'Total' })}</span>
            <span>{formatPrice(totalPrice)}</span>
          </div>

          <Button
            className="w-full"
            onClick={() => router.push(`/${locale}/store/checkout`)}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            {t('proceedToCheckout', { defaultValue: 'Proceed to Checkout' })}
          </Button>
        </CardContent>
      </Card>

      {/* Promo Codes Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4" />
            {t('promoCodes', { defaultValue: 'Promo Codes' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {appliedPromo ? (
            <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">{appliedPromo}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAppliedPromo(null)}
              >
                {t('remove', { defaultValue: 'Remove' })}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <Input
                  placeholder={t('enterPromoCode', { defaultValue: 'Enter promo code' })}
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={handleApplyPromo}
                  disabled={!promoCode}
                >
                  <Percent className="h-4 w-4" />
                </Button>
              </div>

              <div className="text-xs text-muted-foreground">
                <p>{t('tryCode', { defaultValue: `Try code: WELCOME10 for ${formatPrice(5)} off` })}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Saved for Later Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bookmark className="h-4 w-4" />
            {t('savedForLater', { defaultValue: 'Saved for Later' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {savedItems.length > 0 ? (
            savedItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent">
                <div className="w-12 h-12 bg-muted rounded-md flex-shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-sm text-muted-foreground">{formatPrice(item.price)}</p>
                </div>
                <Button size="sm" variant="outline">
                  {t('moveToCart', { defaultValue: 'Add to Cart' })}
                </Button>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t('noSavedItems', { defaultValue: 'No items saved for later' })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Shipping Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4" />
            {t('shippingOptions', { defaultValue: 'Shipping Options' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {shippingInfo.map((option) => (
            <div key={option.type} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="text-sm font-medium">{option.name}</p>
                <p className="text-xs text-muted-foreground">{option.time}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{option.cost}</p>
                {option.type === 'standard' && (
                  <Badge variant="secondary" className="text-xs">
                    {t('recommended', { defaultValue: 'Recommended' })}
                  </Badge>
                )}
              </div>
            </div>
          ))}

          <Button
            variant="link"
            className="w-full p-0 h-auto"
            onClick={() => router.push(`/${locale}/docs/shipping`)}
          >
            {t('shippingPolicy', { defaultValue: 'Shipping Policy' })} →
          </Button>
        </CardContent>
      </Card>

      {/* Checkout Tips Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {t('checkoutTips', { defaultValue: 'Checkout Tips' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {checkoutTips.map((tip) => (
            <div key={tip.id} className="flex items-start gap-3">
              <div className="p-1 bg-primary/10 rounded">
                <tip.icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{tip.title}</p>
                <p className="text-xs text-muted-foreground">{tip.description}</p>
              </div>
            </div>
          ))}

          <Button
            variant="link"
            className="w-full p-0 h-auto"
            onClick={() => router.push(`/${locale}/docs/checkout`)}
          >
            {t('checkoutGuide', { defaultValue: 'Checkout Guide' })} →
          </Button>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="min-h-screen bg-background text-foreground relative transition-colors duration-300">
      {/* Simple Navigation Header */}
      <div className="bg-background border-b border-border mb-6">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href={`/${locale}/store`}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                {tCommon('back', { defaultValue: 'Back to Store' })}
              </Link>
            </div>

            <h1 className="text-2xl font-bold text-foreground">
              {t('title', { defaultValue: 'Shopping Cart' })}
            </h1>

            <div className="w-24"></div> {/* Spacer for centering */}
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="flex gap-6 min-h-screen">
        {/* Center Content Area - Full width without left sidebar */}
        <div className="flex-1 py-8 px-4 lg:px-0 lg:pr-6 lg:pb-8 pb-24">
          {children}
        </div>

        {/* Right Sidebar - Cart Summary & Actions (Desktop only, 1024px+) */}
        {cartItems.length > 0 && (
          <div className="hidden lg:block w-[480px] flex-shrink-0 py-8 pr-6">
            <div className="sticky top-8">
              <RightSidebarContent
                cartItems={cartItems}
                totalPrice={cartTotal}
                totalItems={totalItems}
                formatPrice={formatPrice}
                locale={locale}
              />
            </div>
          </div>
        )}
      </div>

      {/* Mobile/Tablet: Floating toggle sidebar for right sidebar content */}
      {mounted && cartItems.length > 0 && (
        <FloatingSidebarToggle
          isOpen={rightSidebarOpen}
          onToggle={setRightSidebarOpen}
          mobileWidth="90%"
          tabletWidth="380px"
        >
          <RightSidebarContent
            cartItems={cartItems}
            totalPrice={cartTotal}
            totalItems={totalItems}
            formatPrice={formatPrice}
            locale={locale}
          />
        </FloatingSidebarToggle>
      )}

      {/* Mobile/Tablet Bottom Checkout Widget */}
      {mounted && cartItems.length > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              {/* Cart Summary */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('subtotal', { defaultValue: 'Subtotal' })} ({totalItems} {totalItems === 1 ? t('item', { defaultValue: 'item' }) : t('items', { defaultValue: 'items' })})
                  </span>
                  <span className="font-medium">{formatPrice(cartTotal)}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-base font-semibold">{t('total', { defaultValue: 'Total' })}</span>
                  <span className="text-lg font-bold text-primary">{formatPrice(cartTotal)}</span>
                </div>
              </div>

              {/* Checkout Button */}
              <Button
                onClick={() => router.push(`/${locale}/store/checkout`)}
                size="lg"
                className="px-6 py-3 font-semibold shadow-lg"
              >
                {t('proceedToCheckout', { defaultValue: 'Checkout' })}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
