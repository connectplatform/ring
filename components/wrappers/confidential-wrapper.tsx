'use client'

/**
 * CONFIDENTIAL PAGE WRAPPER - Ring Platform v2.0
 * ==============================================
 * Universal 3-column responsive layout for confidential content pages
 *
 * Layout Structure:
 * - Desktop: DesktopSidebar (280px) + Center Content + Right Sidebar (320px)
 * - iPad: DesktopSidebar (280px) + Center Content + Floating Toggle for Right Sidebar
 * - Mobile: Center Content + Bottom Navigation + Floating Toggle for Right Sidebar
 *
 * Right Sidebar Content:
 * - Access Info
 * - Security
 * - Filters
 *
 * Strike Team:
 * - Ring Components Specialist (layout pattern)
 * - React 19 Specialist (modern patterns)
 * - Security Expert (confidential content handling)
 * - Privacy Specialist (access control UX)
 * - Content Strategy Expert (confidential content management)
 * - UI/UX Optimization Agent (mobile excellence)
 */

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import type { Locale } from '@/i18n-config'
import DesktopSidebar from '@/components/navigation/desktop-sidebar'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Shield,
  Lock,
  Eye,
  Filter,
  AlertTriangle,
  CheckCircle,
  Info,
  Users,
  Clock,
  Key,
  FileText,
  Briefcase,
  Search,
  Star
} from 'lucide-react'
import { ROUTES } from '@/constants/routes'

interface ConfidentialWrapperProps {
  children: React.ReactNode
  locale: string
  contentType?: 'entities' | 'opportunities'
}

export default function ConfidentialWrapper({
  children,
  locale,
  contentType = 'entities'
}: ConfidentialWrapperProps) {
  const router = useRouter()
  const t = useTranslations(`modules.${contentType}`)
  const tCommon = useTranslations('common')
  const [mounted, setMounted] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Access level information
  const accessInfo = {
    level: 'confidential',
    requirements: [
      'Verified member status',
      'Background check completed',
      'NDA agreement signed',
      'Special access granted'
    ],
    benefits: [
      'Access to exclusive opportunities',
      'Private entity information',
      'Confidential job postings',
      'Priority support'
    ]
  }

  // Security measures
  const securityMeasures = [
    {
      id: 'encryption',
      title: t('security.encryption', { defaultValue: 'End-to-End Encryption' }),
      description: t('security.encryptionDesc', { defaultValue: 'All confidential data is encrypted in transit and at rest' }),
      icon: Lock
    },
    {
      id: 'access-control',
      title: t('security.accessControl', { defaultValue: 'Strict Access Control' }),
      description: t('security.accessControlDesc', { defaultValue: 'Access is logged and monitored continuously' }),
      icon: Key
    },
    {
      id: 'audit-trail',
      title: t('security.auditTrail', { defaultValue: 'Complete Audit Trail' }),
      description: t('security.auditTrailDesc', { defaultValue: 'All access and actions are logged for security' }),
      icon: FileText
    },
    {
      id: 'nda-required',
      title: t('security.ndaRequired', { defaultValue: 'NDA Required' }),
      description: t('security.ndaRequiredDesc', { defaultValue: 'All users must sign confidentiality agreements' }),
      icon: Shield
    }
  ]

  // Content type specific filters
  const getFilters = () => {
    if (contentType === 'entities') {
      return [
        {
          id: 'industry',
          label: t('filters.industry', { defaultValue: 'Industry' }),
          options: ['Technology', 'Finance', 'Healthcare', 'Manufacturing', 'Consulting']
        },
        {
          id: 'company-size',
          label: t('filters.companySize', { defaultValue: 'Company Size' }),
          options: ['Startup (1-10)', 'Small (11-50)', 'Medium (51-200)', 'Large (200+)']
        },
        {
          id: 'funding-stage',
          label: t('filters.fundingStage', { defaultValue: 'Funding Stage' }),
          options: ['Seed', 'Series A', 'Series B', 'Series C+', 'Private']
        },
        {
          id: 'verification-status',
          label: t('filters.verificationStatus', { defaultValue: 'Verification Status' }),
          options: ['Verified', 'Pending', 'Under Review']
        }
      ]
    } else {
      return [
        {
          id: 'job-type',
          label: t('filters.jobType', { defaultValue: 'Job Type' }),
          options: ['Full-time', 'Contract', 'Consulting', 'Advisory']
        },
        {
          id: 'experience-level',
          label: t('filters.experienceLevel', { defaultValue: 'Experience Level' }),
          options: ['Entry', 'Mid-level', 'Senior', 'Executive', 'Expert']
        },
        {
          id: 'compensation-range',
          label: t('filters.compensationRange', { defaultValue: 'Compensation Range' }),
          options: ['$50k-$100k', '$100k-$200k', '$200k-$500k', '$500k+']
        },
        {
          id: 'urgency',
          label: t('filters.urgency', { defaultValue: 'Urgency' }),
          options: ['Immediate', 'Within 1 month', 'Within 3 months', 'Planning']
        }
      ]
    }
  }

  const RightSidebarContent = () => (
    <div className="space-y-6">
      {/* Access Information Card */}
      <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-amber-600" />
            {t('accessInformation', { defaultValue: 'Access Information' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertTitle>{t('confidentialAccess', { defaultValue: 'Confidential Access Granted' })}</AlertTitle>
            <AlertDescription>
              {t('accessDescription', { defaultValue: 'You have been granted access to confidential content. All information is protected by NDA.' })}
            </AlertDescription>
          </Alert>

          <div>
            <h4 className="text-sm font-medium mb-2">{t('accessRequirements', { defaultValue: 'Access Requirements' })}</h4>
            <ul className="space-y-1">
              {accessInfo.requirements.map((req, index) => (
                <li key={index} className="flex items-center gap-2 text-xs">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  {req}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">{t('memberBenefits', { defaultValue: 'Member Benefits' })}</h4>
            <ul className="space-y-1">
              {accessInfo.benefits.map((benefit, index) => (
                <li key={index} className="flex items-center gap-2 text-xs">
                  <Star className="h-3 w-3 text-amber-600" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Security Measures Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" />
            {t('securityMeasures', { defaultValue: 'Security Measures' })}
          </CardTitle>
          <CardDescription>
            {t('securityDescription', { defaultValue: 'How we protect confidential information' })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {securityMeasures.map((measure) => (
            <div key={measure.id} className="flex items-start gap-3">
              <div className="p-1 bg-green-100 rounded">
                <measure.icon className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium">{measure.title}</p>
                <p className="text-xs text-muted-foreground">{measure.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            {t('filters', { defaultValue: 'Filters' })}
          </CardTitle>
          <CardDescription>
            {t('filterDescription', { defaultValue: 'Refine your search within confidential content' })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {getFilters().map((filter) => (
            <div key={filter.id} className="space-y-2">
              <h4 className="text-sm font-medium">{filter.label}</h4>
              <div className="flex flex-wrap gap-1">
                {filter.options.map((option) => (
                  <Badge
                    key={option}
                    variant="outline"
                    className="text-xs cursor-pointer hover:bg-accent"
                  >
                    {option}
                  </Badge>
                ))}
              </div>
            </div>
          ))}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1">
              {t('applyFilters', { defaultValue: 'Apply Filters' })}
            </Button>
            <Button variant="ghost" size="sm">
              {t('clearAll', { defaultValue: 'Clear All' })}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Important Notices Card */}
      <Card className="border-red-200 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            {t('importantNotices', { defaultValue: 'Important Notices' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert className="border-red-200 bg-red-50 dark:bg-red-950">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-red-800 dark:text-red-200">
              {t('confidentialWarning', { defaultValue: 'Confidential Content' })}
            </AlertTitle>
            <AlertDescription className="text-red-700 dark:text-red-300">
              {t('confidentialWarningDesc', { defaultValue: 'Do not share confidential information outside this platform. All access is monitored.' })}
            </AlertDescription>
          </Alert>

          <div className="space-y-2 text-xs text-muted-foreground">
            <p>• {t('notice1', { defaultValue: 'All interactions are logged for security purposes' })}</p>
            <p>• {t('notice2', { defaultValue: 'Confidential content is only visible to verified members' })}</p>
            <p>• {t('notice3', { defaultValue: 'Report any security concerns immediately' })}</p>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => router.push(`/${locale}/docs/confidential`)}
          >
            {t('learnMore', { defaultValue: 'Learn More' })}
          </Button>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="min-h-screen bg-background text-foreground relative transition-colors duration-300">
      <div className="flex gap-6 min-h-screen">
        {/* Left Sidebar - Main Navigation (Desktop only) */}
        <div className="hidden md:block w-[280px] flex-shrink-0">
          <DesktopSidebar />
        </div>

        {/* Center Content Area */}
        <div className="flex-1 py-8 px-4 md:px-0 md:pr-6 lg:pb-8 pb-24">
          {children}
        </div>

        {/* Right Sidebar - Security & Access Info (Desktop only, 1024px+) */}
        <div className="hidden lg:block w-[320px] flex-shrink-0 py-8 pr-6">
          <div className="sticky top-8">
            <RightSidebarContent />
          </div>
        </div>
      </div>

      {/* Mobile/Tablet: Floating toggle sidebar for right sidebar content */}
      <FloatingSidebarToggle
        isOpen={rightSidebarOpen}
        onToggle={setRightSidebarOpen}
        mobileWidth="90%"
        tabletWidth="380px"
      >
        <RightSidebarContent />
      </FloatingSidebarToggle>
    </div>
  )
}
