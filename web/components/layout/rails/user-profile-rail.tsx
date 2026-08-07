'use client'

/**
 * USER PROFILE RAIL - Extracted right-rail content
 * Activity stats, share profile, achievements, and platform guide.
 */

import React from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Activity, Heart, ShoppingBag, Award, BookOpen, Share2 } from 'lucide-react'

export interface UserProfileRailProps {
  locale: string
  username: string
  onNavigate?: () => void
}

export function UserProfileRail({ locale, username, onNavigate }: UserProfileRailProps) {
  const router = useRouter()

  const navigate = (href: string) => {
    router.push(href)
    onNavigate?.()
  }

  return (
    <div className="space-y-6">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            Share Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">Share this profile with your network</p>
          <Button variant="outline" className="w-full" onClick={() => { navigator.clipboard.writeText(window.location.href); onNavigate?.() }}>
            Copy Profile Link
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4" />
            Achievements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2"><Badge variant="outline">🌟</Badge><span className="text-muted-foreground">Early Adopter</span></div>
          <div className="flex items-center gap-2"><Badge variant="outline">✅</Badge><span className="text-muted-foreground">Verified User</span></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Platform Guide
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Learn about Ring Platform features</p>
          <Button variant="link" className="p-0 h-auto" onClick={() => navigate(`/${locale}/docs`)}>
            View Documentation →
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
