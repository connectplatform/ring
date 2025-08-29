'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { CreditCard, Wallet, Coins, Smartphone } from 'lucide-react'
import { CompactSecurityBadges } from './security-badges'

export type PaymentMethod = 'wayforpay' | 'crypto' | 'stripe' | 'ring'

interface PaymentOption {
  id: PaymentMethod
  name: string
  description: string
  icon: React.ReactNode
  enabled: boolean
  badges?: string[]
}

interface PaymentStepProps {
  method: PaymentMethod
  setMethod: (method: PaymentMethod) => void
}

export function PaymentStep({ method, setMethod }: PaymentStepProps) {
  const t = useTranslations('modules.store.checkout')
  
  const paymentOptions: PaymentOption[] = [
    {
      id: 'wayforpay',
      name: t('cardPayment'),
      description: t('cardPaymentDescription'),
      icon: <CreditCard className="h-5 w-5" />,
      enabled: true,
      badges: ['Visa', 'Mastercard', 'Apple Pay', 'Google Pay']
    },
    {
      id: 'crypto',
      name: t('cryptoPayment'),
      description: t('cryptoPaymentDescription'),
      icon: <Wallet className="h-5 w-5" />,
      enabled: true,
      badges: ['DAAR', 'DAARION']
    },
    {
      id: 'ring',
      name: t('ringTokens'),
      description: t('ringTokensDescription'),
      icon: <Coins className="h-5 w-5" />,
      enabled: true,
      badges: ['RING']
    },
    {
      id: 'stripe',
      name: t('stripePayment'),
      description: t('stripePaymentDescription'),
      icon: <Smartphone className="h-5 w-5" />,
      enabled: false, // Will be enabled later
      badges: ['Test Mode']
    }
  ]

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{t('paymentMethod')}</h3>
      
      <div className="space-y-3">
        {paymentOptions.map((option) => (
          <div
            key={option.id}
            className={`border rounded-lg p-4 transition-all ${
              option.enabled 
                ? `cursor-pointer ${
                    method === option.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`
                : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
            }`}
            onClick={() => option.enabled && setMethod(option.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  method === option.id && option.enabled
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {option.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{option.name}</span>
                    {!option.enabled && (
                      <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                        {t('comingSoon')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{option.description}</p>
                  {option.badges && (
                    <div className="flex items-center gap-2 mt-2">
                      {option.badges.map((badge) => (
                        <span
                          key={badge}
                          className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="ml-4">
                <input
                  type="radio"
                  checked={method === option.id}
                  onChange={() => option.enabled && setMethod(option.id)}
                  disabled={!option.enabled}
                  className="h-4 w-4 text-blue-600"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Payment Security Info */}
      <div className="mt-6">
        <CompactSecurityBadges className="justify-center" />
      </div>

      {/* WayForPay Specific Info */}
      {method === 'wayforpay' && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-blue-900">{t('secureCardPayment')}</span>
          </div>
          <p className="text-sm text-blue-700">
            {t('wayforpaySecurityNote')}
          </p>
        </div>
      )}
    </div>
  )
}


