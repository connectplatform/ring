'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Wallet,
  TrendingUp,
  History,
  Settings,
  DollarSign,
  PiggyBank,
  BarChart3,
  Shield,
  CreditCard,
  Coins
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Locale } from '@/i18n-config'

interface WalletNavigationProps {
  locale: Locale
}

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  description: string
}

export default function WalletNavigation({ locale }: WalletNavigationProps) {
  const pathname = usePathname()
  const t = useTranslations('modules.wallet')

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/')
  }

  const navigationItems: NavItem[] = [
    {
      href: `/${locale}/wallet`,
      label: 'Overview',
      icon: <Wallet className="w-4 h-4" />,
      description: 'View balances and quick actions'
    },
    {
      href: `/${locale}/wallet/balances`,
      label: 'Balances',
      icon: <Coins className="w-4 h-4" />,
      description: 'All your token balances'
    },
    {
      href: `/${locale}/wallet/history`,
      label: 'Transaction History',
      icon: <History className="w-4 h-4" />,
      description: 'View all transactions'
    },
    {
      href: `/${locale}/wallet/staking`,
      label: 'Staking',
      icon: <PiggyBank className="w-4 h-4" />,
      description: 'Stake tokens for rewards'
    },
    {
      href: `/${locale}/wallet/analytics`,
      label: 'Analytics',
      icon: <BarChart3 className="w-4 h-4" />,
      description: 'Portfolio analytics and insights'
    },
    {
      href: `/${locale}/wallet/topup`,
      label: 'Top Up',
      icon: <CreditCard className="w-4 h-4" />,
      description: 'Add funds to your wallet'
    },
    {
      href: `/${locale}/wallet/transfer`,
      label: 'Transfer',
      icon: <TrendingUp className="w-4 h-4" />,
      description: 'Send tokens to other addresses'
    },
    {
      href: `/${locale}/wallet/security`,
      label: 'Security',
      icon: <Shield className="w-4 h-4" />,
      description: 'Security settings and 2FA'
    },
    {
      href: `/${locale}/wallet/settings`,
      label: 'Settings',
      icon: <Settings className="w-4 h-4" />,
      description: 'Wallet preferences and configuration'
    }
  ]

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {navigationItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg transition-all duration-200",
              "hover:bg-accent hover:shadow-sm",
              isActive(item.href) && "bg-accent shadow-sm border border-primary/20"
            )}
          >
            <div className={cn(
              "flex-shrink-0 p-1.5 rounded-md",
              isActive(item.href) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className={cn(
                "font-medium text-sm",
                isActive(item.href) && "text-primary"
              )}>
                {item.label}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {item.description}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="pt-4 border-t border-border">
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Quick Stats</h4>
          <div className="grid grid-cols-1 gap-3">
            <div className="bg-muted/30 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-3 h-3 text-green-500" />
                <span className="text-xs font-medium">Portfolio Value</span>
              </div>
              <div className="text-lg font-bold">$2,450.00</div>
              <div className="text-xs text-muted-foreground">+12.5% this month</div>
            </div>

            <div className="bg-muted/30 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-3 h-3 text-blue-500" />
                <span className="text-xs font-medium">Active Stakes</span>
              </div>
              <div className="text-lg font-bold">3</div>
              <div className="text-xs text-muted-foreground">Earning rewards</div>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Tips */}
      <div className="pt-4 border-t border-border">
        <div className="space-y-2">
          <h4 className="font-medium text-sm">💡 Tips</h4>
          <div className="text-xs text-muted-foreground space-y-2">
            <p>• Stake RING tokens to earn passive rewards</p>
            <p>• Enable 2FA for enhanced security</p>
            <p>• Use analytics to track portfolio performance</p>
          </div>
        </div>
      </div>
    </div>
  )
}
