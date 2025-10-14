'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n-config'
import { CheckCircle, XCircle, AlertCircle, Clock, Loader2, Mail, Shield, Key } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Valid auth action types
type AuthAction = 'login' | 'register' | 'verify' | 'reset-password' | 'kyc' | 'signout'

// Valid status types per action
type AuthStatus = 
  | 'success' | 'failed' | 'pending' | 'blocked' | 'expired'
  | 'pending_verification' | 'email_sent' | 'already_verified'
  | 'invalid_token' | 'not_started' | 'under_review' | 'approved' | 'rejected'
  | 'processing' | 'complete'

interface AuthStatusPageProps {
  action: AuthAction
  status: AuthStatus
  locale: Locale
  email?: string
  token?: string
  requestId?: string
  returnTo?: string
}

const STATUS_CONFIG = {
  success: { icon: CheckCircle, iconColor: 'text-green-500', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
  failed: { icon: XCircle, iconColor: 'text-red-500', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  error: { icon: XCircle, iconColor: 'text-red-500', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  blocked: { icon: Shield, iconColor: 'text-red-500', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  expired: { icon: Clock, iconColor: 'text-orange-500', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
  pending: { icon: Clock, iconColor: 'text-blue-500', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  pending_verification: { icon: Mail, iconColor: 'text-blue-500', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  email_sent: { icon: Mail, iconColor: 'text-green-500', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
  already_verified: { icon: CheckCircle, iconColor: 'text-green-500', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
  invalid_token: { icon: Key, iconColor: 'text-red-500', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  not_started: { icon: AlertCircle, iconColor: 'text-gray-500', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' },
  under_review: { icon: Loader2, iconColor: 'text-blue-500', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  approved: { icon: CheckCircle, iconColor: 'text-green-500', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
  rejected: { icon: XCircle, iconColor: 'text-red-500', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  processing: { icon: Loader2, iconColor: 'text-blue-500', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  complete: { icon: CheckCircle, iconColor: 'text-green-500', bgColor: 'bg-green-50', borderColor: 'border-green-200' }
} as const

export default function AuthStatusPage({ action, status, locale, email, token, requestId, returnTo }: AuthStatusPageProps) {
  const t = useTranslations('modules.auth.status')
  const router = useRouter()
  
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  const IconComponent = config.icon

  // Auto-redirect for signout success and login pending
  useEffect(() => {
    if (action === 'signout' && status === 'success') {
      const timer = setTimeout(() => {
        router.push(ROUTES.LOGIN(locale))
      }, 2000)

      return () => clearTimeout(timer)
    }

    // Auto-redirect for login pending to the returnTo URL or profile
    if (action === 'login' && status === 'pending') {
      const timer = setTimeout(() => {
        const redirectTo = returnTo || ROUTES.PROFILE(locale)
        router.push(redirectTo)
      }, 2000) // Show "Signing in..." for 2 seconds

      return () => clearTimeout(timer)
    }
  }, [action, status, router, locale, returnTo])

  // Get action-specific navigation buttons
  const getActionButtons = () => {
    const buttons = []

    switch (action) {
      case 'signout':
        if (status === 'success') {
          buttons.push(
            <motion.div
              key="redirect-info"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-sm text-muted-foreground"
            >
              {t('redirecting') || 'Redirecting to login...'}
            </motion.div>
          )
        }
        break

      case 'login':
        if (status === 'failed' || status === 'expired') {
          buttons.push(
            <Button key="retry" asChild>
              <Link href={ROUTES.LOGIN(locale)}>
                {t('actions.tryAgain')}
              </Link>
            </Button>
          )
        }
        if (status === 'pending') {
          buttons.push(
            <motion.div
              key="redirect-info"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-sm text-muted-foreground"
            >
              {t('redirecting') || 'Redirecting...'}
            </motion.div>
          )
        }
        if (status === 'success') {
          buttons.push(
            <Button key="continue" asChild>
              <Link href={returnTo || ROUTES.PROFILE(locale)}>
                {t('actions.continue')}
              </Link>
            </Button>
          )
        }
        break

      case 'register':
        if (status === 'success') {
          buttons.push(
            <Button key="login" asChild>
              <Link href={ROUTES.LOGIN(locale)}>
                {t('actions.proceedToLogin')}
              </Link>
            </Button>
          )
        }
        if (status === 'failed') {
          buttons.push(
            <Button key="retry" asChild variant="outline">
              <Link href={ROUTES.REGISTER(locale)}>
                {t('actions.backToRegister')}
              </Link>
            </Button>
          )
        }
        break

      case 'verify':
        if (status === 'success' || status === 'already_verified') {
          buttons.push(
            <Button key="login" asChild>
              <Link href={ROUTES.LOGIN(locale)}>
                {t('actions.proceedToLogin')}
              </Link>
            </Button>
          )
        }
        break

      case 'reset-password':
        if (status === 'success') {
          buttons.push(
            <Button key="login" asChild>
              <Link href={ROUTES.LOGIN(locale)}>
                {t('actions.backToLogin')}
              </Link>
            </Button>
          )
        }
        if (status === 'expired' || status === 'invalid_token') {
          buttons.push(
            <Button key="request-new" asChild variant="outline">
              <Link href={ROUTES.RESET_PASSWORD(locale)}>
                {t('actions.requestNewReset')}
              </Link>
            </Button>
          )
        }
        break

      case 'kyc':
        if (status === 'approved') {
          buttons.push(
            <Button key="profile" asChild>
              <Link href={ROUTES.PROFILE(locale)}>
                {t('actions.viewProfile')}
              </Link>
            </Button>
          )
        }
        if (status === 'not_started') {
          buttons.push(
            <Button key="start-kyc" asChild>
              <Link href={ROUTES.KYC(locale)}>
                {t('actions.startKyc')}
              </Link>
            </Button>
          )
        }
        break
    }

    // Always add home button
    buttons.push(
      <Button key="home" asChild variant="outline">
        <Link href={ROUTES.HOME(locale)}>
          {t('actions.backToHome')}
        </Link>
      </Button>
    )

    return buttons
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="max-w-md w-full text-center"
      >
        <div className={`p-8 rounded-lg border-2 ${config.bgColor} ${config.borderColor} shadow-sm`}>
          {/* Status Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
            className="flex justify-center mb-6"
          >
            <IconComponent 
              size={64} 
              className={status === 'processing' || status === 'under_review' ? `${config.iconColor} animate-spin` : config.iconColor}
            />
          </motion.div>

          {/* Status Content */}
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {t(`${action}.${status}.title`) || t(`${status}.title`) || `${action} ${status}`}
          </h1>
          <p className="text-gray-600 mb-6">
            {t(`${action}.${status}.description`) || t(`${status}.description`) || `Your ${action} is ${status}.`}
          </p>

          {/* Email (if provided) */}
          {email && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border">
              <p className="text-sm text-gray-600 mb-1">{t('email')}</p>
              <p className="font-medium text-gray-900">{email}</p>
            </div>
          )}

          {/* Request ID (if provided) */}
          {requestId && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border">
              <p className="text-sm text-gray-600 mb-1">{t('requestId')}</p>
              <p className="font-mono text-sm font-medium text-gray-900">{requestId}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            {getActionButtons()}
          </div>
        </div>

        {/* Help Link */}
        <div className="mt-6">
          <Link href={ROUTES.CONTACT(locale)} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            {t('needHelp')}
          </Link>
        </div>
      </motion.div>
    </div>
  )
}