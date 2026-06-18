'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Link, usePathname, toAppHref } from '@/i18n/routing'
import dynamic from 'next/dynamic'
import { useLocale, useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { useSession } from 'next-auth/react'
import {
  BarChart3,
  Bell,
  Briefcase,
  Calculator,
  Coins,
  DollarSign,
  FileText,
  Globe,
  Heart,
  Home,
  Map,
  MessageCircle,
  Moon,
  Package,
  Rocket,
  Settings,
  Share2,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Store,
  Sun,
  User,
  Users,
  Wallet,
  Zap,
} from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ROUTES } from '@/constants/routes'
import { useCreditBalanceContext } from '@/components/providers/credit-balance-provider'
import { useUnreadCount } from '@/hooks/use-unread-count'
import { useOptionalStore } from '@/features/store/context'
import { useLocalStorage } from '@/hooks/use-local-storage'
import {
  localeDisplayLabel,
  localeNativeTitle,
  nextLocaleInRoutingOrder,
  persistRingLocalePreference,
} from '@/lib/locale-pref'
import { useCurrency } from '@/features/store/currency-context'
import { useRouter, replaceLocalePath } from '@/i18n/routing'
import { cn } from '@/lib/utils'
import packageInfo from '@/package.json'
import type { Locale } from '@/i18n/shared'
import { TunnelIndicatorCompact } from './tunnel-indicator'

const AnimatedLogo = dynamic(() => import('@/components/common/widgets/animated-logo'), {
  ssr: false,
})

const ROW = 'flex h-9 min-h-9 max-h-9 items-center'
const BRAND_ROW = 'flex h-16 min-h-16 max-h-16 items-center'
const SECTION_ROW = 'h-5 min-h-5 max-h-5'
const GRID_COLS = 'grid-cols-[64px_minmax(0,1fr)]'
const GUTTER_ICON = 'flex w-5 shrink-0 items-center justify-center'
const FOOTER_H = 'h-10 min-h-10 max-h-10'
const FOOTER_BTN =
  'flex h-8 w-full shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent text-white hover:bg-white/10'
const ASIDE_PAD = 'pl-1 pr-2'
const RAIL_LOGO_SIZE = Math.round(64 * 0.9)

type SyncedRow =
  | { kind: 'pair'; key: string; href?: string; rail: React.ReactNode; aside: React.ReactNode; tall?: boolean }
  | { kind: 'aside-only'; key: string; href: string; icon: React.ReactNode; label: React.ReactNode }
  | { kind: 'section'; key: string; label: string }

function formatBalance(balance: string | null) {
  if (!balance || balance === '0') return '0.00'
  const num = parseFloat(balance)
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`
  return num.toFixed(2)
}

function countSuffix(count: number) {
  if (count <= 0) return null
  return count > 99 ? '99+' : String(count)
}

function AsideLabel({ title, count }: { title: string; count?: number | null }) {
  const suffix = count != null ? countSuffix(count) : null
  return (
    <div className="flex min-w-0 items-center gap-2 text-[13px]">
      <span className="truncate font-medium">{title}</span>
      {suffix && (
        <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
          {suffix}
        </span>
      )}
    </div>
  )
}

/** Flat cells on the continuous rail strip — no per-link rounded boxes */
const railLinkClass =
  'sidebar-rail-link group relative z-[1] flex w-full items-center justify-center text-white hover:bg-white/10 data-current:bg-[#333333] data-current:inset-ring-1 data-current:inset-ring-white/3'

const RING_RAIL_SHADOW =
  'shadow-[0px_259px_103px_rgba(0,0,0,0.03),0px_146px_87px_rgba(0,0,0,0.09),0px_65px_65px_rgba(0,0,0,0.15),0px_16px_36px_rgba(0,0,0,0.17)]'

interface SidebarSyncedLayoutProps {
  asideContentRef?: React.Ref<HTMLDivElement>
  className?: string
  overlayMode?: boolean
  onOpenAside?: () => void
}

export function SidebarSyncedLayout({
  asideContentRef,
  className,
  overlayMode,
  onOpenAside,
}: SidebarSyncedLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const locale = useLocale() as Locale
  const { data: session } = useSession()
  const { setTheme, theme, systemTheme } = useTheme()
  const { currency, toggleCurrency } = useCurrency()
  const nextLocale = nextLocaleInRoutingOrder(locale)
  const [mounted, setMounted] = useState(false)
  const [hasVendorStore, setHasVendorStore] = useState(false)

  const tNav = useTranslations('navigation')
  const tEntities = useTranslations('modules.entities')
  const tOpp = useTranslations('modules.opportunities')
  const tStore = useTranslations('modules.store')
  const tFav = useTranslations('modules.store.favorites')

  const { balance: tokenBalance, isLoading: balanceLoading } = useCreditBalanceContext()
  const { unreadCount: notificationCount } = useUnreadCount()
  const store = useOptionalStore()
  const [favorites] = useLocalStorage<string[]>('ring_favorites', [])
  const [messagesCount] = useState(0)

  const currentTheme = theme === 'system' ? systemTheme : theme
  const cartCount = store?.totalItems || 0
  const displayBalance = formatBalance(tokenBalance?.amount)

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

  const isActive = (href: string) => {
    if (href === ROUTES.HOME(locale)) return pathname === ROUTES.HOME(locale)
    return pathname.startsWith(href)
  }

  const switchLocale = () => {
    persistRingLocalePreference(nextLocale)
    replaceLocalePath(router, pathname, nextLocale)
  }

  const rows = useMemo((): SyncedRow[] => {
    const list: SyncedRow[] = [
      {
        kind: 'pair',
        key: 'brand',
        href: ROUTES.HOME(locale),
        tall: true,
        rail: (
          <div className="flex w-[90%] max-h-[90%] items-center justify-center overflow-hidden aspect-square">
            <AnimatedLogo size={RAIL_LOGO_SIZE} />
          </div>
        ),
        aside: (
          <div className="min-w-0 leading-tight">
            <span className="block truncate text-lg font-bold text-primary">Ring Platform</span>
            <p className="truncate text-[11px] text-muted-foreground">{tNav('sidebar.brandTagline')}</p>
          </div>
        ),
      },
    ]

    if (!session?.user) {
      list.push({
        kind: 'pair',
        key: 'sign-in',
        href: ROUTES.LOGIN(locale),
        rail: <User className="size-[18px]" strokeWidth={1.5} />,
        aside: <AsideLabel title={tNav('sidebar.signIn')} />,
      })
    } else {
      list.push(
        {
          kind: 'pair',
          key: 'profile',
          href: ROUTES.PROFILE(locale),
          rail: (
            <Avatar
              src={session.user.image || session.user.photoURL}
              alt={session.user.name || 'User'}
              size="sm"
              fallback={session.user.name?.charAt(0) || 'U'}
              className="size-8"
            />
          ),
          aside: <AsideLabel title={session.user.name || 'Anonymous'} />,
        },
        {
          kind: 'pair',
          key: 'wallet',
          href: ROUTES.WALLET(locale),
          rail: <Wallet className="size-[18px]" strokeWidth={1.5} />,
          aside: (
            <div className="flex min-w-0 items-baseline gap-2 text-[13px]">
              <span className="truncate font-semibold tabular-nums">
                {balanceLoading ? '···' : displayBalance}
              </span>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                RING
              </span>
            </div>
          ),
        },
        {
          kind: 'pair',
          key: 'notifications',
          href: ROUTES.NOTIFICATIONS(locale),
          rail: <Bell className="size-[18px]" strokeWidth={1.5} />,
          aside: <AsideLabel title={tNav('notifications')} count={notificationCount} />,
        },
        {
          kind: 'pair',
          key: 'messages',
          href: ROUTES.MESSAGES(locale),
          rail: <MessageCircle className="size-[18px]" strokeWidth={1.5} />,
          aside: <AsideLabel title={tNav('messages')} count={messagesCount} />,
        },
        {
          kind: 'pair',
          key: 'cart',
          href: ROUTES.CART(locale),
          rail: <ShoppingCart className="size-[18px]" strokeWidth={1.5} />,
          aside: <AsideLabel title={tStore('cart.title')} count={cartCount} />,
        },
        {
          kind: 'pair',
          key: 'favorites',
          href: ROUTES.STORE(locale),
          rail: <Heart className="size-[18px]" strokeWidth={1.5} />,
          aside: <AsideLabel title={tFav('button')} count={favorites.length} />,
        },
      )
    }

    const primaryNav: Array<{
      key: string
      href: string
      label: string
      icon: React.ReactNode
      badge?: string
    }> = [
      { key: 'home', href: ROUTES.HOME(locale), label: tNav('mainNav.home'), icon: <Home className="size-[18px]" strokeWidth={1.5} /> },
      { key: 'entities', href: ROUTES.ENTITIES(locale), label: tEntities('title'), icon: <Users className="size-[18px]" strokeWidth={1.5} />, badge: 'Hot' },
      { key: 'opportunities', href: ROUTES.OPPORTUNITIES(locale), label: tOpp('opportunities'), icon: <Briefcase className="size-[18px]" strokeWidth={1.5} />, badge: 'New' },
      { key: 'store-nav', href: ROUTES.STORE(locale), label: tStore('title'), icon: <Store className="size-[18px]" strokeWidth={1.5} /> },
      { key: 'docs-nav', href: ROUTES.DOCS(locale), label: tNav('sidebar.documentation'), icon: <FileText className="size-[18px]" strokeWidth={1.5} /> },
    ]

    for (const item of primaryNav) {
      list.push({
        kind: 'pair',
        key: item.key,
        href: item.href,
        rail: item.icon,
        aside: (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate">{item.label}</span>
            {item.badge && (
              <Badge variant="secondary" className="ml-auto h-5 shrink-0 px-1.5 py-0 text-[10px]">
                {item.badge}
              </Badge>
            )}
          </div>
        ),
      })
    }

    if (session?.user && (session.user.role === 'admin' || session.user.role === 'superadmin')) {
      list.push({
        kind: 'pair',
        key: 'admin-entry',
        href: ROUTES.ADMIN(locale),
        rail: <Shield className="size-[18px]" strokeWidth={1.5} />,
        aside: <span className="truncate">{tNav('sidebar.adminDashboard')}</span>,
      })
      for (const item of [
        { href: ROUTES.ADMIN_USERS(locale), label: tNav('sidebar.userManagement'), icon: Users },
        { href: ROUTES.ADMIN_ANALYTICS(locale), label: tNav('sidebar.analytics'), icon: BarChart3 },
        { href: ROUTES.ADMIN_SECURITY(locale), label: tNav('sidebar.security'), icon: Shield },
        { href: ROUTES.ADMIN_REFCODES(locale), label: tNav('sidebar.referralRewards'), icon: Share2 },
        { href: ROUTES.ADMIN_STORE(locale), label: tNav('sidebar.storeManagement'), icon: ShoppingBag },
      ]) {
        list.push({
          kind: 'aside-only',
          key: item.href,
          href: item.href,
          icon: <item.icon className="size-3.5 shrink-0 text-[var(--color-contrast-medium)]" strokeWidth={1.5} />,
          label: <span className="truncate">{item.label}</span>,
        })
      }
    }

    if (session?.user && hasVendorStore) {
      list.push({ kind: 'section', key: 'vendor-h', label: tNav('sidebar.vendor') })
      for (const item of [
        { href: ROUTES.VENDOR_DASHBOARD(locale), label: tNav('sidebar.vendorDashboard'), icon: BarChart3 },
        { href: ROUTES.VENDOR_PRODUCTS(locale), label: tNav('sidebar.vendorProducts'), icon: Package },
        { href: ROUTES.VENDOR_ORDERS(locale), label: tNav('sidebar.vendorOrders'), icon: ShoppingBag },
        { href: ROUTES.VENDOR_STOCK(locale), label: tNav('sidebar.vendorStock'), icon: Package },
        { href: ROUTES.VENDOR_EARNINGS(locale), label: tNav('sidebar.vendorEarnings'), icon: DollarSign },
        { href: ROUTES.VENDOR_SETTINGS(locale), label: tNav('sidebar.vendorSettings'), icon: Settings },
      ]) {
        list.push({
          kind: 'aside-only',
          key: item.href,
          href: item.href,
          icon: <item.icon className="size-3.5 shrink-0 text-[var(--color-contrast-medium)]" strokeWidth={1.5} />,
          label: <span className="truncate">{item.label}</span>,
        })
      }
    }

    if (session?.user) {
      list.push({
        kind: 'aside-only',
        key: 'refcodes',
        href: ROUTES.REFCODES(locale),
        icon: <Share2 className="size-3.5 shrink-0 text-[var(--color-contrast-medium)]" strokeWidth={1.5} />,
        label: <span className="truncate">{tNav('refcodes')}</span>,
      })
    }

    list.push({ kind: 'section', key: 'concepts-h', label: 'Platform Concepts' })
    for (const item of [
      { href: `/${locale}/docs/customization/token-economics`, label: tNav('sidebar.ringEconomy'), icon: Coins },
      { href: `/${locale}/about-publisher`, label: tNav('sidebar.appPublisher'), icon: Heart },
      { href: `/${locale}/global-impact`, label: tNav('sidebar.globalImpact'), icon: Globe },
      { href: `/${locale}/ai-web3`, label: tNav('sidebar.aiMeetsWeb3'), icon: Zap },
    ]) {
      list.push({
        kind: 'aside-only',
        key: item.href,
        href: item.href,
        icon: <item.icon className="size-3.5 shrink-0 text-[var(--color-contrast-medium)]" strokeWidth={1.5} />,
        label: <span className="truncate">{item.label}</span>,
      })
    }

    list.push({ kind: 'section', key: 'started-h', label: tNav('sidebar.getStarted') })
    for (const item of [
      { href: ROUTES.DOCS(locale), label: tNav('sidebar.documentation'), icon: FileText },
      { href: `/${locale}/docs/getting-started`, label: tNav('sidebar.quickStart'), icon: Rocket },
      { href: `/${locale}/calculator`, label: tNav('sidebar.deploymentCalculator'), icon: Calculator },
      { href: `/${locale}/roadmap`, label: tNav('sidebar.roadmap'), icon: Map },
    ]) {
      list.push({
        kind: 'aside-only',
        key: `started-${item.href}`,
        href: item.href,
        icon: <item.icon className="size-3.5 shrink-0 text-[var(--color-contrast-medium)]" strokeWidth={1.5} />,
        label: <span className="truncate">{item.label}</span>,
      })
    }

    return list
  }, [
    balanceLoading,
    cartCount,
    displayBalance,
    favorites.length,
    hasVendorStore,
    locale,
    messagesCount,
    notificationCount,
    session?.user,
    tEntities,
    tFav,
    tNav,
    tOpp,
    tStore,
  ])

  const gridCells: React.ReactNode[] = []

  for (const row of rows) {
    if (row.kind === 'section') {
      gridCells.push(
        <div key={`${row.key}-rail`} className={SECTION_ROW} aria-hidden />,
        <div
          key={`${row.key}-aside`}
          className={cn(
            SECTION_ROW,
            'flex items-end pb-px pl-1 text-[10px] uppercase tracking-wide text-[var(--color-contrast-low)]',
          )}
        >
          {row.label}
        </div>,
      )
      continue
    }

    if (row.kind === 'aside-only') {
      gridCells.push(
        <div key={`${row.key}-rail`} className={ROW} aria-hidden />,
        <Link
          key={`${row.key}-aside`}
          href={toAppHref(row.href)}
          data-current={isActive(row.href) ? '' : undefined}
          className={cn(
            'sidebar-nav-item sidebar-aside-col flex min-w-0 items-center gap-1 rounded-lg text-[13px] transition-colors hover:bg-foreground/5 data-current:bg-foreground/8',
            ROW,
            ASIDE_PAD,
          )}
        >
          <span className={cn(GUTTER_ICON, 'text-[var(--color-contrast-medium)]')}>{row.icon}</span>
          {row.label}
        </Link>,
      )
      continue
    }

    const rowClass = row.tall ? BRAND_ROW : ROW
    gridCells.push(
      row.href ? (
        <Link
          key={`${row.key}-rail`}
          href={toAppHref(row.href)}
          data-current={isActive(row.href) ? '' : undefined}
          className={cn(railLinkClass, rowClass)}
        >
          {row.rail}
        </Link>
      ) : (
        <div key={`${row.key}-rail`} className={cn('z-[1]', rowClass, 'justify-center px-1 text-white')}>
          {row.rail}
        </div>
      ),
      row.href ? (
        <Link
          key={`${row.key}-aside`}
          href={toAppHref(row.href)}
          data-current={isActive(row.href) ? '' : undefined}
          className={cn(
            'sidebar-nav-item sidebar-aside-col min-w-0 rounded-lg transition-colors hover:bg-foreground/5 data-current:bg-foreground/8',
            ASIDE_PAD,
            rowClass,
          )}
        >
          {row.aside}
        </Link>
      ) : (
        <div key={`${row.key}-aside`} className={cn(rowClass, 'min-w-0', ASIDE_PAD)}>
          {row.aside}
        </div>
      ),
    )
  }

  return (
    <div className={cn('relative flex h-full min-h-0 flex-col text-[13px] font-medium', className)}>
      {/* Single continuous rail chrome — rounded top/bottom on the right edge only */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 z-0 w-16 rounded-r-[12px] bg-[#090909]',
          RING_RAIL_SHADOW,
        )}
      />

      <div
        ref={asideContentRef}
        data-aside-content
        className="relative z-[1] min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-24 transition-[filter,opacity] duration-500 ease-out data-too-small:[&_.sidebar-aside-col]:opacity-30 data-too-small:[&_.sidebar-aside-col]:pointer-events-none data-collapsing:blur-[5px]"
      >
        <div className={cn('grid', GRID_COLS)}>{gridCells}</div>
      </div>

      {/* Rail utilities — vertical stack on black strip, bottom-anchored */}
      <div className="pointer-events-none absolute bottom-0 left-0 z-[2] w-16">
        <div className="pointer-events-auto flex w-16 flex-col items-stretch border-t border-white/10 bg-[#090909]">
          {overlayMode && onOpenAside && (
            <button
              type="button"
              onClick={onOpenAside}
              className={FOOTER_BTN}
              title="Open navigation panel"
              aria-label="Open navigation panel"
            >
              <FileText className="size-4" strokeWidth={1.5} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setTheme(currentTheme === 'dark' ? 'light' : 'dark')}
            className={FOOTER_BTN}
            aria-label="Toggle theme"
          >
            {!mounted ? (
              <Sun className="size-4" strokeWidth={1.5} />
            ) : currentTheme === 'dark' ? (
              <Moon className="size-4" strokeWidth={1.5} />
            ) : (
              <Sun className="size-4" strokeWidth={1.5} />
            )}
          </button>
          {toggleCurrency && (
            <button
              type="button"
              onClick={toggleCurrency}
              className={cn(FOOTER_BTN, 'text-[10px] font-semibold')}
            >
              {currency === 'UAH' ? '₴' : 'Ⓡ'}
            </button>
          )}
          <button
            type="button"
            onClick={switchLocale}
            className={cn(FOOTER_BTN, 'text-[10px] font-semibold uppercase')}
            title={`Switch to ${localeNativeTitle(nextLocale)}`}
          >
            {localeDisplayLabel(locale)}
          </button>
        </div>
      </div>

      <div
        className={cn(
          'relative z-[1] mt-auto grid shrink-0 grid-cols-[64px_minmax(0,1fr)] border-t border-border/50',
          FOOTER_H,
        )}
      >
        <div className={FOOTER_H} aria-hidden />
        <div
          className={cn(
            FOOTER_H,
            'flex items-center justify-between px-2 text-[10px] leading-none text-muted-foreground',
          )}
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <TunnelIndicatorCompact />
            <Link href="/about-publisher" className="truncate hover:underline">
              v{packageInfo.version}
            </Link>
          </div>
          <div className="flex shrink-0 gap-1">
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
  )
}
