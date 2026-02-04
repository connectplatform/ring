'use client'

/**
 * USER PROFILE WRAPPER - Ring Platform v2.0
 * ==========================================
 * Perfect 3-column responsive layout for public user profiles
 *
 * Strike Team: Ring Components Specialist
 */

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import DesktopSidebar from '@/components/navigation/desktop-sidebar'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import {
  Settings,
  Activity,
  Heart,
  ShoppingBag,
  Award,
  BookOpen,
  Share2
} from 'lucide-react'

interface UserProfileWrapperProps {
  children: React.ReactNode
  locale: string
  username: string
}

export default function UserProfileWrapper({
  children,
  locale,
  username
}: UserProfileWrapperProps) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const RightSidebarContent = () => (
    <div className="space-y-6">
      {/* User Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">NFTs Listed</span>
            <Badge variant="secondary">0</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Sales</span>
            <Badge variant="secondary">0</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Member Since</span>
            <Badge variant="secondary">2025</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            Share Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Share this profile with your network
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href)
              setRightSidebarOpen(false)
            }}
          >
            Copy Profile Link
          </Button>
        </CardContent>
      </Card>

      {/* Achievements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4" />
            Achievements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="outline">🌟</Badge>
            <span className="text-muted-foreground">Early Adopter</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">✅</Badge>
            <span className="text-muted-foreground">Verified User</span>
          </div>
        </CardContent>
      </Card>

      {/* Help & Resources */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Platform Guide
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Learn about Ring Platform features</p>
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

        {/* Right Sidebar (Desktop only, 1024px+) */}
        <div className="hidden lg:block w-[320px] flex-shrink-0 py-8 pr-6">
          <div className="sticky top-8">
            <RightSidebarContent />
          </div>
        </div>
      </div>

      {/* Mobile/Tablet: Floating toggle sidebar */}
      <FloatingSidebarToggle
        isOpen={rightSidebarOpen}
        onToggle={setRightSidebarOpen}
        mobileWidth="90%"
        tabletWidth="380px"
      >
        <RightSidebarContent />
      </FloatingSidebarToggle>

      {/* Floating Action Button (iPad & Mobile) */}
      {mounted && (
        <div className="lg:hidden fixed bottom-24 right-6 z-50">
          <Button
            size="lg"
            className="h-14 w-14 rounded-full shadow-2xl"
            onClick={() => setRightSidebarOpen(true)}
            title="Profile Info"
          >
            <Settings className="h-6 w-6" />
          </Button>
        </div>
      )}
    </div>
  )
}