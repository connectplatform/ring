'use client'
import React from 'react'
import { useTranslations } from 'next-intl'
import { useStore } from '@/features/store/context'
import { DEFAULT_STORE_SETTINGS, quoteFromSettings } from '@/features/store/types/store-settings'
import { priceCartLine, cartLineVendorId } from '@/features/store/lib/cart-pricing'
import {
  MAIN_CURRENCY,
  resolveStorePriceCurrency,
  useOptionalStorePaymentMethods,
  type StorePaymentMethods,
} from '@/features/store/currency-context'
import { ReferralCheckoutBadge } from '@/components/refcodes/referral-checkout-badge'

export function ReviewStep({
  onPlaceOrder,
  submitting,
  asFormSubmit = false,
  shippingMethod,
}: {
  onPlaceOrder?: () => void
  submitting: boolean
  /** When true, renders a submit button for progressive form actions. */
  asFormSubmit?: boolean
  shippingMethod?: string
}) {
  const t = useTranslations('modules.store.checkout')
  const { cartItems, appliedPromoCode, storefrontSettings } = useStore()
  const settings = storefrontSettings ?? DEFAULT_STORE_SETTINGS
  const storeCurrency = useOptionalStorePaymentMethods()
  const formatPrice =
    storeCurrency?.formatPrice ??
    ((price: number, currency: StorePaymentMethods) => `${price.toFixed(2)} ${currency}`)
  const convertPrice =
    storeCurrency?.convertPrice ??
    ((amount: number) => amount)
  const activeCurrency = storeCurrency?.currency ?? MAIN_CURRENCY
  const mainCurrency = storeCurrency?.mainCurrency ?? MAIN_CURRENCY
  const formatMainToActive = (amountMain: number) =>
    formatPrice(convertPrice(amountMain, mainCurrency, activeCurrency), activeCurrency)

  const quote = quoteFromSettings({
    lines: cartItems.map((item) => {
      const raw = item.finalPrice || parseFloat(String(item.product.price)) || 0
      const from = resolveStorePriceCurrency((item.product.currency || mainCurrency) as StorePaymentMethods)
      return {
        unitPrice: convertPrice(raw, from, mainCurrency),
        quantity: item.quantity,
        promotions: item.product.promotions,
        vendorEntityId: cartLineVendorId(item.product),
      }
    }),
    settings,
    method: shippingMethod,
    promoCode: appliedPromoCode,
  })
  const grandTotalMain = quote.total

  return (
    <div className="space-y-6">
      <ReferralCheckoutBadge />
      <div className="bg-card border rounded-lg p-6">
        <h3 className="font-semibold text-lg mb-4">{t('orderSummary')}</h3>
        <div className="space-y-4">
          {cartItems.map((i) => {
            const raw = i.finalPrice || parseFloat(String(i.product.price)) || 0
            const from = resolveStorePriceCurrency((i.product.currency || mainCurrency) as StorePaymentMethods)
            const unitMain = convertPrice(raw, from, mainCurrency)
            const priced = priceCartLine(unitMain, i.quantity, i.product.promotions)
            const lineDisplay = convertPrice(priced.lineTotal, mainCurrency, activeCurrency)
            const unitDisplay = convertPrice(unitMain, mainCurrency, activeCurrency)

            return (
              <div
                key={i.product.id}
                className="flex items-start justify-between pb-4 border-b last:border-b-0 last:pb-0"
              >
                <div className="flex-1">
                  <div className="font-medium">{i.product.name}</div>

                  {i.selectedVariants && Object.keys(i.selectedVariants).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Object.entries(i.selectedVariants).map(([name, value]) => (
                        <span
                          key={name}
                          className="inline-flex items-center px-2 py-0.5 bg-muted rounded text-xs font-medium"
                        >
                          {name}: <span className="ml-1 text-primary">{value}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="text-sm text-muted-foreground mt-2">
                    {t('quantity')}: {i.quantity} × {formatPrice(unitDisplay, activeCurrency)}
                  </div>
                </div>
                <div className="font-semibold ml-4">
                  {formatPrice(lineDisplay, activeCurrency)}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-6 pt-4 border-t space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span>{t('subtotal')}</span>
            <span>{formatMainToActive(quote.subtotal)}</span>
          </div>
          {quote.discount > 0 ? (
            <div className="flex items-center justify-between">
              <span>
                {t('discount', { defaultValue: 'Discount' })}
                {quote.appliedCode ? ` (${quote.appliedCode})` : ''}
              </span>
              <span>-{formatMainToActive(quote.discount)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <span>{t('shipping')}</span>
            <span>{quote.shipping <= 0 ? t('free') : formatMainToActive(quote.shipping)}</span>
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="font-semibold text-lg">{t('total')}</span>
            <span className="font-bold text-xl text-primary">
              {formatMainToActive(grandTotalMain)}
            </span>
          </div>
        </div>
      </div>

      {/* Place Order Button */}
      <button
        type={asFormSubmit ? 'submit' : 'button'}
        disabled={submitting}
        className="w-full px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={asFormSubmit ? undefined : onPlaceOrder}
      >
        {submitting ? t('processing') : t('placeOrder', { defaultValue: 'Place Order' })}
      </button>
    </div>
  )
}
