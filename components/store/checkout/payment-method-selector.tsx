'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CreditCard, Wallet, Shield, Loader2, CheckCircle } from 'lucide-react'
import type { StoreOrder } from '@/features/store/types'
import type { Locale } from '@/i18n-config'

interface PaymentMethodSelectorProps {
  order: StoreOrder
  locale: Locale
  onPaymentInitiated?: (paymentUrl: string) => void
}

type PaymentMethod = 'wayforpay' | 'crypto' | 'credit'

const PAYMENT_METHODS: Array<{
  id: PaymentMethod
  icon: React.ComponentType<any>
  nameKey: string
  descriptionKey: string
  available: boolean
  recommended?: boolean
}> = [
  {
    id: 'wayforpay',
    icon: CreditCard,
    nameKey: 'wayforpay.name',
    descriptionKey: 'wayforpay.description',
    available: true,
    recommended: true
  },
  {
    id: 'crypto',
    icon: Wallet,
    nameKey: 'crypto.name',
    descriptionKey: 'crypto.description',
    available: false // Will be enabled later
  },
  {
    id: 'credit',
    icon: Shield,
    nameKey: 'credit.name',
    descriptionKey: 'credit.description',
    available: false // Will be enabled later
  }
]

export default function PaymentMethodSelector({ 
  order, 
  locale,
  onPaymentInitiated 
}: PaymentMethodSelectorProps) {
  const t = useTranslations('modules.store.checkout.payment')
  const router = useRouter()
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('wayforpay')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handlePayment = async () => {
    setError(null)

    if (!selectedMethod) {
      setError(t('errors.selectMethod'))
      return
    }

    startTransition(async () => {
      try {
        if (selectedMethod === 'wayforpay') {
          // Initiate WayForPay payment
          const response = await fetch('/api/store/payments/wayforpay', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              orderId: order.id,
              returnUrl: `/${locale}/store/checkout/processing?orderId=${order.id}`,
              locale: locale === 'uk' ? 'UK' : 'EN'
            })
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Payment initiation failed')
          }

          const data = await response.json()

          if (data.success && data.paymentUrl) {
            // Notify parent component if callback provided
            if (onPaymentInitiated) {
              onPaymentInitiated(data.paymentUrl)
            }
            
            // Redirect to WayForPay payment page
            window.location.href = data.paymentUrl
          } else {
            throw new Error(data.error || 'Failed to get payment URL')
          }
        } else if (selectedMethod === 'crypto') {
          // TODO: Implement crypto payment
          setError(t('errors.methodNotAvailable'))
        } else if (selectedMethod === 'credit') {
          // TODO: Implement credit payment
          setError(t('errors.methodNotAvailable'))
        }
      } catch (err) {
        console.error('Payment error:', err)
        setError(err instanceof Error ? err.message : t('errors.paymentFailed'))
      }
    })
  }

  const formatPrice = (amount: number, currency: string) => {
    if (currency === 'UAH') {
      return `₴${amount.toFixed(2)}`
    } else if (currency === 'USD') {
      return `$${amount.toFixed(2)}`
    } else if (currency === 'EUR') {
      return `€${amount.toFixed(2)}`
    }
    return `${amount.toFixed(2)} ${currency}`
  }

  return (
    <div className="space-y-6">
      {/* Order Summary */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">{t('orderSummary')}</h3>
        
        <div className="space-y-2">
          <div className="flex justify-between">
              <span className="text-muted-foreground">{t('subtotal')}</span>
            <span className="font-medium">{formatPrice(order.subtotal, 'UAH')}</span>
          </div>
          
          {order.tax && order.tax > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('tax')}</span>
              <span className="font-medium">{formatPrice(order.tax, 'UAH')}</span>
            </div>
          )}
          
          {order.shipping && order.shipping > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('shipping')}</span>
              <span className="font-medium">{formatPrice(order.shipping, 'UAH')}</span>
            </div>
          )}
          
          <div className="border-t pt-2 mt-2">
            <div className="flex justify-between">
              <span className="text-lg font-semibold">{t('total')}</span>
              <span className="text-lg font-semibold text-blue-600">
                {formatPrice(order.total, 'UAH')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Methods */}
      <div>
        <h3 className="text-lg font-semibold mb-4">{t('selectPaymentMethod')}</h3>
        
        <div className="space-y-3">
          {PAYMENT_METHODS.map(method => {
            const IconComponent = method.icon
            const isSelected = selectedMethod === method.id
            const isDisabled = !method.available || isPending
            
            return (
              <div
                key={method.id}
                className={`
                  relative border rounded-lg p-4 cursor-pointer transition-all
                  ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
                  ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                onClick={() => !isDisabled && setSelectedMethod(method.id)}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    <div className={`
                      w-5 h-5 rounded-full border-2 
                      ${isSelected ? 'border-blue-500' : 'border-gray-300'}
                      flex items-center justify-center
                    `}>
                      {isSelected && (
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-grow">
                    <div className="flex items-center space-x-2">
                      <IconComponent className="w-5 h-5 text-muted-foreground" />
                      <span className="font-medium">{t(method.nameKey)}</span>
                      {method.recommended && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                          {t('recommended')}
                        </span>
                      )}
                      {!method.available && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                          {t('comingSoon')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t(method.descriptionKey)}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-muted-foreground hover:bg-gray-50 transition-colors"
          disabled={isPending}
        >
          {t('back')}
        </button>
        
        <button
          type="button"
          onClick={handlePayment}
          disabled={isPending || !selectedMethod}
          className={`
            flex-1 px-6 py-3 rounded-lg font-medium transition-colors
            ${isPending || !selectedMethod
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
            }
          `}
        >
          {isPending ? (
            <span className="flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              {t('processing')}
            </span>
          ) : (
            t('proceedToPayment')
          )}
        </button>
      </div>

      {/* Security Notice */}
          <div className="flex items-start space-x-2 text-sm text-muted-foreground">
        <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <p>{t('securityNotice')}</p>
      </div>
    </div>
  )
}
