'use client'

/**
 * ABOUT PAGE WRAPPER - Ring Platform v2.0
 * Right rail driven by ring-config.json sidebar section.
 */

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Info,
  Users,
  Globe,
  Mail,
  HelpCircle,
  ExternalLink,
  BookOpen,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react'
import {
  getRingConfigSnapshot,
  getResolvedSidebarStats,
  resolveSocialUrlFromConfig,
} from '@/lib/ring-config-core'

interface AboutWrapperProps {
  children: React.ReactNode
  locale: string
}

const ICON_MAP: Record<string, LucideIcon> = {
  Info,
  Users,
  Globe,
  Mail,
  BookOpen,
  MessageSquare,
  HelpCircle,
  ExternalLink,
}

export default function AboutWrapper({ children, locale }: AboutWrapperProps) {
  const router = useRouter()
  const t = useTranslations('about.sidebar')
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  const ringConfig = getRingConfigSnapshot()

  const quickLinks =
    ringConfig.sidebar?.quickLinks?.map((link) => ({
      label: t(link.labelKey.replace('about.sidebar.', '')),
      href: `/${locale}${link.href}`,
      icon: ICON_MAP[link.icon || 'Info'] || Info,
    })) ?? []

  const communityLinks =
    ringConfig.sidebar?.community?.map((link) => ({
      label: t(link.labelKey.replace('about.sidebar.', '')),
      url: resolveSocialUrlFromConfig(link.urlKey, ringConfig),
    })) ?? []

  const stats = getResolvedSidebarStats().map((stat) => ({
    label: t(stat.labelKey.replace('about.sidebar.', '')),
    value: stat.value,
  }))

  const RightSidebarContent = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            {t('platformInfo')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{t('platformInfoDesc')}</p>
          {stats.length > 0 && (
            <div className="space-y-2">
              {stats.map((stat) => (
                <div key={stat.label} className="flex justify-between">
                  <span>{stat.label}</span>
                  <span className="font-medium text-foreground">{stat.value}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {quickLinks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              {t('quickLinks')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickLinks.map((link) => (
              <Button
                key={link.href}
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  router.push(link.href)
                  setRightSidebarOpen(false)
                }}
              >
                <link.icon className="h-4 w-4 mr-2" />
                {link.label}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {communityLinks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              {t('community')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {communityLinks.map((link) => (
              <Button
                key={link.url}
                variant="outline"
                className="w-full justify-start"
                onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {link.label}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            {t('needHelp')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{t('needHelpDesc')}</p>
          <div className="space-y-2">
            <Button
              variant="link"
              className="p-0 h-auto text-sm"
              onClick={() => router.push(`/${locale}/docs`)}
            >
              {t('documentation')}
            </Button>
            <Button
              variant="link"
              className="p-0 h-auto text-sm"
              onClick={() => router.push(`/${locale}/contact`)}
            >
              {t('contactSupport')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="min-h-full text-foreground relative transition-colors duration-300">
      <div className="flex min-h-full gap-3">
        <div className="ring-content-panel flex-1 min-w-0 pb-24 lg:pb-8">{children}</div>
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
