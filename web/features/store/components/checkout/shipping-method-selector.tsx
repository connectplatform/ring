'use client'

import React, { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { MAIN_CURRENCY, useOptionalStorePaymentMethods } from '@/features/store/currency-context'
import { Clock, MapPin, Package } from 'lucide-react'
import { NovaPostSelector, type NovaPostLocation } from '@/features/store/components/shipping/nova-post-selector'
import type { StorePaymentMethods } from '@/features/store/types'
import type { SupportedCurrencies } from '@/lib/ring-config-types'
import type { ShippingProvider } from '@/lib/zod'
import type { StoreShippingSettings } from '@/features/store/types/store-settings'
import { DEFAULT_STORE_SETTINGS } from '@/features/store/types/store-settings'

/**
 * Buyer-selectable shipping methods — a subset of the zod `ShippingProvider` SSOT.
 * `manual` is vendor-arranged and never rendered as a checkout option.
 */
export type ShippingMethod = Exclude<ShippingProvider, 'manual'>

// TODO: Provide a selector that determines which shipping methods are present, based on the user's country.
//       1. Accept country prop or obtain country from checkout context.
//       2. Return/Filter available shipping methods accordingly.

// Type describing the properties of a shipping option
interface ShippingOption {
  id: ShippingMethod
  name: string
  description: string
  estimatedDays: string
  price: number
  currency: { symbol: string, name: SupportedCurrencies }
  icon: React.ReactNode
}

// Props for the ShippingMethodSelector component
interface ShippingMethodSelectorProps {
  selectedMethod: ShippingMethod
  onMethodSelect: (method: ShippingMethod) => void
  selectedLocation?: NovaPostLocation | null
  onLocationSelect?: (location: NovaPostLocation | null) => void
  novaPostEnabled?: boolean
  /** Prices, ETAs, and pickup copy from store settings. */
  shippingConfig?: StoreShippingSettings
  /** Title is rendered by the checkout card header. */
  hideTitle?: boolean
  className?: string
}

// TODO: Use React.memo or `export default React.memo(ShippingMethodSelector)` for stable rendering if receiving stable props, 
//       especially with large checkout forms—implement if rerendering becomes an issue.
// TODO: Consider using React 19's use action for effects instead of legacy useEffect where needed.
// TODO: Migrate this (and other event handlers) to use native <button> in the option root for a11y/tabindex reasons
//       if keyboard support or screen reader support becomes a requirement.

function ShippingMethodSelector({
  selectedMethod,
  onMethodSelect,
  selectedLocation,
  onLocationSelect,
  novaPostEnabled = false,
  shippingConfig,
  hideTitle = false,
  className = ''
}: ShippingMethodSelectorProps) {
  const t = useTranslations('modules.store.checkout')
  const currencyContext = useOptionalStorePaymentMethods()
  
  const convertPrice =
    currencyContext?.convertPrice || ((price: number) => price)
  const formatPrice =
    currencyContext?.formatPrice ||
    ((price: number, code: StorePaymentMethods) => `${price.toFixed(2)} ${code}`)
  const mainCurrency = currencyContext?.mainCurrency ?? MAIN_CURRENCY
  const activeCurrency = currencyContext?.currency ?? MAIN_CURRENCY
  
  // Memoize shippingOptions so that they are not regenerated needlessly on every render,
  // especially since t() is stable from next-intl and icons are static.
  // Use useMemo from React 18+/19 for better rerender efficiency.
  const nova = shippingConfig?.novaPost ?? DEFAULT_STORE_SETTINGS.shipping.novaPost
  const pickup = shippingConfig?.pickup ?? DEFAULT_STORE_SETTINGS.shipping.pickup
  const showNova = novaPostEnabled && nova.enabled
  const showPickup = pickup.enabled

  const shippingOptions: ShippingOption[] = useMemo(() => {
    const options: ShippingOption[] = []
    if (showNova) {
      const days = nova.estimatedDays.trim() || '1-3'
      options.push({
        id: 'nova-post',
        name: t('novaPost'),
        description: t('novaPostDescription'),
        estimatedDays: `${days} ${t('businessDays')}`,
        price: nova.price,
        currency: { symbol: '₴', name: 'Ukrainian Hryvnia' },
        icon: <Package className="h-5 w-5" />,
      })
    }
    if (showPickup) {
      options.push({
        id: 'pickup',
        name: t('storePickup'),
        description: t('pickupDescription'),
        estimatedDays: pickup.estimatedDays.trim() || t('sameDay'),
        price: pickup.price,
        currency: { symbol: '₴', name: 'Ukrainian Hryvnia' },
        icon: <MapPin className="h-5 w-5" />,
      })
    }
    return options
  }, [t, showNova, showPickup, nova.price, nova.estimatedDays, pickup.price, pickup.estimatedDays])

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Heading for the shipping method section */}
      {hideTitle ? null : (
        <h3 className="text-lg font-semibold">{t('shippingMethod')}</h3>
      )}
      
      {/* List of shipping method options */}
      <div className="space-y-3">
        {/* Render each shipping option card */}
        {shippingOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`w-full border rounded-lg p-4 text-left cursor-pointer transition-all ${
              selectedMethod === option.id
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50'
            }`}
            onClick={() => onMethodSelect(option.id)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium">{option.name}</div>
                <div className="text-sm text-muted-foreground">({option.estimatedDays})</div>
                <p className="text-sm text-muted-foreground">{option.description}</p>
              </div>
              <div className="shrink-0 text-right font-semibold">
                {option.price === 0
                  ? t('free')
                  : formatPrice(
                      convertPrice(option.price, mainCurrency, activeCurrency),
                      activeCurrency,
                    )}
                {/* STUB: Promotional badge for discounted or special shipping rates */}
                {/*
                  // STUB: If/when option is on sale or flagged for promo, render badge here.
                  // TODO:
                  //   1. Add `isPromotional` or `oldPrice`/`salePrice` to ShippingOption type.
                  //   2. Conditionally render badge (label or strikethrough old price).
                  //   3. Refactor price logic to display both prices for promotions.
                  //   4. Ensure a11y for any promotional banner (aria-label).
                */}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Show extra panel for Nova Post option: location selector */}
      {/* Only display if Nova Post is selected AND a callback is provided for selecting location */}
      {novaPostEnabled && selectedMethod === 'nova-post' && onLocationSelect && (
        <div className="mt-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
          <h4 className="font-medium mb-3">{t('selectNovaPostLocation')}</h4>
          <NovaPostSelector
            selected={selectedLocation}
            onSelect={onLocationSelect}
          />
          {/* Details of the currently selected NovaPost location (if any) */}
          {selectedLocation && (
            <div className="mt-3 grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-3 rounded border bg-background p-3 text-sm text-foreground">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-vendors/nova-poshta-logo.svg"
                alt=""
                aria-hidden
                className="h-12 w-12 object-contain"
              />
              <div className="min-w-0">
                <div className="font-medium">{selectedLocation.name}</div>
                {selectedLocation.address ? (
                  <div className="text-muted-foreground">{selectedLocation.address}</div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Show pick-up place info if pickup is selected */}
      {selectedMethod === 'pickup' && (
        <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4">
          <h4 className="font-medium mb-2">{t('pickupLocation')}</h4>
          <div className="text-sm text-muted-foreground">
            <p>{pickup.address?.trim() || t('pickupAddress')}</p>
            <p className="mt-1">{pickup.hours?.trim() || t('pickupHours')}</p>
          </div>
        </div>
      )}

      <div className="text-sm text-muted-foreground flex items-center gap-2">
        <Clock className="h-4 w-4" />
        <span>
          {t('estimatedDelivery')}: {' '}
          {/* Locate selected shipping option and output its ETA */}
          {shippingOptions.find(opt => opt.id === selectedMethod)?.estimatedDays}
        </span>
      </div>
    </div>
  )
}

export default React.memo(ShippingMethodSelector)