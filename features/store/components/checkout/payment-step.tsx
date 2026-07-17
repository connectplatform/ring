'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { CreditCard, Wallet, Coins, Smartphone } from 'lucide-react'
import { CompactSecurityBadges } from './security-badges'
import { getClientNativeTokenSymbol } from '@/lib/ring-config-client'

export type PaymentMethod = 'wayforpay' | 'card' | 'crypto' | 'stripe' | 'credit' | 'token' | 'paypal'

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
  const nativeSymbol = getClientNativeTokenSymbol()

  const paymentOptions: PaymentOption[] = [
    {
      id: 'card',
      name: t('cardPayment', { default: 'Card' }),
      description: t('cardPaymentDescription', {
        default: 'Pay by card (WayForPay or Stripe via PaymentConductor)',
      }),
      icon: <CreditCard className="h-5 w-5" />,
      enabled: true,
      badges: ['Visa', 'Mastercard', 'Apple Pay', 'Google Pay'],
    },
    {
      id: 'credit',
      name: t('creditBalance', { default: 'Credit balance' }),
      description: t('creditBalanceDescription', {
        default: 'Pay with account credit units (points)',
      }),
      icon: <Coins className="h-5 w-5" />,
      enabled: process.env.NEXT_PUBLIC_PAYMENT_STORE_ALLOW_CREDIT !== 'false',
      badges: ['points'],
    },
    {
      id: 'token',
      name: t('nativeToken', { default: 'Native token' }),
      description: t('nativeTokenDescription', {
        default: 'Pay with on-chain native token',
      }),
      icon: <Wallet className="h-5 w-5" />,
      enabled: process.env.NEXT_PUBLIC_PAYMENT_STORE_ALLOW_TOKEN === 'true',
      badges: [nativeSymbol],
    },
    {
      id: 'paypal',
      name: t('paypalPayment', { default: 'PayPal' }),
      description: t('paypalPaymentDescription', {
        default: 'Pay with PayPal (international)',
      }),
      icon: <Smartphone className="h-5 w-5" />,
      enabled: process.env.NEXT_PUBLIC_PAYMENT_STORE_ALLOW_PAYPAL === 'true',
      badges: ['PayPal'],
    },
    {
      id: 'crypto',
      name: t('cryptoPayment'),
      description: t('cryptoPaymentDescription'),
      icon: <Wallet className="h-5 w-5" />,
      enabled: false,
      badges: [nativeSymbol],
    },
    {
      id: 'stripe',
      name: t('stripePayment'),
      description: t('stripePaymentDescription'),
      icon: <Smartphone className="h-5 w-5" />,
      enabled: false,
      badges: ['Test Mode'],
    },
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
            <div className="flex items-start gap-3">
              <div className="mt-0.5">{option.icon}</div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{option.name}</h4>
                  {method === option.id && option.enabled && (
                    <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
                {option.badges && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {option.badges.map((badge) => (
                      <span
                        key={badge}
                        className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <CompactSecurityBadges />
    </div>
  )
}
