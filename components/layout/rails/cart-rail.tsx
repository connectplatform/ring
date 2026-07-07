'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  ShoppingCart,
  Tag,
  Bookmark,
  Truck,
  Shield,
  BookOpen,
  CreditCard,
  Percent,
  CheckCircle,
  Info,
  Package,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import type { Locale } from '@/i18n/shared'

export interface CartSidebarContentProps {
  locale: Locale
  cartItems?: any[]
  totalPrice?: number
  totalItems?: number
  formatPrice?: (price: number) => string
  appliedPromo?: string | null
  promoCode?: string
  onApplyPromo?: (code: string) => void
  onRemovePromo?: () => void
  onPromoCodeChange?: (code: string) => void
  onNavigate?: () => void
  // For the full modern version we can pass more data later
}

/**
 * Cart right rail content (for mobile floating sidebar and future rail use).
 * Desktop order summary stays in the inner grid for now (per original cart design).
 */
export default function CartSidebarContent({
  locale,
  cartItems = [],
  totalPrice = 0,
  totalItems = 0,
  formatPrice = (p) => `${p.toFixed(2)} ₴`,
  appliedPromo,
  promoCode = '',
  onApplyPromo,
  onRemovePromo,
  onPromoCodeChange,
  onNavigate,
}: CartSidebarContentProps) {
  const router = useRouter()
  const t = useTranslations('modules.store.cart')

  const handleCheckout = () => {
    router.push(`/${locale}/store/checkout`)
    onNavigate?.()
  }

  return (
    <div className="space-y-6">
      {/* Order Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            {t('orderSummary', { defaultValue: 'Order Summary' })}
          </CardTitle>
          <CardDescription>
            {t('orderSummaryDescription', { defaultValue: 'Review your order summary before proceeding to checkout.' })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>
              {t('subtotal', { defaultValue: 'Subtotal' })} ({totalItems} {totalItems === 1 ? t('item', { defaultValue: 'item' }) : t('items', { defaultValue: 'items' })})
            </span>
            <span>{formatPrice(totalPrice)}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span>{t('shipping', { defaultValue: 'Shipping' })}</span>
            <span className="text-green-600">{t('free', { defaultValue: 'Free' })}</span>
          </div>

          <Separator />

          <div className="flex justify-between font-medium">
            <span>{t('total', { defaultValue: 'Total' })}</span>
            <span>{formatPrice(totalPrice)}</span>
          </div>

          <Button className="w-full" onClick={handleCheckout}>
            <CreditCard className="h-4 w-4 mr-2" />
            {t('proceedToCheckout', { defaultValue: 'Proceed to Checkout' })}
          </Button>
        </CardContent>
      </Card>

      {/* Promo Codes */}
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
              <Button variant="ghost" size="sm" onClick={onRemovePromo}>
                {t('remove', { defaultValue: 'Remove' })}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <Input
                  placeholder={t('enterPromoCode', { defaultValue: 'Enter promo code' })}
                  value={promoCode}
                  onChange={(e) => onPromoCodeChange?.(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={() => onApplyPromo?.(promoCode)}
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

      {/* Saved for Later (simplified for rail) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bookmark className="h-4 w-4" />
            {t('savedForLater', { defaultValue: 'Saved for Later' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            {t('noSavedItems', { defaultValue: 'No items saved for later' })}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
