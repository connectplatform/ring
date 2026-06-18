'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Link, toAppHref } from '@/i18n/routing'
import dynamic from 'next/dynamic'
import { useLocale, useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import {
  Bell,
  Heart,
  MessageCircle,
  ShoppingCart,
  User,
  Wallet,
} from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { ROUTES } from '@/constants/routes'
import { useCreditBalanceContext } from '@/components/providers/credit-balance-provider'
import { useUnreadCount } from '@/hooks/use-unread-count'
import { useOptionalStore } from '@/features/store/context'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { cn } from '@/lib/utils'
import type { Locale } from '@/i18n/shared'

const AnimatedLogo = dynamic(() => import('@/components/common/widgets/animated-logo'), {
  ssr: false,
})

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

  const { balance: tokenBalance, isLoading: balanceLoading } = useCreditBalanceContext()
  const { unreadCount: notificationCount } = useUnreadCount()
  const store = useOptionalStore()
  const [favorites] = useLocalStorage<string[]>('ring_favorites', [])
  const [messagesCount] = useState(0)

  const cartCount = store?.totalItems || 0
  const displayBalance = formatBalance(tokenBalance?.amount)

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
        aside: <AsideLabel title={session.user.name || 'Anonymous'} />,
      },
      {
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
    balanceLoading,
    cartCount,
    displayBalance,
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
    return (
      <div
        className={cn('shrink-0 border-b border-border/50', variant === 'rail' ? 'h-14' : 'h-12', className)}
        aria-hidden
      />
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
