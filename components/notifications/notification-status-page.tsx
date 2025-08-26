'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n-config'
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Clock, 
  Bell,
  BellOff,
  Send,
  Shield,
  Settings,
  RefreshCw,
  AlertTriangle,
  MessageSquare,
  Users,
  Eye,
  Download
} from 'lucide-react'

// Notification action and status types
type NotificationAction = 'permission' | 'subscribe' | 'send' | 'deliver'
type NotificationStatus = string // Will be validated by the page component

interface NotificationStatusPageProps {
  action: NotificationAction
  status: NotificationStatus
  locale: Locale
  notificationId?: string
  subscriptionId?: string
  deviceToken?: string
  returnTo?: string
  reason?: string
  topic?: string
}

// Status configuration mapping by action
const STATUS_CONFIG = {
  // Permission statuses
  'permission-granted': {
    icon: CheckCircle,
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  'permission-denied': {
    icon: XCircle,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
  },
  'permission-pending': {
    icon: Clock,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  'permission-unsupported': {
    icon: AlertTriangle,
    iconColor: 'text-orange-500',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200'
  },

  // Subscribe statuses
  'subscribe-subscribed': {
    icon: Bell,
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  'subscribe-unsubscribed': {
    icon: BellOff,
    iconColor: 'text-gray-500',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200'
  },
  'subscribe-failed': {
    icon: XCircle,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
  },
  'subscribe-pending': {
    icon: RefreshCw,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },

  // Send statuses
  'send-sent': {
    icon: Send,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  'send-delivered': {
    icon: CheckCircle,
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  'send-failed': {
    icon: XCircle,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
  },
  'send-pending': {
    icon: Clock,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },

  // Deliver statuses
  'deliver-delivered': {
    icon: CheckCircle,
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  'deliver-read': {
    icon: Eye,
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  'deliver-failed': {
    icon: XCircle,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
  },
  'deliver-cancelled': {
    icon: AlertCircle,
    iconColor: 'text-orange-500',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200'
  }
} as const

export default function NotificationStatusPage({ 
  action, 
  status, 
  locale, 
  notificationId,
  subscriptionId,
  deviceToken,
  returnTo, 
  reason,
  topic
}: NotificationStatusPageProps) {
  const t = useTranslations('modules.notifications.status')
  const tCommon = useTranslations('common')
  
  const configKey = `${action}-${status}` as keyof typeof STATUS_CONFIG
  const config = STATUS_CONFIG[configKey]
  
  // Fallback config if not found
  const fallbackConfig = {
    icon: AlertCircle,
    iconColor: 'text-gray-500',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200'
  }
  
  const finalConfig = config || fallbackConfig
  const IconComponent = finalConfig.icon

  // Handle special animated icons
  const iconClassName = (status === 'pending') 
    ? `${finalConfig.iconColor} animate-spin` 
    : finalConfig.iconColor

  // Generate translation key path
  const translationKey = `${action}.${status}`

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Status Card */}
        <div className={`
          p-8 rounded-lg border-2 ${finalConfig.bgColor} ${finalConfig.borderColor}
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
            {t(`${translationKey}.title`)}
          </h1>

          {/* Status Description */}
          <p className="text-gray-600 mb-6">
            {t(`${translationKey}.description`)}
          </p>

          {/* Topic Display (for subscriptions) */}
          {topic && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border">
              <p className="text-sm text-gray-600 mb-1">
                {t('topic')}
              </p>
              <p className="font-medium text-gray-900">
                {topic}
              </p>
            </div>
          )}

          {/* Notification ID Display */}
          {notificationId && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border">
              <p className="text-sm text-gray-600 mb-1">
                {t('notificationId')}
              </p>
              <p className="font-mono text-sm font-medium text-gray-900">
                {notificationId}
              </p>
            </div>
          )}

          {/* Subscription ID Display */}
          {subscriptionId && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border">
              <p className="text-sm text-gray-600 mb-1">
                {t('subscriptionId')}
              </p>
              <p className="font-mono text-sm font-medium text-gray-900">
                {subscriptionId}
              </p>
            </div>
          )}

          {/* Device Token Display (masked for security) */}
          {deviceToken && action === 'permission' && status === 'granted' && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border">
              <p className="text-sm text-gray-600 mb-1">
                {t('deviceRegistered')}
              </p>
              <p className="font-mono text-xs text-gray-500">
                {deviceToken.substring(0, 8)}...{deviceToken.substring(deviceToken.length - 8)}
              </p>
            </div>
          )}

          {/* Failure Reason Display */}
          {reason && (status === 'failed' || status === 'denied' || status === 'cancelled') && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border border-red-200">
              <p className="text-sm text-red-600 mb-2 font-medium">
                {status === 'failed' ? t('failureReason') : 
                 status === 'denied' ? t('denialReason') : 
                 t('cancellationReason')}
              </p>
              <p className="text-sm text-gray-700">
                {reason}
              </p>
            </div>
          )}

          {/* Permission-specific Additional Content */}
          {action === 'permission' && status === 'pending' && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border">
              <div className="flex items-center justify-center space-x-2 text-blue-600">
                <RefreshCw size={16} className="animate-spin" />
                <span className="text-sm">{t(`${translationKey}.waiting`)}</span>
              </div>
            </div>
          )}

          {action === 'permission' && status === 'unsupported' && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border border-orange-200">
              <p className="text-sm text-orange-600">
                {t(`${translationKey}.browserInfo`)}
              </p>
            </div>
          )}

          {/* Subscription-specific Content */}
          {action === 'subscribe' && status === 'subscribed' && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border border-green-200">
              <p className="text-sm text-green-600">
                {t(`${translationKey}.activeSubscription`)}
              </p>
            </div>
          )}

          {/* Send/Deliver Status Details */}
          {(action === 'send' || action === 'deliver') && status === 'delivered' && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border border-green-200">
              <p className="text-sm text-green-600">
                {t(`${translationKey}.deliveryConfirmed`)}
              </p>
            </div>
          )}

          {/* Primary Action Buttons */}
          <div className="space-y-3">
            {/* Permission granted - Go to settings */}
            {action === 'permission' && status === 'granted' && (
              <>
                <Link 
                  href={ROUTES.NOTIFICATIONS(locale)}
                  className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.manageNotifications')}
                </Link>
                <Link 
                  href={returnTo || ROUTES.HOME(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.backToApp')}
                </Link>
              </>
            )}

            {/* Permission denied - Retry or instructions */}
            {action === 'permission' && status === 'denied' && (
              <>
                <button 
                  onClick={() => window.location.reload()}
                  className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.retryPermission')}
                </button>
                <Link 
                  href={ROUTES.HELP(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.getHelp')}
                </Link>
              </>
            )}

            {/* Permission unsupported - Browser info */}
            {action === 'permission' && status === 'unsupported' && (
              <>
                <Link 
                  href={ROUTES.HELP(locale)}
                  className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.viewSupportedBrowsers')}
                </Link>
                <Link 
                  href={returnTo || ROUTES.HOME(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.backToApp')}
                </Link>
              </>
            )}

            {/* Successfully subscribed */}
            {action === 'subscribe' && status === 'subscribed' && (
              <>
                <Link 
                  href={ROUTES.NOTIFICATIONS(locale)}
                  className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.manageSubscriptions')}
                </Link>
                <Link 
                  href={returnTo || ROUTES.HOME(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.backToApp')}
                </Link>
              </>
            )}

            {/* Unsubscribed */}
            {action === 'subscribe' && status === 'unsubscribed' && (
              <>
                <Link 
                  href={ROUTES.NOTIFICATIONS(locale)}
                  className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.resubscribe')}
                </Link>
                <Link 
                  href={returnTo || ROUTES.HOME(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.backToApp')}
                </Link>
              </>
            )}

            {/* Subscribe failed - Retry */}
            {action === 'subscribe' && status === 'failed' && (
              <>
                <button 
                  onClick={() => window.location.reload()}
                  className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.retrySubscription')}
                </button>
                <Link 
                  href={ROUTES.CONTACT(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.contactSupport')}
                </Link>
              </>
            )}

            {/* Message sent successfully */}
            {action === 'send' && (status === 'sent' || status === 'delivered') && (
              <>
                <Link 
                  href={ROUTES.NOTIFICATIONS(locale)}
                  className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.viewNotifications')}
                </Link>
                <Link 
                  href={returnTo || ROUTES.HOME(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.backToApp')}
                </Link>
              </>
            )}

            {/* Message send failed */}
            {action === 'send' && status === 'failed' && (
              <>
                <button 
                  onClick={() => window.location.reload()}
                  className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.retrySending')}
                </button>
                <Link 
                  href={ROUTES.CONTACT(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.contactSupport')}
                </Link>
              </>
            )}

            {/* Message delivered or read */}
            {action === 'deliver' && (status === 'delivered' || status === 'read') && (
              <>
                <Link 
                  href={ROUTES.NOTIFICATIONS(locale)}
                  className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.viewAllNotifications')}
                </Link>
                <Link 
                  href={returnTo || ROUTES.HOME(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.backToApp')}
                </Link>
              </>
            )}

            {/* Delivery failed or cancelled */}
            {action === 'deliver' && (status === 'failed' || status === 'cancelled') && (
              <>
                <Link 
                  href={ROUTES.NOTIFICATIONS(locale)}
                  className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.checkSettings')}
                </Link>
                <Link 
                  href={ROUTES.CONTACT(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.contactSupport')}
                </Link>
              </>
            )}

            {/* Pending states - Check status */}
            {status === 'pending' && (
              <>
                <button 
                  onClick={() => window.location.reload()}
                  className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.checkStatus')}
                </button>
                <Link 
                  href={returnTo || ROUTES.HOME(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.backToApp')}
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
