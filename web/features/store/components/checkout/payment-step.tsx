'use client'

import React, { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { CreditCard, Wallet, Coins, Smartphone } from 'lucide-react'
import { CompactSecurityBadges } from './security-badges'
import {
  getClientCardPaymentProcessor,
  getClientCreditUnitLabel,
  getClientNativeTokenSymbol,
  getClientStorePaymentRails,
  type ClientStorePaymentRailId,
} from '@/lib/ring-config-client'

/**
 * UI selects rails only — never PSP ids. The Conductor resolves which processor
 * settles the `card` rail (WayForPay or Stripe).
 */
export type PaymentMethod = ClientStorePaymentRailId

interface PaymentOption {
  id: ClientStorePaymentRailId
  name: string
  description: string
  icon: React.ReactNode
  enabled: boolean
  badges?: string[]
}

interface PaymentStepProps {
  method: ClientStorePaymentRailId
  setMethod: (method: ClientStorePaymentRailId) => void
}

export function PaymentStep({ method, setMethod }: PaymentStepProps) {
  const t = useTranslations('modules.store.checkout')
  const nativeSymbol = getClientNativeTokenSymbol()
  const cardProcessor = getClientCardPaymentProcessor()
  const creditUnitLabel = getClientCreditUnitLabel()
  const rails = useMemo(() => getClientStorePaymentRails(), [])

  const paymentOptions: PaymentOption[] = rails.map((rail) => {
    const id = rail.id
    switch (rail.id) {
      case 'card':
        return {
          id,
          name: t('cardPayment', { default: 'Card' }),
          description: t('cardPaymentDescription', {
            default: `Pay by card (${cardProcessor} via PaymentConductor)`,
          }),
          icon: <CreditCard className="h-5 w-5" />,
          enabled: rail.enabled,
          badges: ['Visa', 'Mastercard', 'Apple Pay', 'Google Pay'],
        }
      case 'credit_balance':
        return {
          id,
          name: t('creditBalance', { default: 'Credit balance' }),
          description: t('creditBalanceDescription', {
            default: `Pay with account credit balance (${creditUnitLabel})`,
          }),
          icon: <Coins className="h-5 w-5" />,
          enabled: rail.enabled,
          badges: [creditUnitLabel],
        }
      case 'native_token':
        return {
          id,
          name: t('nativeToken', { default: 'Native token' }),
          description: t('nativeTokenDescription', {
            default: 'Pay with on-chain native token',
          }),
          icon: <Wallet className="h-5 w-5" />,
          enabled: rail.enabled,
          badges: [nativeSymbol],
        }
      case 'paypal':
        return {
          id,
          name: t('paypalPayment', { default: 'PayPal' }),
          description: t('paypalPaymentDescription', {
            default: 'Pay with PayPal (international)',
          }),
          icon: <Smartphone className="h-5 w-5" />,
          enabled: rail.enabled,
          badges: ['PayPal'],
        }
    }
  })

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
                        className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground"
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
