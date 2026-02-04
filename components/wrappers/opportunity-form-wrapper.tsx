'use client'

/**
 * OPPORTUNITY FORM PAGE WRAPPER - Ring Platform v2.0
 * ==================================================
 * Standardized 3-column responsive layout for opportunity form pages
 *
 * Layout Structure:
 * - Desktop: DesktopSidebar (280px) + Center Content + Right Sidebar (320px)
 * - iPad: DesktopSidebar (280px) + Center Content + Floating Toggle for Right Sidebar
 * - Mobile: Center Content + Bottom Navigation + Floating Toggle for Right Sidebar
 *
 * Right Sidebar Content:
 * - Creation Tips
 * - Categories Guide
 * - Visibility Options
 * - Help
 *
 * Strike Team:
 * - Ring Components Specialist (layout pattern)
 * - React 19 Specialist (modern patterns)
 * - Form UX Expert (opportunity creation flow)
 * - Content Strategy Expert (guidance and tips)
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
import {
  Lightbulb,
  Tag,
  Eye,
  HelpCircle,
  Search,
  Briefcase,
  User,
  Lock,
  CheckCircle,
  AlertCircle,
  Info,
  BookOpen
} from 'lucide-react'
import { ROUTES } from '@/constants/routes'

interface OpportunityFormWrapperProps {
  children: React.ReactNode
  locale: string
  opportunityType?: 'request' | 'offer' | 'cv'
}

export default function OpportunityFormWrapper({
  children,
  locale,
  opportunityType
}: OpportunityFormWrapperProps) {
  const router = useRouter()
  const t = useTranslations('modules.opportunities')
  const tCommon = useTranslations('common')
  const [mounted, setMounted] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Opportunity categories
  const categories = [
    {
      id: 'partnership',
      name: t('categories.partnership', { defaultValue: 'Partnership' }),
      description: t('categories.partnershipDesc', { defaultValue: 'Business partnerships and collaborations' }),
      icon: '🤝'
    },
    {
      id: 'investment',
      name: t('categories.investment', { defaultValue: 'Investment' }),
      description: t('categories.investmentDesc', { defaultValue: 'Investment opportunities and funding' }),
      icon: '💰'
    },
    {
      id: 'sales',
      name: t('categories.sales', { defaultValue: 'Sales' }),
      description: t('categories.salesDesc', { defaultValue: 'Sales and business development' }),
      icon: '📈'
    },
    {
      id: 'procurement',
      name: t('categories.procurement', { defaultValue: 'Procurement' }),
      description: t('categories.procurementDesc', { defaultValue: 'Procurement and supplier opportunities' }),
      icon: '🛒'
    },
    {
      id: 'consulting',
      name: t('categories.consulting', { defaultValue: 'Consulting' }),
      description: t('categories.consultingDesc', { defaultValue: 'Consulting and advisory services' }),
      icon: '🎯'
    },
    {
      id: 'development',
      name: t('categories.development', { defaultValue: 'Development' }),
      description: t('categories.developmentDesc', { defaultValue: 'Software and product development' }),
      icon: '💻'
    }
  ]

  // Opportunity types
  const opportunityTypes = [
    {
      id: 'request',
      name: t('types.request', { defaultValue: 'Request' }),
      description: t('types.requestDesc', { defaultValue: 'Find services, advice, or collaboration from the Ring community' }),
      icon: '🔍',
      color: 'blue',
      minRole: 'subscriber'
    },
    {
      id: 'offer',
      name: t('types.offer', { defaultValue: 'Offer' }),
      description: t('types.offerDesc', { defaultValue: 'Post official opportunities from your organization' }),
      icon: '💼',
      color: 'green',
      minRole: 'member'
    },
    {
      id: 'cv',
      name: t('types.cv', { defaultValue: 'Developer CV' }),
      description: t('types.cvDesc', { defaultValue: 'Share your developer profile and skills' }),
      icon: '👔',
      color: 'purple',
      minRole: 'subscriber'
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
      id: 'subscriber',
      name: t('visibility.subscriber', { defaultValue: 'Subscribers Only' }),
      description: t('visibility.subscriberDesc', { defaultValue: 'Visible to subscribers and above' }),
      icon: User,
      badge: 'secondary'
    },
    {
      id: 'confidential',
      name: t('visibility.confidential', { defaultValue: 'Confidential' }),
      description: t('visibility.confidentialDesc', { defaultValue: 'Visible only to confidential members' }),
      icon: Lock,
      badge: 'destructive'
    }
  ]

  // Creation tips based on type
  const getCreationTips = () => {
    switch (opportunityType) {
      case 'request':
        return [
          {
            title: t('tips.request.title1', { defaultValue: 'Be Specific' }),
            description: t('tips.request.desc1', { defaultValue: 'Clearly describe what you need and your budget' }),
            icon: Search
          },
          {
            title: t('tips.request.title2', { defaultValue: 'Set Expectations' }),
            description: t('tips.request.desc2', { defaultValue: 'Include timeline and deliverables clearly' }),
            icon: CheckCircle
          },
          {
            title: t('tips.request.title3', { defaultValue: 'Choose Wisely' }),
            description: t('tips.request.desc3', { defaultValue: 'Review proposals carefully before accepting' }),
            icon: AlertCircle
          }
        ]
      case 'offer':
        return [
          {
            title: t('tips.offer.title1', { defaultValue: 'Professional Presentation' }),
            description: t('tips.offer.desc1', { defaultValue: 'Present your opportunity professionally' }),
            icon: Briefcase
          },
          {
            title: t('tips.offer.title2', { defaultValue: 'Clear Requirements' }),
            description: t('tips.offer.desc2', { defaultValue: 'Specify requirements and qualifications' }),
            icon: CheckCircle
          },
          {
            title: t('tips.offer.title3', { defaultValue: 'Fair Compensation' }),
            description: t('tips.offer.desc3', { defaultValue: 'Offer competitive compensation' }),
            icon: AlertCircle
          }
        ]
      case 'cv':
        return [
          {
            title: t('tips.cv.title1', { defaultValue: 'Highlight Skills' }),
            description: t('tips.cv.desc1', { defaultValue: 'Showcase your technical expertise' }),
            icon: User
          },
          {
            title: t('tips.cv.title2', { defaultValue: 'Include Projects' }),
            description: t('tips.cv.desc2', { defaultValue: 'Link to your work and achievements' }),
            icon: CheckCircle
          },
          {
            title: t('tips.cv.title3', { defaultValue: 'Be Available' }),
            description: t('tips.cv.desc3', { defaultValue: 'Indicate your availability for opportunities' }),
            icon: AlertCircle
          }
        ]
      default:
        return [
          {
            title: t('tips.general.title1', { defaultValue: 'Choose Right Type' }),
            description: t('tips.general.desc1', { defaultValue: 'Select the most appropriate opportunity type' }),
            icon: Lightbulb
          },
          {
            title: t('tips.general.title2', { defaultValue: 'Complete Information' }),
            description: t('tips.general.desc2', { defaultValue: 'Provide all required information' }),
            icon: CheckCircle
          },
          {
            title: t('tips.general.title3', { defaultValue: 'Review Before Submit' }),
            description: t('tips.general.desc3', { defaultValue: 'Review your opportunity before publishing' }),
            icon: AlertCircle
          }
        ]
    }
  }

  const RightSidebarContent = () => (
    <div className="space-y-6">
      {/* Creation Tips Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            {t('creationTips', { defaultValue: 'Creation Tips' })}
          </CardTitle>
          <CardDescription>
            {t('tipsDescription', { defaultValue: 'Tips for creating effective opportunities' })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {getCreationTips().map((tip, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="p-1 bg-primary/10 rounded">
                <tip.icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{tip.title}</p>
                <p className="text-xs text-muted-foreground">{tip.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Categories Guide Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4" />
            {t('categoriesGuide', { defaultValue: 'Categories Guide' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {categories.map((category) => (
            <div key={category.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent">
              <span className="text-lg">{category.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{category.name}</p>
                <p className="text-xs text-muted-foreground">{category.description}</p>
              </div>
            </div>
          ))}

          <Button
            variant="link"
            className="w-full p-0 h-auto"
            onClick={() => router.push(`/${locale}/docs/opportunities/categories`)}
          >
            {t('viewAllCategories', { defaultValue: 'View All Categories' })} →
          </Button>
        </CardContent>
      </Card>

      {/* Opportunity Types Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            {t('opportunityTypes', { defaultValue: 'Opportunity Types' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {opportunityTypes.map((type) => (
            <div
              key={type.id}
              className={`p-3 border rounded-lg transition-colors ${
                opportunityType === type.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-accent'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{type.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{type.name}</p>
                    <Badge variant="outline" className="text-xs">
                      {type.minRole}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{type.description}</p>
                </div>
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
              {option.badge === 'destructive' && (
                <Lock className="h-4 w-4 text-muted-foreground" />
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
          <p>{t('helpDescription', { defaultValue: 'Get help with creating and managing opportunities.' })}</p>
          <div className="space-y-2">
            <Button
              variant="link"
              className="p-0 h-auto text-sm"
              onClick={() => router.push(`/${locale}/docs/opportunities/creating`)}
            >
              {t('creatingGuide', { defaultValue: 'Creating Opportunities' })} →
            </Button>
            <Button
              variant="link"
              className="p-0 h-auto text-sm"
              onClick={() => router.push(`/${locale}/docs/opportunities/best-practices`)}
            >
              {t('bestPractices', { defaultValue: 'Best Practices' })} →
            </Button>
            <Button
              variant="link"
              className="p-0 h-auto text-sm"
              onClick={() => router.push(`/${locale}/docs/opportunities/faq`)}
            >
              {t('faq', { defaultValue: 'FAQ' })} →
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
