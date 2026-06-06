'use client'

/**
 * ABOUT PAGE WRAPPER - Ring Platform v2.0
 */

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import DesktopSidebar from '@/components/navigation/desktop-sidebar'
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
} from 'lucide-react'

interface AboutWrapperProps {
  children: React.ReactNode
  locale: string
}

export default function AboutWrapper({ children, locale }: AboutWrapperProps) {
  const router = useRouter()
  const t = useTranslations('about.sidebar')
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  const quickLinks = [
    { label: t('aboutUs'), href: `/${locale}/about`, icon: Info },
    { label: t('tokenEconomy'), href: `/${locale}/token-economy`, icon: Globe },
    { label: t('aiWeb3'), href: `/${locale}/ai-web3`, icon: BookOpen },
    { label: t('globalImpact'), href: `/${locale}/global-impact`, icon: Users },
    { label: t('contact'), href: `/${locale}/contact`, icon: Mail },
  ]

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
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>{t('version')}</span>
              <span className="font-medium text-foreground">2.0.0</span>
            </div>
            <div className="flex justify-between">
              <span>{t('license')}</span>
              <span className="font-medium text-foreground">MIT</span>
            </div>
          </div>
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {t('community')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => window.open(t('githubUrl'), '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            {t('github')}
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => window.open(t('discordUrl'), '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            {t('discord')}
          </Button>
        </CardContent>
      </Card>

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
    <div className="min-h-screen bg-background text-foreground relative transition-colors duration-300">
      <div className="flex gap-6 min-h-screen">
        <div className="hidden md:block w-[280px] flex-shrink-0">
          <DesktopSidebar />
        </div>
        <div className="flex-1 py-8 px-4 md:px-4 md:pr-6 lg:pb-8 pb-24">
          {children}
        </div>
        <div className="hidden lg:block w-[320px] flex-shrink-0 py-8 pr-6">
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
