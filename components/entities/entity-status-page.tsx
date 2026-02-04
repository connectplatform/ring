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
  FileText,
  Shield,
  RefreshCw,
  Edit3,
  Eye,
  Calendar,
  Archive,
  AlertTriangle
} from 'lucide-react'

// Entity action and status types
type EntityAction = 'create' | 'verify' | 'approve' | 'publish'
type EntityStatus = string // Will be validated by the page component

interface EntityStatusPageProps {
  action: EntityAction
  status: EntityStatus
  locale: Locale
  entityId?: string
  entityName?: string
  reviewId?: string
  returnTo?: string
  reason?: string
}

// Status configuration mapping by action
const STATUS_CONFIG = {
  // Create statuses
  'create-draft': {
    icon: FileText,
    iconColor: 'text-gray-500',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200'
  },
  'create-pending_review': {
    icon: Clock,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  'create-published': {
    icon: CheckCircle,
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  'create-failed': {
    icon: XCircle,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
  },
  'create-rejected': {
    icon: XCircle,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
  },

  // Verify statuses
  'verify-pending': {
    icon: Clock,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  'verify-under_review': {
    icon: RefreshCw,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  'verify-verified': {
    icon: Shield,
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  'verify-rejected': {
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

  // Approve statuses
  'approve-pending': {
    icon: Clock,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  'approve-approved': {
    icon: CheckCircle,
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  'approve-rejected': {
    icon: XCircle,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
  },
  'approve-needs_revision': {
    icon: Edit3,
    iconColor: 'text-orange-500',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200'
  },

  // Publish statuses
  'publish-scheduled': {
    icon: Calendar,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  'publish-published': {
    icon: Eye,
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  'publish-failed': {
    icon: XCircle,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
  },
  'publish-unpublished': {
    icon: AlertTriangle,
    iconColor: 'text-orange-500',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200'
  },
  'publish-archived': {
    icon: Archive,
    iconColor: 'text-gray-500',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200'
  }
} as const

export default function EntityStatusPage({ 
  action, 
  status, 
  locale, 
  entityId, 
  entityName, 
  reviewId, 
  returnTo, 
  reason 
}: EntityStatusPageProps) {
  const t = useTranslations('modules.entities.status')
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
  const iconClassName = (action === 'verify' && status === 'under_review') 
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
              <h1 className="text-2xl font-bold text-foreground mb-4">
            {t(`${translationKey}.title`)}
          </h1>

          {/* Status Description */}
              <p className="text-muted-foreground mb-6">
            {t(`${translationKey}.description`)}
          </p>

          {/* Entity Name Display (if provided) */}
          {entityName && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border">
                <p className="text-sm text-muted-foreground mb-1">
                {t('entityName')}
              </p>
                <p className="font-medium text-foreground">
                {entityName}
              </p>
            </div>
          )}

          {/* Entity ID Display (if provided) */}
          {entityId && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border">
                <p className="text-sm text-muted-foreground mb-1">
                {t('entityId')}
              </p>
                <p className="font-mono text-sm font-medium text-foreground">
                {entityId}
              </p>
            </div>
          )}

          {/* Review ID Display (for approval processes) */}
          {reviewId && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border">
                <p className="text-sm text-muted-foreground mb-1">
                {t('reviewId')}
              </p>
                <p className="font-mono text-sm font-medium text-foreground">
                {reviewId}
              </p>
            </div>
          )}

          {/* Rejection Reason Display (if provided) */}
          {reason && (status === 'rejected' || status === 'needs_revision') && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border border-red-200">
              <p className="text-sm text-red-600 mb-2 font-medium">
                {t('rejectionReason')}
              </p>
                  <p className="text-sm text-muted-foreground">
                {reason}
              </p>
            </div>
          )}

          {/* Action-Specific Additional Content */}
          {action === 'verify' && status === 'under_review' && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border">
              <div className="flex items-center justify-center space-x-2 text-blue-600">
                <RefreshCw size={16} className="animate-spin" />
                <span className="text-sm">{t(`${translationKey}.reviewing`)}</span>
              </div>
            </div>
          )}

          {action === 'create' && status === 'draft' && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border">
              <p className="text-sm text-muted-foreground">
                {t(`${translationKey}.instruction`)}
              </p>
            </div>
          )}

          {action === 'publish' && status === 'scheduled' && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border">
              <p className="text-sm text-blue-600">
                {t(`${translationKey}.scheduleInfo`)}
              </p>
            </div>
          )}

          {/* Primary Action Buttons */}
          <div className="space-y-3">
            {/* Success states - Continue/View Entity */}
            {(status === 'published' || status === 'verified' || status === 'approved') && (
              <>
                {entityId && (
                  <Link 
                    href={ROUTES.ENTITY(entityId, locale)}
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    {t('actions.viewEntity')}
                  </Link>
                )}
                <Link 
                  href={returnTo || ROUTES.ENTITIES(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-foreground font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.backToEntities')}
                </Link>
              </>
            )}

            {/* Draft state - Continue Editing */}
            {status === 'draft' && (
              <>
                {entityId && (
                  <Link 
                    href={ROUTES.ADD_ENTITY(locale)}
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    {t('actions.continueEditing')}
                  </Link>
                )}
                <Link 
                  href={ROUTES.ENTITIES(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-foreground font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.backToEntities')}
                </Link>
              </>
            )}

            {/* Failed/Rejected states - Try Again or Revise */}
            {(status === 'failed' || status === 'rejected') && (
              <>
                {action === 'create' && (
                  <Link 
                    href={ROUTES.ADD_ENTITY(locale)}
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    {t('actions.createNew')}
                  </Link>
                )}
                {entityId && action !== 'create' && (
                  <Link 
                    href={ROUTES.ENTITY(entityId, locale)}
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    {t('actions.viewEntity')}
                  </Link>
                )}
                <Link 
                  href={ROUTES.CONTACT(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-foreground font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.contactSupport')}
                </Link>
              </>
            )}

            {/* Needs Revision state */}
            {status === 'needs_revision' && (
              <>
                {entityId && (
                  <Link 
                    href={ROUTES.ADD_ENTITY(locale)}
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    {t('actions.reviseEntity')}
                  </Link>
                )}
                <Link 
                  href={ROUTES.ENTITIES(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-foreground font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.backToEntities')}
                </Link>
              </>
            )}

            {/* Pending/Review states - Check Status Later */}
            {(status === 'pending' || status === 'under_review' || status === 'pending_review') && (
              <>
                {entityId && (
                  <Link 
                    href={ROUTES.ENTITY(entityId, locale)}
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    {t('actions.checkStatus')}
                  </Link>
                )}
                <Link 
                  href={ROUTES.ENTITIES(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-foreground font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.backToEntities')}
                </Link>
              </>
            )}

            {/* Scheduled state */}
            {status === 'scheduled' && (
              <>
                {entityId && (
                  <Link 
                    href={ROUTES.ENTITY(entityId, locale)}
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    {t('actions.viewScheduled')}
                  </Link>
                )}
                <Link 
                  href={ROUTES.ENTITIES(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-foreground font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.backToEntities')}
                </Link>
              </>
            )}

            {/* Unpublished/Archived states */}
            {(status === 'unpublished' || status === 'archived') && (
              <>
                {entityId && (
                  <Link 
                    href={ROUTES.ENTITY(entityId, locale)}
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    {t('actions.manageEntity')}
                  </Link>
                )}
                <Link 
                  href={ROUTES.ENTITIES(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-foreground font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.backToEntities')}
                </Link>
              </>
            )}

            {/* Expired state - Resubmit */}
            {status === 'expired' && (
              <>
                {entityId && (
                  <Link 
                    href={ROUTES.ADD_ENTITY(locale)}
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    {t('actions.resubmit')}
                  </Link>
                )}
                <Link 
                  href={ROUTES.ENTITIES(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-foreground font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.backToEntities')}
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
