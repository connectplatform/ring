'use client'

import React, { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  Settings,
  User,
  Shield,
  Bell,
  Palette,
  Globe,
  CreditCard,
  HelpCircle,
  BookOpen,
  Sparkles,
  TrendingUp,
  Eye,
  EyeOff
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import DesktopSidebar from '@/components/navigation/desktop-sidebar'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import type { Locale } from '@/i18n-config'

interface SettingsWrapperProps {
  children: React.ReactNode
  locale: Locale
  userStats?: {
    accountAge: string
    lastLogin: string
    profileCompleteness: number
  }
}

export default function SettingsWrapper({
  children,
  locale,
  userStats
}: SettingsWrapperProps) {
  const t = useTranslations('settings')
  const router = useRouter()

  function RightSidebarContent() {
    return (
      <div className="space-y-6">
        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Account Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Profile Complete</span>
              <Badge variant="secondary">{userStats?.profileCompleteness || 85}%</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Member Since</span>
              <span className="text-xs">{userStats?.accountAge || '2024'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Last Login</span>
              <span className="text-xs">{userStats?.lastLogin || 'Today'}</span>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => router.push(`/${locale}/settings/notifications`)}
            >
              <Bell className="h-4 w-4 mr-2" />
              Notification Settings
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => router.push(`/${locale}/wallet`)}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Wallet & Payments
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => router.push(`/${locale}/profile`)}
            >
              <User className="h-4 w-4 mr-2" />
              Public Profile
            </Button>
          </CardContent>
        </Card>

        {/* Privacy Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Privacy at a Glance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Profile Visibility</span>
              <Badge variant="outline" className="text-xs">
                <Eye className="h-3 w-3 mr-1" />
                Public
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Data Sharing</span>
              <Badge variant="outline" className="text-xs">
                <EyeOff className="h-3 w-3 mr-1" />
                Private
              </Badge>
            </div>
            <Separator />
            <Button variant="outline" size="sm" className="w-full">
              <Shield className="h-4 w-4 mr-2" />
              Privacy Center
            </Button>
          </CardContent>
        </Card>

        {/* Help Resources */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Help & Resources
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="ghost" size="sm" className="w-full justify-start">
              <HelpCircle className="h-4 w-4 mr-2" />
              Settings Guide
            </Button>
            <Button variant="ghost" size="sm" className="w-full justify-start">
              <BookOpen className="h-4 w-4 mr-2" />
              Privacy Policy
            </Button>
            <Button variant="ghost" size="sm" className="w-full justify-start">
              <Globe className="h-4 w-4 mr-2" />
              Support Center
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex gap-6 min-h-screen">
        {/* Desktop Sidebar - hidden md:block */}
        <div className="hidden md:block w-[280px]">
          <DesktopSidebar />
        </div>

        {/* Main Content */}
        <div className="flex-1 py-8 px-4 md:px-0 md:pr-6 lg:pb-8 pb-24">
          {children}
        </div>

        {/* Right Sidebar Desktop - hidden lg:block */}
        <div className="hidden lg:block w-[320px] sticky top-8 h-fit">
          <RightSidebarContent />
        </div>
      </div>

      {/* Floating Sidebar Toggle */}
      <FloatingSidebarToggle>
        <RightSidebarContent />
      </FloatingSidebarToggle>
    </div>
  )
}