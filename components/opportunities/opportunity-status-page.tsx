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
  Send,
  RefreshCw,
  Edit3,
  Eye,
  Calendar,
  Users,
  AlertTriangle,
  Upload,
  MessageSquare
} from 'lucide-react'

// Opportunity action and status types
type OpportunityAction = 'create' | 'apply' | 'submit' | 'approve' | 'publish'
type OpportunityStatus = string // Will be validated by the page component

interface OpportunityStatusPageProps {
  action: OpportunityAction
  status: OpportunityStatus
  locale: Locale
  opportunityId?: string
  opportunityTitle?: string
  applicationId?: string
  submissionId?: string
  reviewId?: string
  returnTo?: string
  reason?: string
  nextStep?: string
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
  'create-success': {
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

  // Apply statuses
  'apply-submitted': {
    icon: Send,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  'apply-under_review': {
    icon: RefreshCw,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  'apply-accepted': {
    icon: CheckCircle,
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  'apply-rejected': {
    icon: XCircle,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
  },
  'apply-pending_documents': {
    icon: Upload,
    iconColor: 'text-orange-500',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200'
  },

  // Submit statuses
  'submit-received': {
    icon: MessageSquare,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  'submit-processing': {
    icon: RefreshCw,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  'submit-approved': {
    icon: CheckCircle,
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  'submit-requires_changes': {
    icon: Edit3,
    iconColor: 'text-orange-500',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200'
  },
  'submit-rejected': {
    icon: XCircle,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
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
  }
} as const

export default function OpportunityStatusPage({ 
  action, 
  status, 
  locale, 
  opportunityId, 
  opportunityTitle, 
  applicationId, 
  submissionId, 
  reviewId, 
  returnTo, 
  reason,
  nextStep
}: OpportunityStatusPageProps) {
  const t = useTranslations('modules.opportunities.status')
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
  const iconClassName = (
    (action === 'apply' && status === 'under_review') ||
    (action === 'submit' && status === 'processing')
  ) ? `${finalConfig.iconColor} animate-spin` : finalConfig.iconColor

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

          {/* Opportunity Title Display (if provided) */}
          {opportunityTitle && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border">
                <p className="text-sm text-muted-foreground mb-1">
                {t('opportunityTitle')}
              </p>
                <p className="font-medium text-foreground">
                {opportunityTitle}
              </p>
            </div>
          )}

          {/* Application/Submission ID Display */}
          {applicationId && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border">
                <p className="text-sm text-muted-foreground mb-1">
                {t('applicationId')}
              </p>
                <p className="font-mono text-sm font-medium text-foreground">
                {applicationId}
              </p>
            </div>
          )}

          {submissionId && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border">
                <p className="text-sm text-muted-foreground mb-1">
                {t('submissionId')}
              </p>
                <p className="font-mono text-sm font-medium text-foreground">
                {submissionId}
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

          {/* Rejection/Change Reason Display */}
          {reason && (status === 'rejected' || status === 'requires_changes') && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border border-red-200">
              <p className="text-sm text-red-600 mb-2 font-medium">
                {status === 'rejected' ? t('rejectionReason') : t('changesRequired')}
              </p>
                  <p className="text-sm text-muted-foreground">
                {reason}
              </p>
            </div>
          )}

          {/* Next Step Information */}
          {nextStep && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border border-blue-200">
              <p className="text-sm text-blue-600 mb-2 font-medium">
                {t('nextStep')}
              </p>
                  <p className="text-sm text-muted-foreground">
                {nextStep}
              </p>
            </div>
          )}

          {/* Action-Specific Additional Content */}
          {action === 'apply' && status === 'under_review' && (
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

          {action === 'apply' && status === 'pending_documents' && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border border-orange-200">
              <p className="text-sm text-orange-600">
                {t(`${translationKey}.documentsNeeded`)}
              </p>
            </div>
          )}

          {/* Primary Action Buttons */}
          <div className="space-y-3">
            {/* Success states - View/Continue */}
            {(status === 'success' || status === 'published' || status === 'approved' || status === 'accepted') && (
              <>
                {opportunityId && (
                  <Link 
                    href={ROUTES.OPPORTUNITY(opportunityId, locale)}
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    {action === 'apply' ? t('actions.viewApplication') : t('actions.viewOpportunity')}
                  </Link>
                )}
                <Link 
                  href={returnTo || ROUTES.OPPORTUNITIES(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-foreground font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.backToOpportunities')}
                </Link>
              </>
            )}

            {/* Draft state - Continue Editing */}
            {status === 'draft' && (
              <>
                {opportunityId && (
                  <Link 
                    href={ROUTES.ADD_OPPORTUNITY(locale)}
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    {t('actions.continueEditing')}
                  </Link>
                )}
                <Link 
                  href={ROUTES.OPPORTUNITIES(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-foreground font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.backToOpportunities')}
                </Link>
              </>
            )}

            {/* Failed/Rejected states - Try Again or Contact */}
            {(status === 'failed' || status === 'rejected') && (
              <>
                {action === 'create' && (
                  <Link 
                    href={ROUTES.ADD_OPPORTUNITY(locale)}
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    {t('actions.createNew')}
                  </Link>
                )}
                {action === 'apply' && opportunityId && (
                  <Link 
                    href={ROUTES.OPPORTUNITY(opportunityId, locale)}
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    {t('actions.applyAgain')}
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

            {/* Needs Revision/Changes Required */}
            {(status === 'needs_revision' || status === 'requires_changes') && (
              <>
                {opportunityId && (
                  <Link 
                    href={action === 'create' ? ROUTES.ADD_OPPORTUNITY(locale) : ROUTES.OPPORTUNITY(opportunityId, locale)}
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    {t('actions.makeChanges')}
                  </Link>
                )}
                <Link 
                  href={ROUTES.OPPORTUNITIES(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-foreground font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.backToOpportunities')}
                </Link>
              </>
            )}

            {/* Pending Documents */}
            {status === 'pending_documents' && (
              <>
                {applicationId && (
                  <Link 
                    href={`${ROUTES.OPPORTUNITIES(locale)}/application/${applicationId}`}
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    {t('actions.uploadDocuments')}
                  </Link>
                )}
                <Link 
                  href={ROUTES.OPPORTUNITIES(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-foreground font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.backToOpportunities')}
                </Link>
              </>
            )}

            {/* Pending/Review/Processing states - Check Status */}
            {(status === 'pending' || status === 'under_review' || status === 'pending_review' || status === 'processing' || status === 'received') && (
              <>
                {opportunityId && (
                  <Link 
                    href={ROUTES.OPPORTUNITY(opportunityId, locale)}
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    {t('actions.checkStatus')}
                  </Link>
                )}
                <Link 
                  href={ROUTES.OPPORTUNITIES(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-foreground font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.backToOpportunities')}
                </Link>
              </>
            )}

            {/* Submitted state */}
            {status === 'submitted' && (
              <>
                {opportunityId && (
                  <Link 
                    href={ROUTES.OPPORTUNITY(opportunityId, locale)}
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    {t('actions.viewOpportunity')}
                  </Link>
                )}
                <Link 
                  href={ROUTES.OPPORTUNITIES(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-foreground font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.viewMyApplications')}
                </Link>
              </>
            )}

            {/* Scheduled state */}
            {status === 'scheduled' && (
              <>
                {opportunityId && (
                  <Link 
                    href={ROUTES.OPPORTUNITY(opportunityId, locale)}
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    {t('actions.viewScheduled')}
                  </Link>
                )}
                <Link 
                  href={ROUTES.OPPORTUNITIES(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-foreground font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.backToOpportunities')}
                </Link>
              </>
            )}

            {/* Unpublished state */}
            {status === 'unpublished' && (
              <>
                {opportunityId && (
                  <Link 
                    href={ROUTES.OPPORTUNITY(opportunityId, locale)}
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    {t('actions.manageOpportunity')}
                  </Link>
                )}
                <Link 
                  href={ROUTES.OPPORTUNITIES(locale)}
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-foreground font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {t('actions.backToOpportunities')}
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
