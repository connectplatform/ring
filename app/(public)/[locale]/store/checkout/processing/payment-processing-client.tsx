'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react'
import type { Locale } from '@/i18n-config'

interface PaymentProcessingClientProps {
  orderId: string
  locale: Locale
  initialStatus?: string
}

type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'refunded'

export default function PaymentProcessingClient({
  orderId,
  locale,
  initialStatus
}: PaymentProcessingClientProps) {
  const t = useTranslations('modules.store.checkout.processing')
  const router = useRouter()
  const [status, setStatus] = useState<PaymentStatus>('processing')
  const [error, setError] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [isChecking, setIsChecking] = useState(false)

  // Refs to avoid stale values inside interval
  const statusRef = useRef<PaymentStatus>('processing')
  const isCheckingRef = useRef(false)

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    isCheckingRef.current = isChecking
  }, [isChecking])

  const checkPaymentStatus = useCallback(async () => {
    if (isCheckingRef.current) return
    
    setIsChecking(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/store/payments/${orderId}/status`)
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(t('errors.orderNotFound'))
        } else if (response.status === 401) {
          throw new Error(t('errors.unauthorized'))
        }
        throw new Error(t('errors.statusCheckFailed'))
      }
      
      const data = await response.json()
      const newStatus = data.status as PaymentStatus
      
      setStatus(newStatus)
      
      // If payment is complete (success or failure), redirect
      if (['paid', 'failed', 'cancelled', 'refunded'].includes(newStatus)) {
        // Map our status to checkout status page format
        let redirectStatus = 'processing'
        if (newStatus === 'paid') {
          redirectStatus = 'success'
        } else if (newStatus === 'failed') {
          redirectStatus = 'failure'
        } else if (newStatus === 'cancelled') {
          redirectStatus = 'cancel'
        }
        
        // Redirect to status page
        setTimeout(() => {
          router.push(`/${locale}/store/checkout/${redirectStatus}?orderId=${orderId}`)
        }, 1500)
      }
      
    } catch (err) {
      console.error('Error checking payment status:', err)
      setError(err instanceof Error ? err.message : t('errors.unknown'))
    } finally {
      setIsChecking(false)
      setAttempts(prev => prev + 1)
    }
  }, [orderId, locale, t, router])

  useEffect(() => {
    // Check status immediately
    checkPaymentStatus()
    
    // Then check every 3 seconds for up to 2 minutes
    const maxAttempts = 40 // 40 * 3 seconds = 2 minutes
    let localAttempts = 0
    
    const interval = setInterval(() => {
      if (localAttempts < maxAttempts && !['paid', 'failed', 'cancelled', 'refunded'].includes(statusRef.current)) {
        localAttempts += 1
        setAttempts(localAttempts)
        checkPaymentStatus()
      } else {
        clearInterval(interval)
      }
    }, 3000)
    
    return () => clearInterval(interval)
  }, [checkPaymentStatus])

  const handleManualCheck = () => {
    setAttempts(0)
    checkPaymentStatus()
  }

  const handleCancel = () => {
    router.push(`/${locale}/store/checkout/cancel?orderId=${orderId}`)
  }

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
          <p className="text-gray-600 text-center mb-6">
            {getStatusDescription()}
          </p>
          
          {/* Order ID */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600 mb-1">{t('orderId')}</p>
            <p className="font-mono text-lg font-medium">{orderId}</p>
          </div>
          
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}
          
          {/* Progress Indicator */}
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
            {/* Manual Check Button (for processing status) */}
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
            
            {/* View Order Button (for completed status) */}
            {['paid', 'failed', 'cancelled', 'refunded'].includes(status) && (
              <button
                onClick={() => router.push(`/${locale}/store/orders`)}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t('viewOrders')}
              </button>
            )}
            
            {/* Cancel/Back Button */}
            <button
              onClick={handleCancel}
              className="w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {status === 'processing' ? t('cancel') : t('backToStore')}
            </button>
          </div>
          
          {/* Help Text */}
          <p className="text-xs text-gray-500 text-center mt-6">
            {t('helpText')}
          </p>
        </div>
      </div>
    </div>
  )
}
