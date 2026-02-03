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
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`
                : 'border-border bg-muted opacity-60 cursor-not-allowed'
            }`}
            onClick={() => option.enabled && setMethod(option.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  method === option.id && option.enabled
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {option.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{option.name}</span>
                    {!option.enabled && (
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
                        {t('comingSoon')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                  {option.badges && (
                    <div className="flex items-center gap-2 mt-2">
                      {option.badges.map((badge) => (
                        <span
                          key={badge}
                          className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded"
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
                  className="h-4 w-4 text-primary accent-primary"
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
        <div className="mt-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-4 w-4 text-primary" />
            <span className="font-medium">{t('secureCardPayment')}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('wayforpaySecurityNote')}
          </p>
        </div>
      )}
    </div>
  )
}


