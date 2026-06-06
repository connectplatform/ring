'use client'

/**
 * CONTACT PAGE WRAPPER - Zemna.AI
 * ===============================
 * 3-column responsive layout for the Contact page with a Zemna-specific right sidebar.
 *
 * Layout: DesktopSidebar (280px) + Center Content + Right Sidebar (320px)
 * Right sidebar: Zemna.AI info, Quick Links (Docs, Getting Started, Pricing, Support, Contact), Community, Need Help.
 * All labels localized via useTranslations('contact') → sidebar.*
 */

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import DesktopSidebar from '@/components/navigation/desktop-sidebar'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Info,
  BookOpen,
  Mail,
  HelpCircle,
  ExternalLink,
  MessageSquare,
  CreditCard,
  Rocket
} from 'lucide-react'
import { useTranslations } from 'next-intl'

interface ContactWrapperProps {
  children: React.ReactNode
  locale: string
}

export default function ContactWrapper({
  children,
  locale
}: ContactWrapperProps) {
  const router = useRouter()
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
  const t = useTranslations('contact')

  const quickLinks = [
    { label: t('sidebar.docs'), href: `/${locale}/docs`, icon: BookOpen },
    { label: t('sidebar.gettingStarted'), href: `/${locale}/getting-started`, icon: Rocket },
    { label: t('sidebar.pricing'), href: `/${locale}/pricing`, icon: CreditCard },
    { label: t('sidebar.support'), href: `/${locale}/support`, icon: HelpCircle },
    { label: t('sidebar.contact'), href: `/${locale}/contact`, icon: Mail },
  ]

  const RightSidebarContent = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            {t('sidebar.zemnaInfo')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{t('sidebar.zemnaInfoDesc')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {t('sidebar.quickLinks')}
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
            {t('sidebar.community')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => window.open('https://github.com/zemna-ai', '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            GitHub
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            {t('sidebar.needHelp')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{t('sidebar.needHelpDesc')}</p>
          <div className="space-y-2">
            <Button
              variant="link"
              className="p-0 h-auto text-sm"
              onClick={() => router.push(`/${locale}/docs`)}
            >
              {t('sidebar.documentation')}
            </Button>
            <Button
              variant="link"
              className="p-0 h-auto text-sm"
              onClick={() => router.push(`/${locale}/contact`)}
            >
              {t('sidebar.contactSupport')}
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
