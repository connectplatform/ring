'use client'

/**
 * ENTITY FORM PAGE WRAPPER - Ring Platform v2.0
 * ==============================================
 * Standardized 3-column responsive layout for entity form pages
 *
 * Layout Structure:
 * - Desktop: DesktopSidebar (280px) + Center Content + Right Sidebar (320px)
 * - iPad: DesktopSidebar (280px) + Center Content + Floating Toggle for Right Sidebar
 * - Mobile: Center Content + Bottom Navigation + Floating Toggle for Right Sidebar
 *
 * Right Sidebar Content:
 * - Entity Types
 * - Field Guide
 * - Verification Tips
 * - Help
 *
 * Strike Team:
 * - Ring Components Specialist (layout pattern)
 * - React 19 Specialist (modern patterns)
 * - Entity Domain Expert (entity creation flow)
 * - Form UX Expert (field guidance)
 * - Content Strategy Expert (verification tips)
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
import {
  Building2,
  HelpCircle,
  CheckCircle,
  AlertTriangle,
  Info,
  BookOpen,
  FileText,
  Tag,
  Eye,
  Shield,
  Award,
  Users,
  Globe,
  Cpu,
  Factory,
  Lightbulb
} from 'lucide-react'
import { ROUTES } from '@/constants/routes'

interface EntityFormWrapperProps {
  children: React.ReactNode
  locale: string
}

export default function EntityFormWrapper({
  children,
  locale
}: EntityFormWrapperProps) {
  const router = useRouter()
  const t = useTranslations('modules.entities')
  const tCommon = useTranslations('common')
  const [mounted, setMounted] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Entity types
  const entityTypes = [
    {
      id: 'software-development',
      name: t('types.softwareDevelopment', { defaultValue: 'Software Development' }),
      description: t('types.softwareDevelopmentDesc', { defaultValue: 'Tech companies, startups, development agencies' }),
      icon: Cpu,
      color: 'blue'
    },
    {
      id: 'manufacturing',
      name: t('types.manufacturing', { defaultValue: 'Manufacturing' }),
      description: t('types.manufacturingDesc', { defaultValue: 'Manufacturing companies and factories' }),
      icon: Factory,
      color: 'orange'
    },
    {
      id: 'technology-center',
      name: t('types.technologyCenter', { defaultValue: 'Technology Center' }),
      description: t('types.technologyCenterDesc', { defaultValue: 'Research centers, innovation hubs, tech parks' }),
      icon: Lightbulb,
      color: 'yellow'
    },
    {
      id: 'other',
      name: t('types.other', { defaultValue: 'Other' }),
      description: t('types.otherDesc', { defaultValue: 'Consulting, services, and other organizations' }),
      icon: Building2,
      color: 'gray'
    }
  ]

  // Field guidance
  const fieldGuide = [
    {
      field: 'name',
      title: t('fields.name', { defaultValue: 'Entity Name' }),
      required: true,
      tip: t('fieldTips.name', { defaultValue: 'Use your official company or organization name' }),
      icon: Building2
    },
    {
      field: 'description',
      title: t('fields.description', { defaultValue: 'Description' }),
      required: true,
      tip: t('fieldTips.description', { defaultValue: 'Describe what your organization does, your mission, and unique value' }),
      icon: FileText
    },
    {
      field: 'website',
      title: t('fields.website', { defaultValue: 'Website' }),
      required: false,
      tip: t('fieldTips.website', { defaultValue: 'Your official website URL for credibility and contact' }),
      icon: Globe
    },
    {
      field: 'logo',
      title: t('fields.logo', { defaultValue: 'Logo' }),
      required: false,
      tip: t('fieldTips.logo', { defaultValue: 'High-quality logo helps users recognize your brand' }),
      icon: Award
    },
    {
      field: 'tags',
      title: t('fields.tags', { defaultValue: 'Tags' }),
      required: false,
      tip: t('fieldTips.tags', { defaultValue: 'Add relevant keywords for better discoverability' }),
      icon: Tag
    }
  ]

  // Verification tips
  const verificationTips = [
    {
      id: 'official',
      title: t('verification.official', { defaultValue: 'Use Official Information' }),
      description: t('verification.officialDesc', { defaultValue: 'Only submit information about entities you officially represent' }),
      icon: Shield,
      priority: 'high'
    },
    {
      id: 'accurate',
      title: t('verification.accurate', { defaultValue: 'Keep Information Current' }),
      description: t('verification.accurateDesc', { defaultValue: 'Update contact information and details as they change' }),
      icon: CheckCircle,
      priority: 'medium'
    },
    {
      id: 'complete',
      title: t('verification.complete', { defaultValue: 'Complete Profile' }),
      description: t('verification.completeDesc', { defaultValue: 'Fill out all fields for better visibility and credibility' }),
      icon: Info,
      priority: 'medium'
    },
    {
      id: 'unique',
      title: t('verification.unique', { defaultValue: 'One Entity Per Submission' }),
      description: t('verification.uniqueDesc', { defaultValue: 'Create separate submissions for different entities' }),
      icon: AlertTriangle,
      priority: 'low'
    }
  ]

  // Visibility options
  const visibilityOptions = [
    {
      id: 'public',
      name: t('visibility.public', { defaultValue: 'Public' }),
      description: t('visibility.publicDesc', { defaultValue: 'Visible to all Ring platform users' }),
      icon: Eye,
      badge: 'default'
    },
    {
      id: 'members',
      name: t('visibility.members', { defaultValue: 'Members Only' }),
      description: t('visibility.membersDesc', { defaultValue: 'Visible only to verified members' }),
      icon: Users,
      badge: 'secondary'
    }
  ]

  const RightSidebarContent = () => (
    <div className="space-y-6">
      {/* Entity Types Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {t('entityTypes', { defaultValue: 'Entity Types' })}
          </CardTitle>
          <CardDescription>
            {t('chooseTypeDescription', { defaultValue: 'Select the category that best describes your organization' })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {entityTypes.map((type) => (
            <div key={type.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors">
              <div className="p-2 bg-primary/10 rounded-lg">
                <type.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{type.name}</p>
                <p className="text-xs text-muted-foreground">{type.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Field Guide Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {t('fieldGuide', { defaultValue: 'Field Guide' })}
          </CardTitle>
          <CardDescription>
            {t('fieldGuideDescription', { defaultValue: 'Tips for filling out each field correctly' })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {fieldGuide.map((field) => (
            <div key={field.field} className="flex items-start gap-3">
              <div className="p-1 bg-primary/10 rounded mt-0.5">
                <field.icon className="h-3 w-3 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium">{field.title}</p>
                  {field.required && (
                    <Badge variant="destructive" className="text-xs">
                      {t('required', { defaultValue: 'Required' })}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{field.tip}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Verification Tips Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {t('verificationTips', { defaultValue: 'Verification Tips' })}
          </CardTitle>
          <CardDescription>
            {t('verificationDescription', { defaultValue: 'Ensure your entity submission meets our standards' })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {verificationTips.map((tip) => (
            <div key={tip.id} className="flex items-start gap-3">
              <div className={`p-1 rounded ${
                tip.priority === 'high' ? 'bg-red-100 text-red-600' :
                tip.priority === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                'bg-green-100 text-green-600'
              }`}>
                <tip.icon className="h-3 w-3" />
              </div>
              <div>
                <p className="text-sm font-medium">{tip.title}</p>
                <p className="text-xs text-muted-foreground">{tip.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Visibility Options Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4" />
            {t('visibilityOptions', { defaultValue: 'Visibility Options' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {visibilityOptions.map((option) => (
            <div key={option.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent">
              <div className="p-1 bg-muted rounded">
                <option.icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{option.name}</p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </div>
              {option.badge === 'secondary' && (
                <Users className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Help & Documentation Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            {t('help', { defaultValue: 'Help & Documentation' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{t('entityHelpDescription', { defaultValue: 'Get help with creating and managing your entity profile.' })}</p>
          <div className="space-y-2">
            <Button
              variant="link"
              className="p-0 h-auto text-sm"
              onClick={() => router.push(`/${locale}/docs/entities/creating`)}
            >
              {t('creatingEntities', { defaultValue: 'Creating Entities' })} →
            </Button>
            <Button
              variant="link"
              className="p-0 h-auto text-sm"
              onClick={() => router.push(`/${locale}/docs/entities/best-practices`)}
            >
              {t('bestPractices', { defaultValue: 'Best Practices' })} →
            </Button>
            <Button
              variant="link"
              className="p-0 h-auto text-sm"
              onClick={() => router.push(`/${locale}/docs/entities/verification`)}
            >
              {t('verificationGuide', { defaultValue: 'Verification Guide' })} →
            </Button>
          </div>
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

        {/* Right Sidebar - Form Guidance & Tips (Desktop only, 1024px+) */}
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