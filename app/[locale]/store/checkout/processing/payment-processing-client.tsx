'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react'
import type { Locale } from '@/i18n/shared'
import { useToast } from '@/hooks/use-toast'
import { consumeReferralCheckoutFlash } from '@/features/refcodes/lib/checkout-referral-flash'

interface PaymentProcessingClientProps {
  orderId: string
  locale: Locale
  initialStatus?: string // TODO: Consider using initialStatus as the initial state if provided
}

type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'refunded'

export default function PaymentProcessingClient({
  orderId,
  locale,
  initialStatus
}: PaymentProcessingClientProps) {
  const t = useTranslations('modules.store.checkout.processing')
  const tCheckout = useTranslations('modules.store.checkout')
  const { success: toastSuccess } = useToast()
  const router = useRouter()
  // TODO: Use initialStatus as default if provided, or 'processing' if not
  const [status, setStatus] = useState<PaymentStatus>('processing')
  const [error, setError] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [isChecking, setIsChecking] = useState(false)

  // Use refs to prevent stale state values inside interval and async callbacks
  const statusRef = useRef<PaymentStatus>('processing')
  const isCheckingRef = useRef(false)

  // Keep ref in sync with current status
  useEffect(() => {
    statusRef.current = status
  }, [status])

  // Keep ref in sync with isChecking
  useEffect(() => {
    isCheckingRef.current = isChecking
  }, [isChecking])

  /**
   * Polls the backend API for payment status for this order.
   * If finished, triggers a final redirect to the appropriate checkout status page.
   */
  const checkPaymentStatus = useCallback(async () => {
    if (isCheckingRef.current) return  // Prevent concurrent checks

    setIsChecking(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/store/payments/${orderId}/status`)
      
      // Handle HTTP error codes with custom messages
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(t('errors.orderNotFound'))
        } else if (response.status === 401) {
          throw new Error(t('errors.unauthorized'))
        }
        throw new Error(t('errors.statusCheckFailed'))
      }

      // Parse returned payment status
      const data = await response.json()
      const newStatus = data.status as PaymentStatus
      
      setStatus(newStatus)

      // If final status reached, redirect to status page after slight delay
      if (['paid', 'failed', 'cancelled', 'refunded'].includes(newStatus)) {
        // Remap status to route slug
        let redirectStatus = 'processing' // fallback/default
        if (newStatus === 'paid') {
          redirectStatus = 'success'
        } else if (newStatus === 'failed') {
          redirectStatus = 'failure'
        } else if (newStatus === 'cancelled') {
          redirectStatus = 'cancel'
        }
        setTimeout(() => {
          router.push(`/${locale}/store/checkout/${redirectStatus}?orderId=${orderId}`)
        }, 1500)
      }
    } catch (err) {
      // Log to console for debugging, show user-friendly error on UI
      console.error('Error checking payment status:', err)
      setError(err instanceof Error ? err.message : t('errors.unknown'))
    } finally {
      setIsChecking(false)
      setAttempts(prev => prev + 1)
    }
  }, [orderId, locale, t, router])

  /**
   * On mount: check flash message for referral and show toast if present
   */
  useEffect(() => {
    const flash = consumeReferralCheckoutFlash()
    if (flash) {
      toastSuccess({
        title: tCheckout('referralApplied'),
        description: flash.referralCode
          ? tCheckout('referralAppliedToast', { code: flash.referralCode })
          : tCheckout('referralAppliedToastGeneric'),
        duration: 8000,
      })
    }
  }, [toastSuccess, tCheckout])

  /**
   * Primary polling interval effect.
   * - Checks payment status immediately on mount.
   * - Then starts repeating check every 3s up to 40 times (2min).
   * - Stops polling if status is not in-progress, or max attempts exceeded.
   */
  useEffect(() => {
    checkPaymentStatus() // Check status immediately first

    const maxAttempts = 40 // 3s * 40 = 2min
    let localAttempts = 0
    // TODO: Consider using native React 19 useEffectEvent/useInterval for polling
    const interval = setInterval(() => {
      // Keep polling, unless we've hit a final status or the attempt max
      if (
        localAttempts < maxAttempts &&
        !['paid', 'failed', 'cancelled', 'refunded'].includes(statusRef.current)
      ) {
        localAttempts += 1
        setAttempts(localAttempts)
        checkPaymentStatus()
      } else {
        clearInterval(interval)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [checkPaymentStatus])

  /**
   * Allows user to manually trigger status re-check if still "processing"
   */
  const handleManualCheck = () => {
    setAttempts(0)
    checkPaymentStatus()
  }

  /**
   * Cancel or back-to-store handler (contextual label based on status)
   */
  const handleCancel = () => {
    router.push(`/${locale}/store/checkout/cancel?orderId=${orderId}`)
  }

  /**
   * Returns a react icon node for current payment state
   */
  const getStatusIcon = () => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-16 h-16 text-green-500" />
      case 'failed':
        return <XCircle className="w-16 h-16 text-red-500" />
      case 'cancelled':
        return <AlertCircle className="w-16 h-16 text-orange-500" />
      case 'processing':
      case 'pending':
      default:
        return <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
    }
  }

  /**
   * Returns translated status title
   */
  const getStatusMessage = () => {
    switch (status) {
      case 'paid':
        return t('status.paid')
      case 'failed':
        return t('status.failed')
      case 'cancelled':
        return t('status.cancelled')
      case 'refunded':
        return t('status.refunded')
      case 'processing':
        return t('status.processing')
      case 'pending':
      default:
        return t('status.pending')
    }
  }

  /**
   * Returns translated status description
   */
  const getStatusDescription = () => {
    switch (status) {
      case 'paid':
        return t('description.paid')
      case 'failed':
        return t('description.failed')
      case 'cancelled':
        return t('description.cancelled')
      case 'refunded':
        return t('description.refunded')
      case 'processing':
        return t('description.processing')
      case 'pending':
      default:
        return t('description.pending')
    }
  }

  // -- Render --
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Status Icon */}
          <div className="flex justify-center mb-6">
            {getStatusIcon()}
          </div>
          
          {/* Status Message */}
          <h1 className="text-2xl font-bold text-center mb-2">
            {getStatusMessage()}
          </h1>
          
          {/* Status Description */}
          <p className="text-muted-foreground text-center mb-6">
            {getStatusDescription()}
          </p>
          
          {/* Order ID */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-muted-foreground mb-1">{t('orderId')}</p>
            <p className="font-mono text-lg font-medium">{orderId}</p>
          </div>
          
          {/* Error Message if present */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}
          
          {/* Progress Bar and Status Spinner while processing */}
          {status === 'processing' && !error && (
            <div className="mb-6">
              <div className="flex items-center justify-center space-x-2 text-blue-600">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-sm">{t('checkingStatus')}</span>
              </div>
              <div className="mt-2">
                <div className="bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((attempts / 40) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Manual Check Button only when in-processing */}
            {status === 'processing' && (
              <button
                onClick={handleManualCheck}
                disabled={isChecking}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isChecking ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    {t('checking')}
                  </span>
                ) : (
                  t('checkNow')
                )}
              </button>
            )}
            
            {/* Orders Link for completed/canceled/failed/refunded statuses */}
            {['paid', 'failed', 'cancelled', 'refunded'].includes(status) && (
              <button
                onClick={() => router.push(`/${locale}/store/orders`)}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t('viewOrders')}
              </button>
            )}
            
            {/* Cancel/Back Button (label varies with state) */}
            <button
              onClick={handleCancel}
              className="w-full px-6 py-3 border border-gray-300 text-muted-foreground rounded-lg hover:bg-gray-50 transition-colors"
            >
              {status === 'processing' ? t('cancel') : t('backToStore')}
            </button>
          </div>
          
          {/* Help Text for user */}
          <p className="text-xs text-gray-500 text-center mt-6">
            {t('helpText')}
          </p>
        </div>
      </div>
    </div>
  )
}
