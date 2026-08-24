'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Link, toAppHref } from '@/i18n/routing'
import { useLocale, useTranslations } from 'next-intl'
import AnimatedLogo from '@/components/common/widgets/animated-logo'
import { useSession } from 'next-auth/react'
import {
  Bell,
  Heart,
  ListTodo,
  MessageCircle,
  Gamepad2,
  ShoppingCart,
  User,
  Wallet,
} from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { ROUTES } from '@/constants/routes'
import { useNotificationContext } from '@/features/notifications/components/notification-provider'
import { useOptionalStore } from '@/features/store/context'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { cn } from '@/lib/utils'
import type { Locale } from '@/i18n/shared'
import { NavCreditTrailing } from './nav-credit-trailing'

type IdentityVariant = 'split' | 'rail' | 'aside' | 'rail-strip' | 'aside-strip'

interface SidebarIdentityPanelProps {
  /** split = rail+aside columns; rail = logo on dark strip only; aside = combined rows for overlay */
  variant?: IdentityVariant
  className?: string
}

interface IdentityRowData {
  key: string
  href?: string
  rail: React.ReactNode
  aside: React.ReactNode
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

function AsideLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={toAppHref(href)}
      className="flex h-10 w-full min-w-0 items-center rounded-lg px-2 transition-colors hover:bg-foreground/[0.04]"
    >
      {children}
    </Link>
  )
}

function RailCell({ href, children }: { href?: string; children: React.ReactNode }) {
  const cell = (
    <div className="flex size-10 items-center justify-center text-white">{children}</div>
  )
  if (!href) return cell
  return (
    <Link
      href={toAppHref(href)}
      className="flex h-10 w-full items-center justify-center rounded-lg transition-colors hover:bg-white/10"
    >
      {cell}
    </Link>
  )
}

export function SidebarIdentityPanel({ variant = 'split', className }: SidebarIdentityPanelProps) {
  const locale = useLocale() as Locale
  const { data: session } = useSession()
  const [mounted, setMounted] = useState(false)
  const tNav = useTranslations('navigation')
  const tStore = useTranslations('modules.store')
  const tFav = useTranslations('modules.store.favorites')

  const { unreadCount: notificationCount } = useNotificationContext()
  const store = useOptionalStore()
  const [favorites] = useLocalStorage<string[]>('ring_favorites', [])
  const [messagesCount] = useState(0)

  const cartCount = store?.totalItems || 0

  useEffect(() => {
    setMounted(true)
  }, [])

  const rows = useMemo((): IdentityRowData[] => {
    const logoRail = (
      <div className="flex size-10 items-center justify-center overflow-hidden">
        <AnimatedLogo size={40} />
      </div>
    )

    const logoAside = (
      <div className="min-w-0">
        <span className="block truncate font-bold text-base leading-tight text-primary">Ring Platform</span>
        <p className="truncate text-[10px] leading-tight text-muted-foreground">AI Self-Construct</p>
      </div>
    )

    const base: IdentityRowData[] = [
      {
        key: 'brand',
        href: ROUTES.HOME(locale),
        rail: logoRail,
        aside: logoAside,
      },
    ]

    if (!session?.user) {
      base.push({
        key: 'sign-in',
        href: ROUTES.LOGIN(locale),
        rail: <User className="size-[18px]" strokeWidth={1.5} />,
        aside: <AsideLabel title={tNav('sidebar.signIn')} />,
      })
      return base
    }

    return [
      ...base,
      {
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
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2 text-[13px]">
            <span className="truncate font-medium">{session.user.name || 'Anonymous'}</span>
            <NavCreditTrailing />
          </div>
        ),
      },
      {
        key: 'wallet',
        href: ROUTES.WALLET(locale),
        rail: <Wallet className="size-[18px]" strokeWidth={1.5} />,
        aside: <AsideLabel title={tNav('wallet')} />,
      },
      {
        key: 'notifications',
        href: ROUTES.NOTIFICATIONS(locale),
        rail: <Bell className="size-[18px]" strokeWidth={1.5} />,
        aside: <AsideLabel title={tNav('notifications')} count={notificationCount} />,
      },
      {
        key: 'messages',
        href: ROUTES.MESSAGES(locale),
        rail: <MessageCircle className="size-[18px]" strokeWidth={1.5} />,
        aside: <AsideLabel title={tNav('messages')} count={messagesCount} />,
      },
      {
        key: 'games',
        href: ROUTES.GAMES(locale),
        rail: <Gamepad2 className="size-[18px]" strokeWidth={1.5} />,
        aside: <AsideLabel title={tNav('games')} />,
      },
      {
        key: 'tasks',
        href: ROUTES.TASKS(locale),
        rail: <ListTodo className="size-[18px]" strokeWidth={1.5} />,
        aside: <AsideLabel title={tNav('tasks')} />,
      },
      {
        key: 'cart',
        href: ROUTES.CART(locale),
        rail: <ShoppingCart className="size-[18px]" strokeWidth={1.5} />,
        aside: <AsideLabel title={tStore('cart.title')} count={cartCount} />,
      },
      {
        key: 'favorites',
        href: ROUTES.STORE(locale),
        rail: <Heart className="size-[18px]" strokeWidth={1.5} />,
        aside: <AsideLabel title={tFav('button')} count={favorites.length} />,
      },
    ]
  }, [
    cartCount,
    favorites.length,
    locale,
    messagesCount,
    notificationCount,
    session?.user,
    tFav,
    tNav,
    tStore,
  ])

  if (!mounted) {
    // Instant skeleton — do not leave Profile/credit blank during hydration
    return (
      <div
        className={cn(
          'shrink-0 border-b border-border/50',
          variant === 'rail' ? 'h-14 bg-[#090909]' : 'h-12 px-3',
          className,
        )}
        aria-hidden
        data-testid="sidebar-identity-skeleton"
      >
        {variant !== 'rail' && (
          <div className="flex h-full items-center justify-between gap-2">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="flex items-center gap-1">
              <div className="size-3.5 animate-pulse rounded bg-muted" />
              <div className="h-3.5 w-10 animate-pulse rounded bg-muted" />
            </div>
          </div>
        )}
      </div>
    )
  }

  if (variant === 'rail-strip') {
    return (
      <div className={cn('flex shrink-0 flex-col border-b border-border/50 px-3 pb-2 pt-2', className)}>
        {rows.map((row) => (
          <RailCell key={row.key} href={row.href}>
            {row.rail}
          </RailCell>
        ))}
      </div>
    )
  }

  if (variant === 'aside-strip') {
    return (
      <div className={cn('flex shrink-0 flex-col border-b border-border/50 pr-2', className)}>
        {rows.map((row) => (
          <AsideLink key={row.key} href={row.href!}>
            {row.aside}
          </AsideLink>
        ))}
      </div>
    )
  }

  if (variant === 'rail') {
    const brand = rows[0]
    return (
      <div
        className={cn(
          'flex w-16 shrink-0 justify-center border-b border-border/50 bg-[#090909] px-3 py-2',
          className,
        )}
      >
        <RailCell href={brand.href}>{brand.rail}</RailCell>
      </div>
    )
  }

  if (variant === 'aside') {
    return (
      <div className={cn('flex shrink-0 flex-col border-b border-border/50', className)}>
        {rows.map((row) => (
          <AsideLink key={row.key} href={row.href!}>
            <div className="flex w-full min-w-0 items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center text-[var(--color-contrast-medium)]">
                {row.rail}
              </span>
              <div className="min-w-0 flex-1">{row.aside}</div>
            </div>
          </AsideLink>
        ))}
      </div>
    )
  }

  /* split: explicit two-column strip — rail cells and aside cells stay row-synced */
  return (
    <div className={cn('flex shrink-0 border-b border-border/50', className)}>
      <div className="flex w-16 shrink-0 flex-col bg-[#090909] px-3 pb-2 pt-2">
        {rows.map((row) => (
          <RailCell key={row.key} href={row.href}>
            {row.rail}
          </RailCell>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col pr-2">
        {rows.map((row) => (
          <AsideLink key={row.key} href={row.href!}>
            {row.aside}
          </AsideLink>
        ))}
      </div>
    </div>
  )
}
