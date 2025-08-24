'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n-config'
import { CheckCircle, XCircle, AlertCircle, Clock, Loader2, RefreshCw } from 'lucide-react'

type CheckoutStatus = 'success' | 'failure' | 'cancel' | 'error' | 'pending' | 'processing' | 'complete'

interface CheckoutStatusPageProps {
  status: CheckoutStatus
  locale: Locale
  orderId?: string
}

// Status configuration mapping
const STATUS_CONFIG = {
  success: {
    icon: CheckCircle,
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  complete: {
    icon: CheckCircle,
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  failure: {
    icon: XCircle,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
  },
  error: {
    icon: XCircle,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
  },
  cancel: {
    icon: AlertCircle,
    iconColor: 'text-orange-500',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200'
  },
  pending: {
    icon: Clock,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  processing: {
    icon: Loader2,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  }
} as const

export default function CheckoutStatusPage({ status, locale, orderId }: CheckoutStatusPageProps) {
  const t = useTranslations('modules.store.checkout.status')
  const tCommon = useTranslations('common')
  const tCart = useTranslations('modules.store.cart')
  
  const config = STATUS_CONFIG[status]
  const IconComponent = config.icon

  // Handle special animated icon for processing status
  const iconClassName = status === 'processing' 
    ? `${config.iconColor} animate-spin` 
    : config.iconColor

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Status Card */}
        <div className={`
          p-8 rounded-lg border-2 ${config.bgColor} ${config.borderColor}
          shadow-sm
        `}>
          {/* Status Icon */}
          <div className="flex justify-center mb-6">
            <IconComponent 
              size={64} 
              className={iconClassName}
            />
          </div>

          {/* Status Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {t(`${status}.title`)}
          </h1>

          {/* Status Description */}
          <p className="text-gray-600 mb-6">
            {t(`${status}.description`)}
          </p>

          {/* Order ID (if provided) */}
          {orderId && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border">
              <p className="text-sm text-gray-600 mb-1">
                {t('orderId')}
              </p>
              <p className="font-mono text-lg font-medium text-gray-900">
                {orderId}
              </p>
            </div>
          )}

          {/* Additional Status-Specific Content */}
          {status === 'pending' && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border">
              <div className="flex items-center justify-center space-x-2 text-blue-600">
                <RefreshCw size={16} className="animate-spin" />
                <span className="text-sm">{t('pending.waitMessage')}</span>
              </div>
            </div>
          )}

          {status === 'processing' && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border">
              <p className="text-sm text-blue-600">
                {t('processing.timeEstimate')}
              </p>
            </div>
          )}

          {/* Primary Action Buttons */}
          <div className="space-y-3">
            {/* Success/Complete - Continue Shopping */}
            {(status === 'success' || status === 'complete') && (
              <>
                <Link 
                  href={ROUTES.STORE_ORDERS(locale)}
                  className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.viewOrder')}
                </Link>
                <Link 
                  href={ROUTES.STORE(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {tCart('continueShopping')}
                </Link>
              </>
            )}

            {/* Failure/Error - Try Again */}
            {(status === 'failure' || status === 'error') && (
              <>
                <Link 
                  href={ROUTES.CART(locale)}
                  className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.tryAgain')}
                </Link>
                <Link 
                  href={ROUTES.STORE(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {tCart('continueShopping')}
                </Link>
              </>
            )}

            {/* Cancel - Back to Cart */}
            {status === 'cancel' && (
              <>
                <Link 
                  href={ROUTES.CART(locale)}
                  className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {tCart('backToCart')}
                </Link>
                <Link 
                  href={ROUTES.STORE(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {tCart('continueShopping')}
                </Link>
              </>
            )}

            {/* Pending/Processing - Check Status */}
            {(status === 'pending' || status === 'processing') && (
              <>
                {orderId && (
                  <Link 
                    href={ROUTES.STORE_ORDER_DETAILS(locale, orderId)}
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    {t('actions.checkStatus')}
                  </Link>
                )}
                <Link 
                  href={ROUTES.STORE(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {tCart('continueShopping')}
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Help Link */}
        <div className="mt-6">
          <Link 
            href={ROUTES.CONTACT(locale)}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            {t('needHelp')}
          </Link>
        </div>
      </div>
    </div>
  )
}
