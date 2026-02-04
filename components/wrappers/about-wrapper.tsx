'use client'

/**
 * ABOUT PAGE WRAPPER - Ring Platform v2.0
 * =======================================
 * Universal 3-column responsive layout for About/Informational pages
 *
 * Layout Structure:
 * - Desktop: DesktopSidebar (280px) + Center Content + Right Sidebar (320px)
 * - iPad: DesktopSidebar (280px) + Center Content + Floating Toggle for Right Sidebar
 * - Mobile: Center Content + Bottom Navigation + Floating Toggle for Right Sidebar
 *
 * Dynamic Right Sidebar Content:
 * - Platform Info
 * - Quick Links
 * - Social Media
 * - Newsletter Signup
 * - Help
 *
 * Strike Team:
 * - Ring Components Specialist (layout pattern)
 * - React 19 Specialist (modern patterns)
 */

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import DesktopSidebar from '@/components/navigation/desktop-sidebar'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Info,
  Users,
  Globe,
  Mail,
  HelpCircle,
  ExternalLink,
  BookOpen,
  MessageSquare,
  Settings
} from 'lucide-react'

interface AboutWrapperProps {
  children: React.ReactNode
  locale: string
}

export default function AboutWrapper({
  children,
  locale
}: AboutWrapperProps) {
  const router = useRouter()
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  // Quick links for informational pages
  const quickLinks = [
    { label: 'About Us', href: `/${locale}/about`, icon: Info },
    { label: 'Token Economy', href: `/${locale}/token-economy`, icon: Globe },
    { label: 'AI & Web3', href: `/${locale}/ai-web3`, icon: BookOpen },
    { label: 'Global Impact', href: `/${locale}/global-impact`, icon: Users },
    { label: 'Contact', href: `/${locale}/contact`, icon: Mail },
  ]

  const RightSidebarContent = () => (
    <div className="space-y-6">
      {/* Platform Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            Platform Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Ring Platform is an open-source solution for building decentralized communities and marketplaces.</p>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Version</span>
              <span className="font-medium text-foreground">2.0.0</span>
            </div>
            <div className="flex justify-between">
              <span>License</span>
              <span className="font-medium text-foreground">MIT</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Links Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Quick Links
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

      {/* Social & Community Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Community
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => window.open('https://github.com/connectplatform/ring', '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            GitHub
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => window.open('https://discord.gg/ring', '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Discord
          </Button>
        </CardContent>
      </Card>

      {/* Help Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Need Help?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Have questions? Check our documentation or reach out.</p>
          <div className="space-y-2">
            <Button
              variant="link"
              className="p-0 h-auto text-sm"
              onClick={() => router.push(`/${locale}/docs`)}
            >
              Documentation →
            </Button>
            <Button
              variant="link"
              className="p-0 h-auto text-sm"
              onClick={() => router.push(`/${locale}/contact`)}
            >
              Contact Support →
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
        <div className="flex-1 py-8 px-4 md:px-4 md:pr-6 lg:pb-8 pb-24">
          {children}
        </div>

        {/* Right Sidebar - Info & Links (Desktop only, 1024px+) */}
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
