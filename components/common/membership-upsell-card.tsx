'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Crown,
  Check,
  X,
  Sparkles,
  Target,
  Users,
  TrendingUp,
  Shield,
  Zap
} from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n-config'

interface MembershipUpsellCardProps {
  className?: string
  compact?: boolean
  variant?: 'default' | 'ring_customization'
}

export default function MembershipUpsellCard({
  className,
  compact = false,
  variant = 'default'
}: MembershipUpsellCardProps) {
  const router = useRouter()
  const locale = useLocale() as Locale
  const t = useTranslations('common.membership')
  const tRing = useTranslations('common.ring_customization_upsell')
  const [dismissed, setDismissed] = useState(false)

  // Check if user has dismissed this card before
  const dismissalKey = 'membership-upsell-dismissed'
  const [isDismissed, setIsDismissed] = useState(false)

  // Load dismissal state from localStorage after hydration
  useEffect(() => {
    const dismissedValue = localStorage.getItem(dismissalKey) === 'true'
    setIsDismissed(dismissedValue)
  }, [])

  const handleDismiss = () => {
    setDismissed(true)
    setIsDismissed(true)
    if (typeof window !== 'undefined') {
      localStorage.setItem(dismissalKey, 'true')
    }
  }

  const handleUpgrade = () => {
    router.push(ROUTES.MEMBERSHIP(locale))
  }

  if (isDismissed || dismissed) {
    return null
  }

  // Conditional benefits based on variant
  const benefits = variant === 'ring_customization' ? [
    { icon: Zap, text: tRing('benefits.post_project') || 'Post your Ring customization project' },
    { icon: Target, text: tRing('benefits.find_developers') || 'Connect with Ring expert developers' },
    { icon: Sparkles, text: tRing('benefits.ai_matching') || 'AI matches your project with specialists' },
    { icon: Shield, text: tRing('benefits.verified_badge') || 'Verified project owner badge' },
    { icon: TrendingUp, text: tRing('benefits.priority_listing') || 'Priority project visibility' },
    { icon: Users, text: tRing('benefits.developer_pool') || 'Access to Ring developer network' }
  ] : [
    { icon: Target, text: t('benefits.priority') || 'Priority opportunity listings' },
    { icon: Sparkles, text: t('benefits.ai') || 'AI-powered matching' },
    { icon: Shield, text: t('benefits.badge') || 'Verified organization badge' },
    { icon: TrendingUp, text: t('benefits.analytics') || 'Advanced analytics dashboard' },
    { icon: Users, text: t('benefits.collaboration') || 'Premium collaboration tools' },
    { icon: Zap, text: t('benefits.support') || 'Priority customer support' }
  ]

  if (compact) {
    return (
      <Card className={`bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-blue-200 dark:border-blue-800 ${className}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-yellow-500" />
              <span className="font-semibold text-sm text-foreground">
                {variant === 'ring_customization' 
                  ? (tRing('title') || 'Need Ring Customization?')
                  : 'Premium Membership'}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-red-100 dark:hover:bg-red-900/20"
              onClick={handleDismiss}
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mb-3">
            {variant === 'ring_customization'
              ? (tRing('description') || 'Upgrade to post your Ring platform customization project and connect with expert developers')
              : 'Unlock premium features and get more opportunities'}
          </p>

          <div className="space-y-1 mb-3">
            {benefits.slice(0, 3).map((benefit, index) => {
              const IconComponent = benefit.icon
              return (
                <div key={index} className="flex items-center gap-2">
                  <Check className="w-3 h-3 text-green-500 dark:text-green-400 flex-shrink-0" />
                  <span className="text-xs text-foreground">{benefit.text}</span>
                </div>
              )
            })}
          </div>

          <Button
            size="sm"
            className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 dark:from-blue-600 dark:to-purple-600 dark:hover:from-blue-700 dark:hover:to-purple-700 text-white"
            onClick={handleUpgrade}
          >
            <Crown className="w-3 h-3 mr-1" />
            {variant === 'ring_customization'
              ? (tRing('button') || 'Post Your Project')
              : 'Upgrade Now'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-blue-200 dark:border-blue-800 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-500" />
            <CardTitle className="text-lg text-foreground">Premium Membership</CardTitle>
          </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900/20"
                onClick={handleDismiss}
              >
            <X className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
        <CardDescription className="text-muted-foreground">
          Unlock the full potential of Ring Platform with premium features
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-3">
          {benefits.map((benefit, index) => {
            const IconComponent = benefit.icon
            return (
              <div key={index} className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <IconComponent className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm text-foreground">{benefit.text}</span>
              </div>
            )
          })}
        </div>

        <div className="pt-2 border-t border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-semibold text-foreground">Premium Plan</div>
              <div className="text-sm text-muted-foreground">Starting from $29/month</div>
            </div>
            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700">
              Most Popular
            </Badge>
          </div>

          <Button
            className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 dark:from-blue-600 dark:to-purple-600 dark:hover:from-blue-700 dark:hover:to-purple-700 text-white"
            onClick={handleUpgrade}
          >
            <Crown className="w-4 h-4 mr-2" />
            Premium Benefits
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}


