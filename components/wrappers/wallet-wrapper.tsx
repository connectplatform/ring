'use client'

/**
 * WALLET PAGE WRAPPER - Ring Platform v2.0
 * ========================================
 * Standardized 3-column responsive layout for wallet pages
 *
 * Layout Structure:
 * - Desktop: DesktopSidebar (280px) + Center Content + Right Sidebar (320px)
 * - iPad: DesktopSidebar (280px) + Center Content + Floating Toggle for Right Sidebar
 * - Mobile: Center Content + Bottom Navigation + Floating Toggle for Right Sidebar
 *
 * Right Sidebar Content:
 * - Quick Actions (Send/Receive)
 * - Transaction History
 * - Top-up CTA
 * - Security Tips
 * - Wallet Guide
 *
 * Strike Team:
 * - Ring Components Specialist (layout pattern)
 * - React 19 Specialist (modern patterns)
 * - Wallet Domain Expert (functionality)
 * - UI/UX Optimization Agent (mobile excellence)
 */

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import type { Locale } from '@/i18n-config'
import { useSession } from 'next-auth/react'
import DesktopSidebar from '@/components/navigation/desktop-sidebar'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Shield,
  BookOpen,
  History,
  Zap,
  CreditCard,
  Lock,
  AlertTriangle,
  CheckCircle,
  ExternalLink
} from 'lucide-react'
import { ROUTES } from '@/constants/routes'

interface WalletWrapperProps {
  children: React.ReactNode
  locale: string
}

export default function WalletWrapper({
  children,
  locale
}: WalletWrapperProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const t = useTranslations('modules.wallet')
  const tCommon = useTranslations('common')
  const [mounted, setMounted] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Mock recent transactions (will be dynamic later)
  const recentTransactions = [
    { id: '1', type: 'received', amount: 50, from: 'Store Purchase', date: '2h ago' },
    { id: '2', type: 'sent', amount: 25, to: 'Product Vendor', date: '1d ago' },
    { id: '3', type: 'received', amount: 100, from: 'Opportunity Reward', date: '3d ago' },
  ]

  // Security tips
  const securityTips = [
    { id: 'backup', title: t('backupPhrase', { defaultValue: 'Backup Recovery Phrase' }), icon: Shield, urgent: true },
    { id: '2fa', title: t('enable2FA', { defaultValue: 'Enable 2FA' }), icon: Lock, urgent: false },
    { id: 'phishing', title: t('avoidPhishing', { defaultValue: 'Avoid Phishing' }), icon: AlertTriangle, urgent: false },
  ]

  const quickActions = [
    {
      id: 'send',
      label: t('sendTokens', { defaultValue: 'Send RING' }),
      icon: ArrowUpRight,
      href: `/${locale}/wallet/send`,
      variant: 'default' as const
    },
    {
      id: 'receive',
      label: t('receiveTokens', { defaultValue: 'Receive RING' }),
      icon: ArrowDownLeft,
      href: `/${locale}/wallet/receive`,
      variant: 'outline' as const
    },
    {
      id: 'topup',
      label: t('topUpBalance', { defaultValue: 'Top Up Balance' }),
      icon: Plus,
      href: `/${locale}/wallet/topup`,
      variant: 'secondary' as const
    },
  ]

  const RightSidebarContent = () => (
    <div className="space-y-6">
      {/* Quick Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            {t('quickActions', { defaultValue: 'Quick Actions' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {quickActions.map((action) => (
            <Button
              key={action.id}
              variant={action.variant}
              className="w-full justify-start"
              onClick={() => {
                router.push(action.href)
                setRightSidebarOpen(false)
              }}
            >
              <action.icon className="h-4 w-4 mr-2" />
              {action.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            {t('recentTransactions', { defaultValue: 'Recent Transactions' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentTransactions.length > 0 ? (
            recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {tx.type === 'received' ? (
                    <ArrowDownLeft className="h-4 w-4 text-green-500" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-red-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {tx.type === 'received' ? tx.from : `To ${tx.to}`}
                    </p>
                    <p className="text-xs text-muted-foreground">{tx.date}</p>
                  </div>
                </div>
                <span className={`text-sm font-medium ${
                  tx.type === 'received' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {tx.type === 'received' ? '+' : '-'}{tx.amount} RING
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t('noTransactions', { defaultValue: 'No recent transactions' })}
            </p>
          )}
          <Button
            variant="link"
            className="w-full p-0 h-auto"
            onClick={() => router.push(`/${locale}/wallet/transactions`)}
          >
            {t('viewAllTransactions', { defaultValue: 'View All Transactions' })} →
          </Button>
        </CardContent>
      </Card>

      {/* Top-up CTA Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            {t('boostYourWallet', { defaultValue: 'Boost Your Wallet' })}
          </CardTitle>
          <CardDescription>
            {t('topUpDescription', { defaultValue: 'Add RING tokens to unlock premium features and opportunities.' })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            onClick={() => router.push(`/${locale}/wallet/topup`)}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('topUpNow', { defaultValue: 'Top Up Now' })}
          </Button>
        </CardContent>
      </Card>

      {/* Security Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {t('securityTips', { defaultValue: 'Security Tips' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {securityTips.map((tip) => (
            <div key={tip.id} className="flex items-start gap-3">
              <div className={`p-1 rounded-full ${
                tip.urgent ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
              }`}>
                <tip.icon className="h-3 w-3" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{tip.title}</p>
                {tip.urgent && (
                  <Badge variant="destructive" className="text-xs mt-1">
                    {t('urgent', { defaultValue: 'Urgent' })}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Wallet Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {t('walletGuide', { defaultValue: 'Wallet Guide' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{t('guideDescription', { defaultValue: 'Learn how to manage your RING tokens safely and effectively.' })}</p>
          <div className="space-y-2">
            <Button
              variant="link"
              className="p-0 h-auto text-sm"
              onClick={() => router.push(`/${locale}/docs/wallet/getting-started`)}
            >
              {t('gettingStarted', { defaultValue: 'Getting Started' })} →
            </Button>
            <Button
              variant="link"
              className="p-0 h-auto text-sm"
              onClick={() => router.push(`/${locale}/docs/wallet/security`)}
            >
              {t('securityGuide', { defaultValue: 'Security Guide' })} →
            </Button>
            <Button
              variant="link"
              className="p-0 h-auto text-sm"
              onClick={() => router.push(`/${locale}/docs/wallet/faq`)}
            >
              {t('faq', { defaultValue: 'FAQ' })} →
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
        <div className="flex-1 py-8 px-4 md:px-0 md:pr-6 lg:pb-8 pb-24">
          {children}
        </div>

        {/* Right Sidebar - Wallet Actions & Info (Desktop only, 1024px+) */}
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
