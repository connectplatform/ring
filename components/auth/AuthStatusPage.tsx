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
  Mail, 
  Shield,
  RefreshCw,
  FileText,
  UserCheck,
  AlertTriangle
} from 'lucide-react'

// Auth action and status types
type AuthAction = 'login' | 'register' | 'verify' | 'reset-password' | 'kyc'
type AuthStatus = string // Will be validated by the page component

interface AuthStatusPageProps {
  action: AuthAction
  status: AuthStatus
  locale: Locale
  email?: string
  token?: string
  requestId?: string
  returnTo?: string
}

// Status configuration mapping by action
const STATUS_CONFIG = {
  // Login statuses
  'login-success': {
    icon: CheckCircle,
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  'login-failed': {
    icon: XCircle,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
  },
  'login-pending': {
    icon: Clock,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  'login-blocked': {
    icon: AlertTriangle,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
  },
  'login-expired': {
    icon: AlertCircle,
    iconColor: 'text-orange-500',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200'
  },

  // Register statuses
  'register-success': {
    icon: CheckCircle,
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  'register-pending_verification': {
    icon: Mail,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  'register-failed': {
    icon: XCircle,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
  },
  'register-email_sent': {
    icon: Mail,
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },

  // Verify statuses
  'verify-success': {
    icon: CheckCircle,
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  'verify-failed': {
    icon: XCircle,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
  },
  'verify-expired': {
    icon: AlertCircle,
    iconColor: 'text-orange-500',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200'
  },
  'verify-already_verified': {
    icon: Shield,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },

  // Reset password statuses
  'reset-password-email_sent': {
    icon: Mail,
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  'reset-password-success': {
    icon: CheckCircle,
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  'reset-password-failed': {
    icon: XCircle,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
  },
  'reset-password-expired': {
    icon: AlertCircle,
    iconColor: 'text-orange-500',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200'
  },
  'reset-password-invalid_token': {
    icon: XCircle,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
  },

  // KYC statuses
  'kyc-not_started': {
    icon: FileText,
    iconColor: 'text-gray-500',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200'
  },
  'kyc-pending': {
    icon: Clock,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  'kyc-under_review': {
    icon: RefreshCw,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  'kyc-approved': {
    icon: UserCheck,
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  'kyc-rejected': {
    icon: XCircle,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
  },
  'kyc-expired': {
    icon: AlertCircle,
    iconColor: 'text-orange-500',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200'
  }
} as const

export default function AuthStatusPage({ 
  action, 
  status, 
  locale, 
  email, 
  token, 
  requestId, 
  returnTo 
}: AuthStatusPageProps) {
  const t = useTranslations('modules.auth.status')
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
  const iconClassName = (action === 'kyc' && status === 'under_review') 
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

          {/* Email Display (if provided) */}
          {email && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border">
              <p className="text-sm text-gray-600 mb-1">
                {t('email')}
              </p>
              <p className="font-mono text-sm font-medium text-gray-900">
                {email}
              </p>
            </div>
          )}

          {/* Request ID Display (for KYC processes) */}
          {requestId && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border">
              <p className="text-sm text-gray-600 mb-1">
                {t('requestId')}
              </p>
              <p className="font-mono text-sm font-medium text-gray-900">
                {requestId}
              </p>
            </div>
          )}

          {/* Action-Specific Additional Content */}
          {action === 'register' && status === 'pending_verification' && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border">
              <p className="text-sm text-blue-600">
                {t(`${translationKey}.instruction`)}
              </p>
            </div>
          )}

          {action === 'kyc' && status === 'under_review' && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border">
              <div className="flex items-center justify-center space-x-2 text-blue-600">
                <RefreshCw size={16} className="animate-spin" />
                <span className="text-sm">{t(`${translationKey}.processing`)}</span>
              </div>
            </div>
          )}

          {/* Primary Action Buttons */}
          <div className="space-y-3">
            {/* Success states - Continue to destination */}
            {(status === 'success' || status === 'approved') && (
              <>
                <Link 
                  href={returnTo || ROUTES.PROFILE(locale)}
                  className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.continue')}
                </Link>
                <Link 
                  href={ROUTES.HOME(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.backToHome')}
                </Link>
              </>
            )}

            {/* Failed states - Try Again */}
            {(status === 'failed' || status === 'expired' || status === 'invalid_token') && (
              <>
                {action === 'login' && (
                  <Link 
                    href={ROUTES.LOGIN(locale)}
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    {t('actions.tryAgain')}
                  </Link>
                )}
                {action === 'register' && (
                  <Link 
                    href={ROUTES.LOGIN(locale)}
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    {t('actions.backToRegister')}
                  </Link>
                )}
                {action === 'reset-password' && (
                  <Link 
                    href={ROUTES.FORGOT_PASSWORD(locale)}
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    {t('actions.requestNewReset')}
                  </Link>
                )}
                <Link 
                  href={ROUTES.HOME(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.backToHome')}
                </Link>
              </>
            )}

            {/* Email sent states - Check Email */}
            {(status === 'email_sent' || status === 'pending_verification') && (
              <>
                <div className="text-sm text-blue-600 mb-4">
                  {t('checkEmailInstruction')}
                </div>
                <Link 
                  href={ROUTES.LOGIN(locale)}
                  className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.backToLogin')}
                </Link>
              </>
            )}

            {/* Pending/Review states - Check Status Later */}
            {(status === 'pending' || status === 'under_review') && (
              <>
                <Link 
                  href={ROUTES.PROFILE(locale)}
                  className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.viewProfile')}
                </Link>
                <Link 
                  href={ROUTES.HOME(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.backToHome')}
                </Link>
              </>
            )}

            {/* Blocked state - Contact Support */}
            {status === 'blocked' && (
              <>
                <Link 
                  href={ROUTES.CONTACT(locale)}
                  className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.contactSupport')}
                </Link>
                <Link 
                  href={ROUTES.HOME(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.backToHome')}
                </Link>
              </>
            )}

            {/* Already verified state */}
            {status === 'already_verified' && (
              <>
                <Link 
                  href={ROUTES.LOGIN(locale)}
                  className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.proceedToLogin')}
                </Link>
              </>
            )}

            {/* Rejected state - Need revision or contact support */}
            {status === 'rejected' && (
              <>
                {action === 'kyc' && (
                  <Link 
                    href={ROUTES.PROFILE(locale)}
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    {t('actions.reviseApplication')}
                  </Link>
                )}
                <Link 
                  href={ROUTES.CONTACT(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.contactSupport')}
                </Link>
              </>
            )}

            {/* KYC not started state */}
            {status === 'not_started' && (
              <>
                <Link 
                  href={ROUTES.PROFILE(locale)}
                  className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.startKyc')}
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
