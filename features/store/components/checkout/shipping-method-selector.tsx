'use client'

import React, { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useOptionalCurrency } from '@/features/store/currency-context'
import { Truck, Clock, MapPin, Package } from 'lucide-react'
import { NovaPostSelector, type NovaPostLocation } from '@/features/store/components/shipping/nova-post-selector'

export type ShippingMethod = 'nova-post' | 'express' | 'standard' | 'pickup'

interface ShippingOption {
  id: ShippingMethod
  name: string
  description: string
  estimatedDays: string
  price: number
  currency: string
  icon: React.ReactNode
}

interface ShippingMethodSelectorProps {
  selectedMethod: ShippingMethod
  onMethodSelect: (method: ShippingMethod) => void
  selectedLocation?: NovaPostLocation | null
  onLocationSelect?: (location: NovaPostLocation | null) => void
  className?: string
}

export function ShippingMethodSelector({
  selectedMethod,
  onMethodSelect,
  selectedLocation,
  onLocationSelect,
  className = ''
}: ShippingMethodSelectorProps) {
  const t = useTranslations('modules.store.checkout')
  const currencyContext = useOptionalCurrency()
  
  // Currency conversion helpers
  const convertPrice = currencyContext?.convertPrice || ((price: number) => price)
  const formatPrice = currencyContext?.formatPrice || ((price: number) => `${price.toFixed(2)} ₴`)
  
  const shippingOptions: ShippingOption[] = [
    {
      id: 'nova-post',
      name: t('novaPost'),
      description: t('novaPostDescription'),
      estimatedDays: '1-3 ' + t('businessDays'),
      price: 65,
      currency: 'UAH',
      icon: <Package className="h-5 w-5" />
    },
    {
      id: 'express',
      name: t('expressDelivery'),
      description: t('expressDescription'),
      estimatedDays: '1-2 ' + t('businessDays'),
      price: 150,
      currency: 'UAH',
      icon: <Truck className="h-5 w-5" />
    },
    {
      id: 'standard',
      name: t('standardDelivery'),
      description: t('standardDescription'),
      estimatedDays: '3-5 ' + t('businessDays'),
      price: 45,
      currency: 'UAH',
      icon: <Clock className="h-5 w-5" />
    },
    {
      id: 'pickup',
      name: t('storePickup'),
      description: t('pickupDescription'),
      estimatedDays: t('sameDay'),
      price: 0,
      currency: 'UAH',
      icon: <MapPin className="h-5 w-5" />
    }
  ]

  return (
    <div className={`space-y-4 ${className}`}>
      <h3 className="text-lg font-semibold">{t('shippingMethod')}</h3>
      
      <div className="space-y-3">
        {shippingOptions.map((option) => (
          <div
            key={option.id}
            className={`border rounded-lg p-4 cursor-pointer transition-all ${
              selectedMethod === option.id
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50'
            }`}
            onClick={() => onMethodSelect(option.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  selectedMethod === option.id ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                  {option.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{option.name}</span>
                    <span className="text-sm text-muted-foreground">({option.estimatedDays})</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
              </div>
              
              <div className="text-right">
                <div className="font-semibold">
                  {option.price === 0 ? t('free') : formatPrice(convertPrice(option.price))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Nova Post Location Selector */}
      {selectedMethod === 'nova-post' && onLocationSelect && (
        <div className="mt-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
          <h4 className="font-medium mb-3">{t('selectNovaPostLocation')}</h4>
          <NovaPostSelector
            selected={selectedLocation}
            onSelect={onLocationSelect}
          />
          {selectedLocation && (
            <div className="mt-3 p-3 bg-white rounded border text-sm">
              <div className="font-medium">{selectedLocation.name}</div>
              <div className="text-muted-foreground">
                {selectedLocation.settlement?.name}{selectedLocation.settlement?.region ? `, ${selectedLocation.settlement.region}` : ''}
              </div>
              <div className="text-gray-500">
                {selectedLocation.address}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pickup Location Info */}
      {selectedMethod === 'pickup' && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2">{t('pickupLocation')}</h4>
            <div className="text-sm text-muted-foreground">
            <p>{t('pickupAddress')}</p>
            <p className="mt-1">{t('pickupHours')}</p>
          </div>
        </div>
      )}

      {/* Delivery Estimate */}
      <div className="text-sm text-gray-500 flex items-center gap-2">
        <Clock className="h-4 w-4" />
        <span>
          {t('estimatedDelivery')}: {' '}
          {shippingOptions.find(opt => opt.id === selectedMethod)?.estimatedDays}
        </span>
      </div>
    </div>
  )
}
