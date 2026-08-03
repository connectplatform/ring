'use client'

import React, { useState, useEffect, useCallback, useMemo, forwardRef } from 'react'
import { Link, usePathname, toAppHref } from '@/i18n/routing'
import { useLocale, useTranslations } from 'next-intl'
import {
  Wallet,
  Heart,
  Copy,
  Check,
  Coins,
  Crown,
  Globe,
  Zap,
  Rocket,
  Calculator,
  Map,
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import {
  hasConfidentialAccess,
  hasMemberPrivileges,
  resolveSessionUserRole,
} from '@/features/auth/user-role'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/constants/routes'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { getClientNativeTokenSymbol } from '@/lib/ring-config-client'
import type { Locale } from '@/i18n/shared'
import { SidebarIdentityPanel } from './sidebar-identity-panel'
import { AdminSupermenuToggle } from './admin-supermenu'
import { NavLegalFooter } from './nav-legal-footer'

interface NavigationItem {
  href: string
  label: string
  icon?: React.ReactNode
  badge?: string | number
  trailing?: React.ReactNode
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

const ICON = 'size-[22px] shrink-0 text-[var(--color-contrast-medium)]'

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
    const nativeSymbol = getClientNativeTokenSymbol()
    const userRole = resolveSessionUserRole(session?.user?.role)
    const showAdminToggle = hasMemberPrivileges(session?.user?.role)
    const hideConcepts = hasConfidentialAccess(userRole)

    useEffect(() => {
      setMounted(true)
    }, [])

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

    const navigationItems: NavigationItem[] = useMemo(() => {
      const items: NavigationItem[] = [
        {
          href: ROUTES.ENTITIES(locale),
          label: tEntities('title'),
          trailing: (
            <Crown
              className="ml-auto size-[22px] shrink-0 text-amber-500"
              strokeWidth={1.5}
              aria-label="Membership"
            />
          ),
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
      ]

      if (!hideConcepts) {
        items.push(
          { divider: 'divider-concepts', href: '#', label: '', icon: null },
          {
            href: ROUTES.TOKEN_ECONOMY(locale),
            label: `${nativeSymbol} ${tNav('sidebar.economics')}`,
            icon: <Coins className={ICON} strokeWidth={1.5} />,
          },
          {
            href: ROUTES.ABOUT_PUBLISHER(locale),
            label: tNav('sidebar.appPublisher'),
            icon: <Heart className={ICON} strokeWidth={1.5} />,
          },
          {
            href: ROUTES.GLOBAL_IMPACT(locale),
            label: tNav('sidebar.globalImpact'),
            icon: <Globe className={ICON} strokeWidth={1.5} />,
          },
          {
            href: ROUTES.AI_WEB3(locale),
            label: tNav('sidebar.aiMeetsWeb3'),
            icon: <Zap className={ICON} strokeWidth={1.5} />,
          },
        )
      }

      items.push(
        { divider: 'divider-docs', href: '#', label: '', icon: null },
        {
          href: ROUTES.DOCS_GETTING_STARTED(locale),
          label: tNav('sidebar.quickStart'),
          icon: <Rocket className={ICON} strokeWidth={1.5} />,
        },
        {
          href: ROUTES.CALCULATOR(locale),
          label: tNav('sidebar.calculatorCta'),
          icon: <Calculator className={ICON} strokeWidth={1.5} />,
        },
        {
          href: ROUTES.ROADMAP(locale),
          label: tNav('sidebar.roadmap'),
          icon: <Map className={ICON} strokeWidth={1.5} />,
        },
      )

      return items
    }, [hideConcepts, locale, nativeSymbol, tEntities, tNav, tOpp, tStore])

    const isActive = (href: string) => {
      if (href === ROUTES.HOME(locale)) return pathname === ROUTES.HOME(locale)
      if (href === ROUTES.DOCS(locale)) {
        return pathname === href || pathname === `${href}/`
      }
      return pathname === href || pathname.startsWith(`${href}/`)
    }

    const dividerLabels: Record<string, string> = {
      'divider-concepts': tNav('sidebar.concepts', { default: 'Platform Concepts' }),
      'divider-docs': tNav('sidebar.getStarted'),
    }

    const walletAddress = session?.user?.wallets?.[0]?.address

    return (
      <aside
        className={cn(
          'relative z-1 h-full shrink-0 overflow-hidden isolate text-[16px] font-medium',
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
                      <h2 className="text-[var(--color-contrast-low)] text-[12px] mb-1.5 mt-2 pl-4">
                        {dividerLabels[item.divider] ?? ''}
                      </h2>
                    </div>
                  )
                }

                const active = isActive(item.href)
                const mirrored = Boolean(item.railMirrored)
                const isDocs = item.href === ROUTES.DOCS(locale)
                return (
                  <React.Fragment key={item.href}>
                    <Link
                      href={toAppHref(item.href)}
                      data-current={active ? '' : undefined}
                      className={cn(
                        'sidebar-nav-item flex items-center gap-2 rounded-lg transition-colors hover:bg-foreground/5 data-current:bg-foreground/8',
                        'h-11 min-h-11 px-2',
                      )}
                    >
                      {!mirrored && item.icon && (
                        <span className="flex w-6 shrink-0 items-center justify-center text-[var(--color-contrast-medium)]">
                          {item.icon}
                        </span>
                      )}
                      <span className={cn('flex-1 truncate', mirrored && 'pl-0.5')}>{item.label}</span>
                      {item.trailing}
                      {item.badge && (
                        <Badge variant="secondary" className="ml-auto h-5 px-1.5 py-0 text-[10px]">
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                    {isDocs && mounted && showAdminToggle && (
                      <div className="px-0 py-0.5">
                        <AdminSupermenuToggle />
                      </div>
                    )}
                  </React.Fragment>
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
            <NavLegalFooter />
          </div>
        </div>
      </aside>
    )
  },
)
