'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Link, usePathname, toAppHref } from '@/i18n/routing'
import dynamic from 'next/dynamic'
import { useLocale, useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { toggleThemeWithTransition } from '@/lib/theme/ring-theme-transition'
import { useSession } from 'next-auth/react'
import {
  hasConfidentialAccess,
  hasMemberPrivileges,
  resolveSessionUserRole,
} from '@/features/auth/user-role'
import {
  Bell,
  Briefcase,
  Calculator,
  Coins,
  Crown,
  FileText,
  Globe,
  Heart,
  ListTodo,
  Map,
  MessageCircle,
  Gamepad2,
  Moon,
  Rocket,
  ShoppingBag,
  ShoppingCart,
  Store,
  Sun,
  User,
  UserRound,
  Users,
  Wallet,
  Zap,
} from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ROUTES } from '@/constants/routes'
import { useNotificationContext } from '@/features/notifications/components/notification-provider'
import { useOptionalStore } from '@/features/store/context'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { getClientNativeTokenSymbol, getClientSiteName } from '@/lib/ring-config-client'
import { getHomePreset } from '@/lib/ring-config-core'
import {
  getMvmPrimaryNavSpecs,
  resolveNavLabel,
} from '@/lib/navigation/mvm-primary-nav'
import { LocaleCodeMenu } from '@/components/common/locale-code-menu'
import { useStorePaymentMethods } from '@/features/store/currency-context'
import { cn } from '@/lib/utils'
import type { Locale } from '@/i18n/shared'
import { AdminSupermenuToggle } from './admin-supermenu'
import { NavCreditTrailing } from './nav-credit-trailing'
import { NavLegalFooter } from './nav-legal-footer'

const AnimatedLogo = dynamic(() => import('@/components/common/widgets/animated-logo'), {
  ssr: false,
})

const ROW = 'flex h-11 min-h-11 max-h-11 items-center'
const BRAND_ROW = 'flex h-16 min-h-16 max-h-16 items-center'
const SECTION_ROW = 'h-5 min-h-5 max-h-5'
const GRID_COLS = 'grid-cols-[64px_minmax(0,1fr)]'
const GUTTER_ICON = 'flex w-6 shrink-0 items-center justify-center'
const FOOTER_H = 'min-h-[4.5rem] h-auto py-2'
const FOOTER_BTN =
  'flex h-8 w-full shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent text-white hover:bg-white/10'
const ASIDE_PAD = 'pl-1 pr-2'
const RAIL_LOGO_SIZE = Math.round(64 * 0.9)
const ICON = 'size-[22px]'

type SyncedRow =
  | { kind: 'pair'; key: string; href?: string; rail: React.ReactNode; aside: React.ReactNode; tall?: boolean; markActive?: boolean }
  | { kind: 'aside-only'; key: string; href: string; icon: React.ReactNode; label: React.ReactNode }
  | { kind: 'section'; key: string; label: string }
  | { kind: 'admin-toggle'; key: string }

function countSuffix(count: number) {
  if (count <= 0) return null
  return count > 99 ? '99+' : String(count)
}

function AsideLabel({ title, count }: { title: string; count?: number | null }) {
  const suffix = count != null ? countSuffix(count) : null
  return (
    <div className="flex min-w-0 items-center gap-2 text-[16px]">
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
  /** Desktop aside fully collapsed (width 0) — hide privacy/contact legal footer */
  collapsed?: boolean
}

export function SidebarSyncedLayout({
  asideContentRef,
  className,
  overlayMode,
  onOpenAside,
  collapsed = false,
}: SidebarSyncedLayoutProps) {
  const pathname = usePathname()
  const locale = useLocale() as Locale
  const { data: session } = useSession()
  const { setTheme, theme, resolvedTheme } = useTheme()
  const { currency, toggleCurrency, nativeTokenCurrency, mainCurrency } = useStorePaymentMethods()
  const [mounted, setMounted] = useState(false)
  const nativeSymbol = getClientNativeTokenSymbol()
  const siteName = getClientSiteName()
  const isMvmNav = getHomePreset() === 'mvm-landing'

  const tNav = useTranslations('navigation')
  const tEntities = useTranslations('modules.entities')
  const tOpp = useTranslations('modules.opportunities')
  const tStore = useTranslations('modules.store')
  const tFav = useTranslations('modules.store.favorites')

  const { unreadCount: notificationCount } = useNotificationContext()
  const store = useOptionalStore()
  const [favorites] = useLocalStorage<string[]>('ring_favorites', [])
  const [messagesCount] = useState(0)

  const cartCount = store?.totalItems || 0
  const userRole = resolveSessionUserRole(session?.user?.role)
  const showAdminToggle = hasMemberPrivileges(session?.user?.role)
  const hideConcepts = hasConfidentialAccess(userRole)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isActive = (href: string) => {
    if (href === ROUTES.HOME(locale)) return pathname === ROUTES.HOME(locale)
    if (href === ROUTES.DOCS(locale)) {
      return pathname === href || pathname === `${href}/`
    }
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const rows = useMemo((): SyncedRow[] => {
    const list: SyncedRow[] = [
      {
        kind: 'pair',
        key: 'brand',
        href: ROUTES.HOME(locale),
        tall: true,
        markActive: false,
        rail: (
          <div className="flex w-[90%] max-h-[90%] items-center justify-center overflow-hidden aspect-square">
            <AnimatedLogo size={RAIL_LOGO_SIZE} />
          </div>
        ),
        aside: (
          <div className="min-w-0 leading-tight">
            <span className="block truncate text-lg font-bold text-primary">{siteName}</span>
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
        rail: <User className={ICON} strokeWidth={1.5} />,
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
          aside: (
            <div className="flex min-w-0 flex-1 items-center justify-between gap-2 text-[16px]">
              <span className="truncate font-medium">{session.user.name || 'Anonymous'}</span>
              <NavCreditTrailing />
            </div>
          ),
        },
        {
          kind: 'pair',
          key: 'wallet',
          href: ROUTES.WALLET(locale),
          rail: <Wallet className={ICON} strokeWidth={1.5} />,
          aside: <AsideLabel title={tNav('wallet')} />,
        },
        {
          kind: 'pair',
          key: 'notifications',
          href: ROUTES.NOTIFICATIONS(locale),
          rail: <Bell className={ICON} strokeWidth={1.5} />,
          aside: <AsideLabel title={tNav('notifications')} count={notificationCount} />,
        },
        {
          kind: 'pair',
          key: 'messages',
          href: ROUTES.MESSAGES(locale),
          rail: <MessageCircle className={ICON} strokeWidth={1.5} />,
          aside: <AsideLabel title={tNav('messages')} count={messagesCount} />,
        },
        {
          kind: 'pair',
          key: 'games',
          href: ROUTES.GAMES(locale),
          rail: <Gamepad2 className={ICON} strokeWidth={1.5} />,
          aside: <AsideLabel title={tNav('games')} />,
        },
        {
          kind: 'pair',
          key: 'tasks',
          href: ROUTES.TASKS(locale),
          rail: <ListTodo className={ICON} strokeWidth={1.5} />,
          aside: <AsideLabel title={tNav('tasks')} />,
        },
        {
          kind: 'pair',
          key: 'cart',
          href: ROUTES.CART(locale),
          rail: <ShoppingCart className={ICON} strokeWidth={1.5} />,
          aside: <AsideLabel title={tStore('cart.title')} count={cartCount} />,
        },
        {
          kind: 'pair',
          key: 'favorites',
          href: ROUTES.STORE(locale),
          rail: <Heart className={ICON} strokeWidth={1.5} />,
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
      trailing?: React.ReactNode
    }> = isMvmNav
      ? getMvmPrimaryNavSpecs(locale).map((spec) => {
          const icons = {
            store: <Store className={ICON} strokeWidth={1.5} />,
            entities: <Users className={ICON} strokeWidth={1.5} />,
            groupBuy: <ShoppingBag className={ICON} strokeWidth={1.5} />,
            account: <UserRound className={ICON} strokeWidth={1.5} />,
          } as const
          return {
            key: spec.id,
            href: spec.href,
            label: resolveNavLabel(tNav, spec.labelKeys),
            icon: icons[spec.id],
          }
        })
      : [
          {
            key: 'entities',
            href: ROUTES.ENTITIES(locale),
            label: tEntities('title'),
            icon: <Users className={ICON} strokeWidth={1.5} />,
            trailing: (
              <Crown
                className="ml-auto size-[22px] shrink-0 text-amber-500"
                strokeWidth={1.5}
                aria-label="Membership"
              />
            ),
          },
          {
            key: 'opportunities',
            href: ROUTES.OPPORTUNITIES(locale),
            label: tOpp('opportunities'),
            icon: <Briefcase className={ICON} strokeWidth={1.5} />,
            badge: 'New',
          },
          {
            key: 'store-nav',
            href: ROUTES.STORE(locale),
            label: tStore('title'),
            icon: <Store className={ICON} strokeWidth={1.5} />,
          },
          {
            key: 'docs-nav',
            href: ROUTES.DOCS(locale),
            label: tNav('sidebar.documentation'),
            icon: <FileText className={ICON} strokeWidth={1.5} />,
          },
        ]

    for (const item of primaryNav) {
      list.push({
        kind: 'pair',
        key: item.key,
        href: item.href,
        rail: item.icon,
        aside: (
          <div className="flex min-w-0 flex-1 items-center gap-2 text-[16px]">
            <span className="truncate">{item.label}</span>
            {item.trailing}
            {item.badge && (
              <Badge variant="secondary" className="ml-auto h-5 shrink-0 px-1.5 py-0 text-[10px]">
                {item.badge}
              </Badge>
            )}
          </div>
        ),
      })
    }

    if (showAdminToggle) {
      list.push({ kind: 'admin-toggle', key: 'admin-supermenu' })
    }

    if (!hideConcepts) {
      list.push({
        kind: 'section',
        key: 'concepts-h',
        label: tNav('sidebar.concepts', { default: 'Platform Concepts' }),
      })
      for (const item of [
        {
          key: 'ring-economy',
          href: ROUTES.TOKEN_ECONOMY(locale),
          label: `${nativeSymbol} ${tNav('sidebar.economics')}`,
          icon: <Coins className={ICON} strokeWidth={1.5} />,
        },
        {
          key: 'app-publisher',
          href: ROUTES.ABOUT_PUBLISHER(locale),
          label: tNav('sidebar.appPublisher'),
          icon: <Heart className={ICON} strokeWidth={1.5} />,
        },
        {
          key: 'global-impact',
          href: ROUTES.GLOBAL_IMPACT(locale),
          label: tNav('sidebar.globalImpact'),
          icon: <Globe className={ICON} strokeWidth={1.5} />,
        },
        {
          key: 'ai-web3',
          href: ROUTES.AI_WEB3(locale),
          label: tNav('sidebar.aiMeetsWeb3'),
          icon: <Zap className={ICON} strokeWidth={1.5} />,
        },
      ]) {
        list.push({
          kind: 'pair',
          key: item.key,
          href: item.href,
          rail: item.icon,
          aside: <span className="truncate text-[16px]">{item.label}</span>,
        })
      }
    }

    list.push({ kind: 'section', key: 'started-h', label: tNav('sidebar.getStarted') })
    for (const item of [
      {
        key: 'quick-start',
        href: ROUTES.DOCS_GETTING_STARTED(locale),
        label: tNav('sidebar.quickStart'),
        icon: <Rocket className={ICON} strokeWidth={1.5} />,
      },
      {
        key: 'calculator',
        href: ROUTES.CALCULATOR(locale),
        label: tNav('sidebar.calculatorCta'),
        icon: <Calculator className={ICON} strokeWidth={1.5} />,
      },
      {
        key: 'roadmap',
        href: ROUTES.ROADMAP(locale),
        label: tNav('sidebar.roadmap'),
        icon: <Map className={ICON} strokeWidth={1.5} />,
      },
    ]) {
      list.push({
        kind: 'pair',
        key: item.key,
        href: item.href,
        rail: item.icon,
        aside: <span className="truncate text-[16px]">{item.label}</span>,
      })
    }

    return list
  }, [
    cartCount,
    favorites.length,
    hideConcepts,
    isMvmNav,
    locale,
    messagesCount,
    nativeSymbol,
    notificationCount,
    session?.user,
    showAdminToggle,
    siteName,
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
            'flex items-end pb-px pl-1 text-[11px] uppercase tracking-wide text-[var(--color-contrast-low)]',
          )}
        >
          {row.label}
        </div>,
      )
      continue
    }

    if (row.kind === 'admin-toggle') {
      gridCells.push(
        <div key={`${row.key}-rail`} className={ROW} aria-hidden />,
        <div key={`${row.key}-aside`} className={cn(ROW, ASIDE_PAD)}>
          <AdminSupermenuToggle />
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
            'sidebar-nav-item sidebar-aside-col flex min-w-0 items-center gap-1 rounded-lg text-[16px] transition-colors hover:bg-foreground/5 data-current:bg-foreground/8',
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
    const showActive = row.markActive !== false && row.href ? isActive(row.href) : false
    gridCells.push(
      row.href ? (
        <Link
          key={`${row.key}-rail`}
          href={toAppHref(row.href)}
          data-current={showActive ? '' : undefined}
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
          data-current={showActive ? '' : undefined}
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
    <div className={cn('relative flex h-full min-h-0 flex-col text-[16px] font-medium', className)}>
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
            onClick={() => toggleThemeWithTransition(setTheme, theme, resolvedTheme)}
            className={FOOTER_BTN}
            aria-label="Toggle theme"
          >
            {!mounted ? (
              <Sun className="size-4" strokeWidth={1.5} />
            ) : resolvedTheme === 'dark' ? (
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
              title={
                currency === nativeTokenCurrency
                  ? `Switch to ${mainCurrency}`
                  : `Switch to ${nativeTokenCurrency}`
              }
              aria-label={
                currency === nativeTokenCurrency
                  ? `Switch to ${mainCurrency}`
                  : `Switch to ${nativeTokenCurrency}`
              }
            >
              {currency === nativeTokenCurrency
                ? 'Ⓡ'
                : currency === 'UAH'
                  ? '₴'
                  : currency === 'USD'
                    ? '$'
                    : currency}
            </button>
          )}
          <LocaleCodeMenu variant="footer" />
        </div>
      </div>

      {!collapsed && (
        <div
          className={cn(
            'relative z-[1] mt-auto grid shrink-0 grid-cols-[64px_minmax(0,1fr)] border-t border-border/50',
            FOOTER_H,
          )}
        >
          <div className={FOOTER_H} aria-hidden />
          <div className={cn(FOOTER_H, 'flex items-center px-2')}>
            <NavLegalFooter className="w-full" />
          </div>
        </div>
      )}
    </div>
  )
}
