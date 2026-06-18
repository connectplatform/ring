'use client'

import React, { useState, useEffect, useCallback, forwardRef } from 'react'
import { Link, usePathname, toAppHref } from '@/i18n/routing'
import { useLocale, useTranslations } from 'next-intl'
import {
  Users,
  Briefcase,
  Store,
  Wallet,
  FileText,
  Heart,
  Copy,
  Check,
  Coins,
  Globe,
  Zap,
  Rocket,
  Calculator,
  BarChart3,
  Shield,
  Share2,
  Map,
  Package,
  DollarSign,
  ShoppingBag,
  Settings,
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/constants/routes'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import packageInfo from '@/package.json'
import { toast } from '@/hooks/use-toast'
import type { Locale } from '@/i18n/shared'
import { SidebarIdentityPanel } from './sidebar-identity-panel'
import { TunnelIndicatorCompact } from './tunnel-indicator'

interface NavigationItem {
  href: string
  label: string
  icon?: React.ReactNode
  badge?: string | number
  requiresAuth?: boolean
  divider?: string
  /** Mirrored in sidebar rail — aside shows label only (no duplicate icon). */
  railMirrored?: boolean
}

interface SidebarAsideProps {
  className?: string
  overlayMode?: boolean
  /** iPad overlay: render identity text rows at top of aside panel */
  showIdentityAside?: boolean
}

export const SidebarAside = forwardRef<HTMLDivElement, SidebarAsideProps>(
  function SidebarAside({ className, overlayMode, showIdentityAside }, ref) {
    const pathname = usePathname()
    const locale = useLocale() as Locale
    const { data: session } = useSession()
    const tEntities = useTranslations('modules.entities')
    const tOpp = useTranslations('modules.opportunities')
    const tStore = useTranslations('modules.store')
    const tNav = useTranslations('navigation')
    const [mounted, setMounted] = useState(false)
    const [copied, setCopied] = useState(false)
    const [hasVendorStore, setHasVendorStore] = useState(false)
    useEffect(() => {
      setMounted(true)
    }, [])

    useEffect(() => {
      if (!session?.user?.id) {
        setHasVendorStore(false)
        return
      }
      fetch('/api/vendor/status')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => setHasVendorStore(Boolean(data?.hasVendor)))
        .catch(() => setHasVendorStore(false))
    }, [session?.user?.id])

    const handleCopyAddress = useCallback(async () => {
      const address = session?.user?.wallets?.[0]?.address
      if (!address) return
      try {
        await navigator.clipboard.writeText(address)
        setCopied(true)
        toast({ title: 'Address copied', description: 'Wallet address copied to clipboard' })
        setTimeout(() => setCopied(false), 2000)
      } catch {
        toast({ title: 'Copy failed', description: 'Failed to copy address', variant: 'destructive' })
      }
    }, [session?.user?.wallets])

    const formatAddress = (address: string) =>
      address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''

    const navigationItems: NavigationItem[] = [
      {
        href: ROUTES.HOME(locale),
        label: tNav('mainNav.home'),
        railMirrored: true,
      },
      {
        href: ROUTES.ENTITIES(locale),
        label: tEntities('title'),
        badge: 'Hot',
        railMirrored: true,
      },
      {
        href: ROUTES.OPPORTUNITIES(locale),
        label: tOpp('opportunities'),
        badge: 'New',
        railMirrored: true,
      },
      {
        href: ROUTES.STORE(locale),
        label: tStore('title'),
        railMirrored: true,
      },
      {
        href: ROUTES.DOCS(locale),
        label: tNav('sidebar.documentation'),
        railMirrored: true,
      },
      {
        href: ROUTES.REFCODES(locale),
        label: tNav('refcodes'),
        requiresAuth: true,
        icon: <Share2 className="size-4.5 shrink-0 text-[var(--color-contrast-medium)]" strokeWidth={1.5} />,
      },
      { divider: 'divider-concepts', href: '#', label: '', icon: null },
      {
        href: `/${locale}/docs/customization/token-economics`,
        label: tNav('sidebar.ringEconomy'),
        icon: <Coins className="size-4.5 shrink-0 text-[var(--color-contrast-medium)]" strokeWidth={1.5} />,
      },
      {
        href: `/${locale}/about-publisher`,
        label: tNav('sidebar.appPublisher'),
        icon: <Heart className="size-4.5 shrink-0 text-[var(--color-contrast-medium)]" strokeWidth={1.5} />,
      },
      {
        href: `/${locale}/global-impact`,
        label: tNav('sidebar.globalImpact'),
        icon: <Globe className="size-4.5 shrink-0 text-[var(--color-contrast-medium)]" strokeWidth={1.5} />,
      },
      {
        href: `/${locale}/ai-web3`,
        label: tNav('sidebar.aiMeetsWeb3'),
        icon: <Zap className="size-4.5 shrink-0 text-[var(--color-contrast-medium)]" strokeWidth={1.5} />,
      },
      { divider: 'divider-docs', href: '#', label: '', icon: null },
      {
        href: `/${locale}/docs/getting-started`,
        label: tNav('sidebar.quickStart'),
        icon: <Rocket className="size-4.5 shrink-0 text-[var(--color-contrast-medium)]" strokeWidth={1.5} />,
      },
      {
        href: `/${locale}/calculator`,
        label: tNav('sidebar.deploymentCalculator'),
        icon: <Calculator className="size-4.5 shrink-0 text-[var(--color-contrast-medium)]" strokeWidth={1.5} />,
      },
      {
        href: `/${locale}/roadmap`,
        label: tNav('sidebar.roadmap'),
        icon: <Map className="size-4.5 shrink-0 text-[var(--color-contrast-medium)]" strokeWidth={1.5} />,
      },
    ]

    const isActive = (href: string) => {
      if (href === ROUTES.HOME(locale)) return pathname === ROUTES.HOME(locale)
      return pathname.startsWith(href)
    }

    const dividerLabels: Record<string, string> = {
      'divider-concepts': 'Platform Concepts',
      'divider-docs': tNav('sidebar.getStarted'),
    }

    const walletAddress = session?.user?.wallets?.[0]?.address

    return (
      <aside
        className={cn(
          'relative z-1 h-full shrink-0 overflow-hidden isolate text-[13px] font-medium',
          overlayMode && 'shadow-xl',
          className,
        )}
      >
        <div
          ref={ref}
          data-aside-content
          className="flex h-full min-h-0 w-full min-w-[200px] flex-col overflow-y-auto px-2 pt-1 transition-[filter,opacity] duration-500 ease-out data-too-small:opacity-30 data-too-small:pointer-events-none data-collapsing:blur-[5px]"
        >
          {showIdentityAside && <SidebarIdentityPanel variant="aside" className="mb-2" />}

          <nav className="flex-1 space-y-0 px-0">
            {session?.user &&
              mounted &&
              (session.user.role === 'admin' || session.user.role === 'superadmin') && (
                <div className="mb-3 px-2">
                  <p className="text-[11px] text-[var(--color-contrast-low)] mb-1.5 pl-2 uppercase tracking-wide">
                    {tNav('sidebar.admin')}
                  </p>
                  <div className="space-y-0.5">
                    {[
                      { href: ROUTES.ADMIN(locale), label: tNav('sidebar.adminDashboard'), icon: BarChart3 },
                      { href: ROUTES.ADMIN_USERS(locale), label: tNav('sidebar.userManagement'), icon: Users },
                      { href: ROUTES.ADMIN_ANALYTICS(locale), label: tNav('sidebar.analytics'), icon: BarChart3 },
                      { href: ROUTES.ADMIN_SECURITY(locale), label: tNav('sidebar.security'), icon: Shield },
                      { href: ROUTES.ADMIN_REFCODES(locale), label: tNav('sidebar.referralRewards'), icon: Share2 },
                      { href: ROUTES.ADMIN_STORE(locale), label: tNav('sidebar.storeManagement'), icon: ShoppingBag },
                    ].map(({ href, label, icon: Icon }) => (
                      <Link
                        key={href}
                        href={toAppHref(href)}
                        data-current={isActive(href) ? '' : undefined}
                        className="sidebar-nav-item flex items-center gap-2 h-8 data-current:bg-foreground/8 hover:bg-foreground/5 rounded-lg px-4 text-xs"
                      >
                        <Icon className="size-3.5 shrink-0" strokeWidth={1.5} />
                        <span>{label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

            {session?.user && mounted && hasVendorStore && (
              <div className="mb-3 px-2">
                <p className="text-[11px] text-[var(--color-contrast-low)] mb-1.5 pl-2 uppercase tracking-wide">
                  {tNav('sidebar.vendor')}
                </p>
                <div className="space-y-0.5">
                  {[
                    { href: ROUTES.VENDOR_DASHBOARD(locale), label: tNav('sidebar.vendorDashboard'), icon: BarChart3 },
                    { href: ROUTES.VENDOR_PRODUCTS(locale), label: tNav('sidebar.vendorProducts'), icon: Package },
                    { href: ROUTES.VENDOR_ORDERS(locale), label: tNav('sidebar.vendorOrders'), icon: ShoppingBag },
                    { href: ROUTES.VENDOR_STOCK(locale), label: tNav('sidebar.vendorStock'), icon: Package },
                    { href: ROUTES.VENDOR_EARNINGS(locale), label: tNav('sidebar.vendorEarnings'), icon: DollarSign },
                    { href: ROUTES.VENDOR_SETTINGS(locale), label: tNav('sidebar.vendorSettings'), icon: Settings },
                  ].map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={toAppHref(href)}
                      data-current={isActive(href) ? '' : undefined}
                      className="flex items-center gap-2 h-8 data-current:bg-foreground/8 hover:bg-foreground/5 rounded-lg px-4 text-xs"
                    >
                      <Icon className="size-3.5 shrink-0" strokeWidth={1.5} />
                      <span>{label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {navigationItems
              .filter((item) => !item.requiresAuth || session?.user)
              .map((item, index) => {
                if (item.divider) {
                  return (
                    <div key={index} className="my-3">
                      <div
                        data-divider
                        className="h-px w-[calc(100%-32px)] mx-4 bg-border shadow-2xs shadow-white/80"
                      />
                      <h2 className="text-[var(--color-contrast-low)] text-[11px] mb-1.5 mt-2 pl-4">
                        {dividerLabels[item.divider] ?? ''}
                      </h2>
                    </div>
                  )
                }
                const active = isActive(item.href)
                const mirrored = Boolean(item.railMirrored)
                return (
                  <Link
                    key={item.href}
                    href={toAppHref(item.href)}
                    data-current={active ? '' : undefined}
                    className={cn(
                      'sidebar-nav-item flex items-center gap-2 rounded-lg transition-colors hover:bg-foreground/5 data-current:bg-foreground/8',
                      mirrored ? 'h-10 min-h-10 px-2' : 'h-8 px-4',
                    )}
                  >
                    {!mirrored && item.icon}
                    <span className={cn('flex-1 truncate', mirrored && 'pl-0.5')}>{item.label}</span>
                    {item.badge && (
                      <Badge variant="secondary" className="ml-auto h-5 px-1.5 py-0 text-[10px]">
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                )
              })}
          </nav>

          {session?.user && mounted && walletAddress && (
            <div className="px-2 py-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyAddress}
                className="w-full flex items-center gap-2 px-3 py-2 h-auto bg-muted/30 hover:bg-muted/50 rounded-lg font-mono text-xs"
              >
                <Wallet className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span className="flex-1 text-left">{formatAddress(walletAddress)}</span>
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5 opacity-60" />
                )}
              </Button>
            </div>
          )}

          <div className="mt-auto px-2 pb-4">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <div className="flex items-center gap-2">
                <TunnelIndicatorCompact />
                <Link href="/about-publisher" className="hover:underline">
                  v{packageInfo.version}
                </Link>
              </div>
              <div className="flex gap-1">
                <Link href="/privacy" className="hover:underline">
                  Privacy
                </Link>
                <span>|</span>
                <Link href="/contact" className="hover:underline">
                  Contact
                </Link>
              </div>
            </div>
          </div>
        </div>
      </aside>
    )
  },
)
