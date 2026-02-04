'use client'

/**
 * NEWS PAGE WRAPPER - Ring Platform v2.0
 * ======================================
 * Perfect 3-column responsive layout pattern
 * 
 * Layout Structure:
 * - Desktop: DesktopSidebar (280px) + Center Content + Right Sidebar (320px)
 * - iPad: DesktopSidebar (280px) + Center Content + Floating Toggle for Right Sidebar
 * - Mobile: Center Content + Bottom Navigation + Floating Toggle for Right Sidebar
 * 
 * Strike Team:
 * - Ring Components Specialist (architectural consistency)
 * - Tailwind CSS 4 Specialist (responsive design)
 * - React 19 Specialist (modern patterns)
 */

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Locale } from '@/i18n-config'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import DesktopSidebar from '@/components/navigation/desktop-sidebar'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import { 
  Rss, 
  TrendingUp, 
  Newspaper,
  Bell,
  Settings,
  BookOpen,
  Calendar
} from 'lucide-react'

interface NewsPageWrapperProps {
  children: React.ReactNode
  locale: string
  categoryInfo: Record<string, { name: string; description: string; color: string; icon: string; articleCount: number }>
  translations: any
}

export default function NewsPageWrapper({ 
  children, 
  locale, 
  categoryInfo,
  translations 
}: NewsPageWrapperProps) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const RightSidebarContent = () => (
    <div className="space-y-6">
      {/* Trending Articles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Trending
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Most popular articles this week
          </p>
          {/* TODO: Implement trending articles */}
        </CardContent>
      </Card>

      {/* Newsletter Subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Newsletter
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Get the latest news and updates delivered to your inbox
          </p>
          <Button className="w-full" variant="default">
            Subscribe
          </Button>
        </CardContent>
      </Card>

      {/* RSS Feeds */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Rss className="h-4 w-4" />
            RSS Feeds
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <a
            href="/api/news/rss"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            <Rss className="h-4 w-4" />
            All News
          </a>
          {Object.keys(categoryInfo).slice(0, 4).map((key) => (
            <a
              key={key}
              href={`/api/news/rss?category=${key}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              <Rss className="h-4 w-4" />
              {translations.news?.categories?.[key] || categoryInfo[key].name}
            </a>
          ))}
        </CardContent>
      </Card>

      {/* Upcoming Events */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Upcoming Events
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Stay updated on community events and webinars
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push(`/${locale}/news/category/events`)}
          >
            View Events
          </Button>
        </CardContent>
      </Card>

      {/* Help & Documentation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Help & Resources
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Learn about our platform features and updates</p>
          <Button
            variant="link"
            className="p-0 h-auto"
            onClick={() => router.push(`/${locale}/docs`)}
          >
            View Documentation →
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

        {/* Right Sidebar - Quick Actions & RSS (Desktop only, 1024px+) */}
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

