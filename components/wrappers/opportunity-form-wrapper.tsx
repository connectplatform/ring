'use client'

/**
 * Opportunity form layout — center content + right guidance rail (add/edit only).
 * Locale keys: locales/{locale}/modules/opportunities.json (type_selector, creationTips).
 */

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Lightbulb,
  Tag,
  Eye,
  HelpCircle,
  Search,
  Briefcase,
  User,
  Lock,
  BookOpen,
} from 'lucide-react'

interface OpportunityFormWrapperProps {
  children: React.ReactNode
  locale: string
  opportunityType?: 'request' | 'offer' | 'cv' | 'ring_customization'
}

export default function OpportunityFormWrapper({
  children,
  locale,
  opportunityType,
}: OpportunityFormWrapperProps) {
  const router = useRouter()
  const t = useTranslations('modules.opportunities')
  const [mounted, setMounted] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const categoryItems = [
    { id: 'partnership', name: t('type_selector.partnership.title'), description: t('type_selector.partnership.description'), icon: '🤝' },
    { id: 'investment', name: t('investment'), icon: '💰' },
    { id: 'sales', name: t('sales'), icon: '📈' },
    { id: 'procurement', name: t('procurement'), icon: '🛒' },
    { id: 'technology', name: t('technology'), icon: '💻' },
    { id: 'business', name: t('business'), icon: '🎯' },
  ]

  const opportunityTypes = [
    {
      id: 'request' as const,
      name: t('type_selector.request.title'),
      description: t('type_selector.request.description'),
      icon: '🔍',
      minRole: 'subscriber',
    },
    {
      id: 'offer' as const,
      name: t('type_selector.offer.title'),
      description: t('type_selector.offer.description'),
      icon: '💼',
      minRole: 'member',
    },
    {
      id: 'cv' as const,
      name: t('type_selector.cv.title'),
      description: t('type_selector.cv.description'),
      icon: '👔',
      minRole: 'subscriber',
    },
  ]

  const creationTipItems = (() => {
    switch (opportunityType) {
      case 'request':
        return [
          { title: t('creationTips.requestType'), description: t('creationTips.requestTypeDescription'), icon: Search },
        ]
      case 'offer':
        return [
          { title: t('creationTips.offerType'), description: t('creationTips.offerTypeDescription'), icon: Briefcase },
        ]
      case 'cv':
        return [
          { title: t('creationTips.cvType'), description: t('creationTips.cvTypeDescription'), icon: User },
        ]
      default:
        return [
          { title: t('creationTips.requestType'), description: t('creationTips.requestTypeDescription'), icon: Search },
          { title: t('creationTips.offerType'), description: t('creationTips.offerTypeDescription'), icon: Briefcase },
          { title: t('creationTips.cvType'), description: t('creationTips.cvTypeDescription'), icon: User },
        ]
    }
  })()

  const RightSidebarContent = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            {t('type_selector.title')}
          </CardTitle>
          <CardDescription>{t('opportunitiesDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {creationTipItems.map((tip, index) => (
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4" />
            {t('categories')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {categoryItems.map((category) => (
            <div key={category.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent">
              <span className="text-lg">{category.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{category.name}</p>
                {'description' in category && category.description ? (
                  <p className="text-xs text-muted-foreground">{category.description}</p>
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            {t('type_selector.title')}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4" />
            {t('confidential')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3 p-2 rounded-lg">
            <div className="p-1 bg-muted rounded">
              <Lock className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{t('creationTips.confidentialOpportunities')}</p>
              <p className="text-xs text-muted-foreground">
                {t('creationTips.confidentialOpportunitiesDescription')}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t('confidentialOpportunityDescription')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            {t('helpResources')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{t('opportunitiesHelp')}</p>
          <Button
            variant="link"
            className="p-0 h-auto text-sm"
            onClick={() => router.push(`/${locale}/docs/opportunities`)}
          >
            {t('viewGuide')} →
          </Button>
        </CardContent>
      </Card>
    </div>
  )

  if (!mounted) {
    return <div className="min-h-[40vh]">{children}</div>
  }

  return (
    <div className="min-h-full text-foreground relative transition-colors duration-300">
      <div className="flex min-h-full gap-3">
        <div className="ring-content-panel flex-1 min-w-0 pb-24 lg:pb-8">
          {children}
        </div>

        <div className="ring-right-rail hidden w-[300px] shrink-0 self-stretch min-h-0 lg:block">
          <div className="sticky top-8">
            <RightSidebarContent />
          </div>
        </div>
      </div>

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
