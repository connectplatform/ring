'use client'

import React, { useMemo } from 'react' // Only import useMemo, as memoization will be added.
import { useTranslations } from 'next-intl'
import { useOptionalStorePaymentMethods } from '@/features/store/currency-context'
import { Truck, Clock, MapPin, Package } from 'lucide-react'
import { NovaPostSelector, type NovaPostLocation } from '@/features/store/components/shipping/nova-post-selector'
import type { StorePaymentMethods } from '@/features/store/types'
import type { SupportedCurrencies } from '@/lib/ring-config-types'
import type { ShippingProvider } from '@/lib/zod'

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
  className = ''
}: ShippingMethodSelectorProps) {
  // Access translation function from next-intl for i18n/localization
  const t = useTranslations('modules.store.checkout')
  // Access store-level currency conversion context (returns undefined if not in a store domain)
  const currencyContext = useOptionalStorePaymentMethods()
  
  // Helper: Retrieve convertPrice method (currency conversion), fallback is an identity function
  const convertPrice = currencyContext?.convertPrice || ((price: number) => price)
  // Helper: Retrieve formatPrice method (price presentation), fallback is a basic string formatter
  const formatPrice = currencyContext?.formatPrice || (
    (price: number, symbol: string, name: StorePaymentMethods) => `${price.toFixed(2)} ${symbol || name}`
  )
  
  // Memoize shippingOptions so that they are not regenerated needlessly on every render,
  // especially since t() is stable from next-intl and icons are static.
  // Use useMemo from React 18+/19 for better rerender efficiency.
  const shippingOptions: ShippingOption[] = useMemo(() => [
    {
      id: 'nova-post',
      name: t('novaPost'), // Key for Nova Post service
      description: t('novaPostDescription'),
      estimatedDays: '1-3 ' + t('businessDays'),
      price: 65,
      currency: { symbol: '₴', name: 'Ukrainian Hryvnia' },
      icon: <Package className="h-5 w-5" />
    },
    {
      id: 'express',
      name: t('expressDelivery'),
      description: t('expressDescription'),
      estimatedDays: '1-2 ' + t('businessDays'),
      price: 150,
      currency: { symbol: '₴', name: 'Ukrainian Hryvnia' },
      icon: <Truck className="h-5 w-5" />
    },
    {
      id: 'standard',
      name: t('standardDelivery'),
      description: t('standardDescription'),
      estimatedDays: '3-5 ' + t('businessDays'),
      price: 45,
      currency: { symbol: '₴', name: 'Ukrainian Hryvnia' },
      icon: <Clock className="h-5 w-5" />
    },
    {
      id: 'pickup',
      name: t('storePickup'),
      description: t('pickupDescription'),
      estimatedDays: t('sameDay'),
      price: 0,
      currency: { symbol: '₴', name: 'Ukrainian Hryvnia' },
      icon: <MapPin className="h-5 w-5" />
    }
  ], [t])

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Heading for the shipping method section */}
      <h3 className="text-lg font-semibold">{t('shippingMethod')}</h3>
      
      {/* List of shipping method options */}
      <div className="space-y-3">
        {/* Render each shipping option card */}
        {shippingOptions.map((option) => (
          <div
            key={option.id}
            // Highlight selection, apply cursor, animate border/color
            className={`border rounded-lg p-4 cursor-pointer transition-all ${
              selectedMethod === option.id
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50'
            }`}
            // Click handler: triggers onMethodSelect to update the chosen method
            onClick={() => onMethodSelect(option.id)}
            // TODO: Make root a <button> for accessibility and keyboard navigation, 
            //       add aria-checked + role="radio"/"button" as needed.
          >
            <div className="flex items-center justify-between">
              {/* Left side: icon, method name/details */}
              <div className="flex items-center gap-3">
                {/* Icon with changing color/background depending on selection */}
                <div className={`p-2 rounded-lg ${
                  selectedMethod === option.id ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                  {option.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    {/* Method name and ETA */}
                    <span className="font-medium">{option.name}</span>
                    <span className="text-sm text-muted-foreground">({option.estimatedDays})</span>
                  </div>
                  {/* Small description text under option */}
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
              </div>
              
              {/* Right side: price info / promotional label */}
              <div className="text-right">
                <div className="font-semibold">
                  {/* Free label if price zero, otherwise format/convert price as needed */}
                  {option.price === 0
                    ? t('free')
                    :
                    formatPrice(
                      convertPrice(
                        option.price, 
                        // STUB: Confirm if symbol & currency are always needed for convertPrice
                        // TODO: Adapt convertPrice API for broader international currencies if multi-currency support expands
                        option.currency.symbol,
                        option.currency.name
                      ),
                      option.currency.symbol,
                      option.currency.name
                    )
                  }
                </div>
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
          </div>
        ))}
      </div>

      {/* Show extra panel for Nova Post option: location selector */}
      {/* Only display if Nova Post is selected AND a callback is provided for selecting location */}
      {selectedMethod === 'nova-post' && onLocationSelect && (
        <div className="mt-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
          <h4 className="font-medium mb-3">{t('selectNovaPostLocation')}</h4>
          <NovaPostSelector
            selected={selectedLocation}
            onSelect={onLocationSelect}
          />
          {/* Details of the currently selected NovaPost location (if any) */}
          {selectedLocation && (
            <div className="mt-3 p-3 bg-white rounded border text-sm">
              {/* Name of the warehouse/branch */}
              <div className="font-medium">{selectedLocation.name}</div>
              {/* Name and region of settlement, comma-separated if both present */}
              <div className="text-muted-foreground">
                {selectedLocation.settlement?.name}
                {selectedLocation.settlement?.region ? `, ${selectedLocation.settlement.region}` : ''}
              </div>
              {/* Full delivery address string */}
              <div className="text-gray-500">
                {selectedLocation.address}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Show pick-up place info if pickup is selected */}
      {selectedMethod === 'pickup' && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2">{t('pickupLocation')}</h4>
          <div className="text-sm text-muted-foreground">
            {/* Address and hours, localized */}
            <p>{t('pickupAddress')}</p>
            <p className="mt-1">{t('pickupHours')}</p>
          </div>
        </div>
      )}

      {/* Summary: estimated delivery time for the chosen option */}
      <div className="text-sm text-gray-500 flex items-center gap-2">
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