'use client'

// Main imports
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, toAppHref } from '@/i18n/routing'
import { usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import dynamic from 'next/dynamic'

// Icon imports
import {
  Briefcase,
  Users,
  FileText,
  Plus,
  MoreHorizontal,
  Wallet,
  ShoppingBag,
  Building2,
  Bell,
  Settings,
  ChevronRight,
  Languages,
  Moon,
  Sun,
  LogIn,
  CircleEllipsis,
} from 'lucide-react'

import { ROUTES } from '@/constants/routes'
import { OpportunityTypeSelectorClient } from '@/components/opportunities/opportunity-type-selector-client'
import { useAuth } from '@/hooks/use-auth'
import { UserRolesArray, hasMemberPrivileges } from '@/features/auth/user-role'
import { useAdminSupermenu } from '@/features/admin/use-admin-supermenu'
import { useVendorStatus } from '@/hooks/use-vendor-status'
import { AdminSupermenuMobile } from '@/components/navigation/admin-supermenu'
import type { Locale } from '@/i18n/shared'
import { useRouter as useNextRouter } from 'next/navigation'
import {
  useRouter as useIntlRouter,
  usePathname as useIntlPathname,
  replaceLocalePath,
} from '@/i18n/routing'
import {
  localeDisplayLabel,
  nextLocaleInRoutingOrder,
  persistRingLocalePreference,
} from '@/lib/locale-pref'
import { signIn } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { toggleThemeWithTransition } from '@/lib/theme/ring-theme-transition'
import { eventBus } from '@/lib/event-bus.client'
import { cn } from '@/lib/utils'
import { getBrandName } from '@/lib/site-branding'
import {
  BorderBeam,
  davinciAuthButtonLift,
  davinciGlassSurface,
} from '@/lib/ui/davinci'
import { NavLegalFooter } from '@/components/navigation/nav-legal-footer'

// TODO: Consider using React.lazy instead of next/dynamic as React 19 is stable,
// but for SSR disabling 'AnimatedLogo' component, next/dynamic is okay here.
const AnimatedLogo = dynamic(() => import('@/components/common/widgets/animated-logo'), {
  ssr: false,
})

/**
 * Props for each bottom navigation item
 */
interface NavItemProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  href: string
  isActive: boolean
  onClick?: () => void
  isButton?: boolean
}

/**
 * Navigation item component, reusable for both button and link navigation
 */
function NavItem({ icon: Icon, label, href, isActive, onClick, isButton }: NavItemProps) {
  // Style isActive item with native tailwind text-primary, others appear muted unless hovered
  const className = `flex flex-col items-center justify-center p-2 min-w-0 flex-1 transition-all duration-200 ${
    isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
  }`

  // Simple content block: icon and label
  const content = (
    <>
      <Icon
        className={`h-5 w-5 mb-1 transition-transform duration-200 ${
          isActive ? 'scale-110' : ''
        }`}
      />
      <span className="text-xs font-medium truncate">{label}</span>
    </>
  )

  // If 'isButton' render <button>, otherwise render <Link>.
  if (isButton && onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    )
  }

  // Wrap with Next-intl aware link
  return (
    <Link href={toAppHref(href)} onClick={onClick} className={className}>
      {content}
    </Link>
  )
}

/**
 * Main Plus action button that floats above the navigation bar as a CTA.
 */
function CenterAddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex items-center justify-center w-[68px] h-[68px] bg-transparent hover:bg-primary/10 rounded-full transition-all duration-200 hover:scale-105 active:scale-95 -mt-6"
      aria-label="Add new"
    >
      <div className="absolute inset-0 z-10 flex items-center justify-center">
        <AnimatedLogo />
      </div>
      <div className="absolute inset-0 z-20 flex items-center justify-center">
        <Plus className="h-5 w-5 text-primary drop-shadow-sm" />
      </div>
    </button>
  )
}

// TODO: Improve Guest Auth with more granular error handling for sign-in failures, leveraging React 19 useEffectEvent?
/**
 * Render authentication UI for unauthenticated users inside menu modal
 */
function BottomNavGuestAuth({
  onClose,
  className,
  style,
}: {
  onClose?: () => void
  className?: string
  style?: React.CSSProperties
}) {
  const tAuth = useTranslations('modules.auth')
  const tNav = useTranslations('navigation')
  const router = useNextRouter()
  const locale = useLocale() as Locale

  /**
   * Handles external authentication flow (google/apple/metamask)
   */
  const handleSignIn = async (provider: 'google' | 'apple' | 'metamask') => {
    if (provider === 'metamask') {
      // Special web3 wallet navigation
      router.push(ROUTES.WALLET_CONNECT(locale))
      onClose?.()
      return
    }
    // Determine callback URL based on environment
    const callbackUrl =
      typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`
        : `/${locale}`
    await signIn(provider, { callbackUrl })
    onClose?.()
  }

  return (
    <BorderBeam
      className={cn('rounded-2xl mb-6', className)}
      innerClassName={cn('p-5', davinciGlassSurface, 'border-0')}
      style={style}
      duration="5s"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
          <LogIn className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          {/* Show both sign-in and fallback to login if translation not present */}
          <p className="text-sm font-semibold text-foreground">{tNav('signIn') || tAuth('login')}</p>
          <p className="text-xs text-muted-foreground">{tAuth('signIn.subtitle')}</p>
        </div>
      </div>
      {/* Button group: Google, Apple, Metamask */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => handleSignIn('google')}
          className={cn(
            'flex items-center justify-center gap-3 w-full py-3.5 px-4 rounded-xl',
            'bg-white text-gray-800 hover:bg-gray-50 font-semibold shadow-lg shadow-black/5',
            davinciAuthButtonLift
          )}
        >
          {/* Inline Google logo, since branding requires logo */}
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {tAuth('signIn.providers.google')}
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => handleSignIn('apple')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 py-3.5 px-4 rounded-xl',
              'bg-black text-white hover:bg-gray-900 font-semibold shadow-lg',
              davinciAuthButtonLift
            )}
          >
            {tAuth('signIn.providers.apple')}
          </button>
          <button
            type="button"
            onClick={() => handleSignIn('metamask')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 py-3.5 px-4 rounded-xl',
              'bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold shadow-lg',
              davinciAuthButtonLift
            )}
          >
            {tAuth('signIn.providers.metamask')}
          </button>
        </div>
      </div>
    </BorderBeam>
  )
}

// Menu item data type for menu modals
type BottomNavMenuItem = {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  iconBg: string
  iconColor: string
}

/**
 * Props for fullscreen overlay menu
 */
interface BottomNavFullscreenMenuProps {
  isOpen: boolean
  onClose: () => void
  menuItems: BottomNavMenuItem[]
  brandTitle?: string
  brandSubtitle?: string
}

// TODO: On React 19 and Next 14/16, consider using useOptimistic or useActionState for state transitions
/**
 * Fullscreen modal navigation menu for mobile
 */
function BottomNavFullscreenMenu({
  isOpen,
  onClose,
  menuItems,
  brandTitle,
  brandSubtitle,
}: BottomNavFullscreenMenuProps) {
  const intlRouter = useIntlRouter()
  const intlPathname = useIntlPathname()
  const nextRouter = useNextRouter()
  const locale = useLocale() as Locale
  const t = useTranslations('navigation')
  const { data: session } = useSession()
  const { setTheme, theme, resolvedTheme } = useTheme()
  const [animateIn, setAnimateIn] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  const isLoggedIn = !!session?.user
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (isOpen) {
      const id = prefersReducedMotion ? 0 : window.setTimeout(() => setAnimateIn(true), 50)
      return () => window.clearTimeout(id)
    }
    setAnimateIn(false)
  }, [isOpen, prefersReducedMotion])

  useEffect(() => {
    if (!isOpen) return
    const unsubscribe = eventBus.on('modal:close-all', onClose)
    eventBus.emit('modal:opened', { modalId: 'bottom-nav-fullscreen-menu', zIndex: 8990 })
    return () => {
      unsubscribe()
      eventBus.emit('modal:closed', { modalId: 'bottom-nav-fullscreen-menu' })
    }
  }, [isOpen, onClose])

  const switchLocale = useCallback(
    (newLocale: Locale) => {
      persistRingLocalePreference(newLocale)
      replaceLocalePath(intlRouter, intlPathname, newLocale)
      onClose()
    },
    [intlPathname, intlRouter, onClose]
  )

  const handleItemClick = (href: string) => {
    nextRouter.push(href)
    onClose()
  }

  if (!isOpen) return null

  const title = brandTitle ?? getBrandName()
  const subtitle = brandSubtitle ?? t('menu.subtitle', { default: 'Ring Platform' })

  return (
    <div
      className={cn(
        'fixed inset-x-0 top-0 z-[8990] md:hidden overflow-hidden',
        'bottom-[var(--mobile-bottom-nav-h,calc(3.5rem+env(safe-area-inset-bottom,0px)))]',
      )}
      data-modal="true"
      role="dialog"
      aria-label={t('menu.title')}
    >
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5 transition-opacity duration-300',
          animateIn ? 'opacity-100' : 'opacity-0'
        )}
      />
      <div className={cn('absolute inset-0 backdrop-blur-xl bg-background/80')} />
      {!prefersReducedMotion && (
        <>
          <div
            className={cn(
              'absolute w-64 h-64 rounded-full blur-3xl pointer-events-none',
              'top-20 -left-20 bg-gradient-to-br from-primary/20 to-orange-500/20'
            )}
          />
          <div
            className={cn(
              'absolute w-64 h-64 rounded-full blur-3xl pointer-events-none',
              'bottom-40 -right-20 bg-gradient-to-br from-blue-500/20 to-purple-500/20'
            )}
          />
        </>
      )}

      <div className="relative h-full flex flex-col px-6 pt-8 pb-6 overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          aria-label={t('close', { default: 'Close' })}
        >
          <span className="text-lg leading-none" aria-hidden>
            ×
          </span>
        </button>

        <div
          className={cn(
            'text-center mb-8 transition-all duration-500',
            animateIn ? 'translate-y-0 opacity-100' : '-translate-y-8 opacity-0'
          )}
          style={{ transitionDelay: prefersReducedMotion ? '0ms' : '150ms' }}
        >
          <h2 className="text-3xl font-black tracking-tight bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground font-medium mt-1">{subtitle}</p>
        </div>

        {!isLoggedIn && (
          <BottomNavGuestAuth
            onClose={onClose}
            className={cn(
              'transition-all duration-500',
              animateIn ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            )}
            style={{ transitionDelay: prefersReducedMotion ? '0ms' : '200ms' }}
          />
        )}

        <div className="flex-1 space-y-3">
          {menuItems.map((item, index) => {
            const Icon = item.icon
            const baseDelay = 250
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemClick(item.href)}
                className={cn(
                  'w-full p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all duration-300 group flex items-center gap-4 text-left',
                  animateIn ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'
                )}
                style={{
                  transitionDelay: prefersReducedMotion
                    ? '0ms'
                    : `${baseDelay + index * 50}ms`,
                }}
              >
                <div
                  className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300',
                    item.iconBg
                  )}
                >
                  <Icon className={cn('h-6 w-6', item.iconColor)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                    {item.title}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-all shrink-0" />
              </button>
            )
          })}
        </div>

        <div
          className={cn(
            'mt-auto pt-4 border-t border-white/10 transition-all duration-500',
            animateIn ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
          )}
          style={{ transitionDelay: prefersReducedMotion ? '0ms' : '500ms' }}
        >
          <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2">
            <button
              type="button"
              onClick={() => switchLocale(nextLocaleInRoutingOrder(locale))}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
              title={localeDisplayLabel(locale)}
              aria-label={`Switch locale (${localeDisplayLabel(locale)})`}
            >
              <Languages className="h-4 w-4 text-primary" />
            </button>
            <NavLegalFooter
              density="comfortable"
              align="center"
              className="min-w-0 px-1"
            />
            <button
              type="button"
              onClick={() => toggleThemeWithTransition(setTheme, theme, resolvedTheme)}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
              aria-label={t('toggleTheme')}
            >
              {resolvedTheme === 'dark' ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * BottomNavigation: root mobile nav bar (and overlay menu portals).
 * Separates logic and disables on md+ viewports.
 */
export default function BottomNavigation() {
  const pathname = usePathname()
  const locale = useLocale() as Locale
  const { hasRole } = useAuth()
  const { data: session } = useSession()
  const t = useTranslations('navigation')
  const [showOpportunitySelector, setShowOpportunitySelector] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [adminMenuOpen, setAdminMenuOpen] = useState(false)

  const isLoggedIn = !!session?.user
  const isMemberPlus = hasMemberPrivileges(session?.user?.role)
  const { hasVendor } = useVendorStatus()
  const { hasContent: hasAdminSupermenu } = useAdminSupermenu(
    session?.user?.role,
    locale,
    { hasVendor },
  )

  /**
   * Determine if the given href matches the current route.
   */
  const isActive = (href: string) => {
    if (href === `/${locale}`) {
      return pathname === `/${locale}` || pathname === '/'
    }
    return pathname.startsWith(href)
  }

  /**
   * Memoized menu items for authenticated users.
   */
  const loggedInMenuItems: BottomNavMenuItem[] = useMemo(
    () => [
      {
        id: 'wallet',
        title: t('wallet'),
        description: t('menu.wallet.description'),
        icon: Wallet,
        href: `/${locale}/wallet`,
        iconBg: 'bg-emerald-500/20',
        iconColor: 'text-emerald-400',
      },
      {
        id: 'store',
        title: t('store'),
        description: t('menu.store.description'),
        icon: ShoppingBag,
        href: `/${locale}/store`,
        iconBg: 'bg-violet-500/20',
        iconColor: 'text-violet-400',
      },
      {
        id: 'entities',
        title: t('entities'),
        description: t('menu.entities.description'),
        icon: Building2,
        href: ROUTES.ENTITIES(locale),
        iconBg: 'bg-blue-500/20',
        iconColor: 'text-blue-400',
      },
      {
        id: 'opportunities',
        title: t('opportunities'),
        description: t('menu.opportunities.description'),
        icon: Briefcase,
        href: ROUTES.OPPORTUNITIES(locale),
        iconBg: 'bg-amber-500/20',
        iconColor: 'text-amber-400',
      },
      {
        id: 'notifications',
        title: t('notifications'),
        description: t('menu.notifications.description'),
        icon: Bell,
        href: `/${locale}/notifications`,
        iconBg: 'bg-rose-500/20',
        iconColor: 'text-rose-400',
      },
      {
        id: 'settings',
        title: t('settings'),
        description: t('menu.settings.description'),
        icon: Settings,
        href: ROUTES.SETTINGS(locale),
        iconBg: 'bg-slate-500/20',
        iconColor: 'text-slate-400',
      },
      {
        id: 'docs',
        title: t('docs'),
        description: t('menu.docs.description'),
        icon: FileText,
        href: ROUTES.DOCS(locale),
        iconBg: 'bg-cyan-500/20',
        iconColor: 'text-cyan-400',
      },
    ],
    [locale, t]
  )

  /**
   * Memoized menu items for guest (unauthenticated) users.
   */
  const guestMenuItems: BottomNavMenuItem[] = useMemo(
    () => [
      {
        id: 'settings',
        title: t('settings'),
        description: t('menu.settings.description'),
        icon: Settings,
        href: ROUTES.SETTINGS(locale),
        iconBg: 'bg-slate-500/20',
        iconColor: 'text-slate-400',
      },
      {
        id: 'store',
        title: t('store'),
        description: t('menu.store.description'),
        icon: ShoppingBag,
        href: `/${locale}/store`,
        iconBg: 'bg-violet-500/20',
        iconColor: 'text-violet-400',
      },
      {
        id: 'docs',
        title: t('docs'),
        description: t('menu.docs.description'),
        icon: FileText,
        href: ROUTES.DOCS(locale),
        iconBg: 'bg-cyan-500/20',
        iconColor: 'text-cyan-400',
      },
    ],
    [locale, t]
  )

  // Select appropriate menu per user state
  const menuItems = isLoggedIn ? loggedInMenuItems : guestMenuItems

  const openRingMenu = () => {
    setShowOpportunitySelector(false)
    setAdminMenuOpen(false)
    setMenuOpen((v) => !v)
  }

  const openAdminMenu = () => {
    setShowOpportunitySelector(false)
    setMenuOpen(false)
    setAdminMenuOpen((v) => !v)
  }

  const openAddOpportunity = useCallback(() => {
    setMenuOpen(false)
    setAdminMenuOpen(false)
    setShowOpportunitySelector(true)
  }, [])

  const closeOpportunitySelector = useCallback(() => {
    setShowOpportunitySelector(false)
  }, [])

  /**
   * Base navigation items: opportunities, entities, docs|admin, ring menu.
   * Member+: Admin opens AdminSupermenuMobile; Ring opens platform-only fullscreen menu.
   */
  const navItems = [
    {
      icon: Briefcase,
      label: t('opportunities'),
      href: ROUTES.OPPORTUNITIES(locale),
      isActive: isActive(ROUTES.OPPORTUNITIES(locale)),
    },
    {
      icon: Users,
      label: t('entities'),
      href: ROUTES.ENTITIES(locale),
      isActive: isActive(ROUTES.ENTITIES(locale)),
    },
    isMemberPlus && hasAdminSupermenu
      ? {
          icon: CircleEllipsis,
          label: t('admin.label'),
          href: '#admin',
          isActive: adminMenuOpen,
          isButton: true,
          onClick: openAdminMenu,
        }
      : {
          icon: FileText,
          label: t('docs'),
          href: ROUTES.DOCS(locale),
          isActive: isActive(ROUTES.DOCS(locale)),
        },
    {
      icon: MoreHorizontal,
      label: t('menu.title', { default: 'Menu' }),
      href: '#menu',
      isActive: menuOpen,
      isButton: true,
      onClick: openRingMenu,
    },
  ]

  const closeMenus = () => {
    setShowOpportunitySelector(false)
    setMenuOpen(false)
    setAdminMenuOpen(false)
  }

  // TODO: Consider replacing 'showOpportunitySelector' and 'menuOpen' with useTransition or useOptimistic for atomic state transitions on React 19.

  const MOBILE_BOTTOM_NAV_H = 'calc(3.5rem + env(safe-area-inset-bottom, 0px))'

  // Own --mobile-bottom-nav-h on :root so sibling overlays (Admin / Ring / Add) inherit it
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--mobile-bottom-nav-h', MOBILE_BOTTOM_NAV_H)
    return () => {
      root.style.removeProperty('--mobile-bottom-nav-h')
    }
  }, [])

  return (
    <>
      {/* Bottom navigation bar, fixed only on mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-[9000] md:hidden">
        <div className="flex items-end justify-around bg-white/10 dark:bg-black/10 backdrop-blur-md border-t border-border px-2 py-1">
          {/* Render first two navigation items */}
          {navItems.slice(0, 2).map((item) => (
            <NavItem
              key={item.href}
              icon={item.icon}
              label={item.label}
              href={item.href}
              isActive={item.isActive}
              onClick={closeMenus}
            />
          ))}

          {/* Render floating plus/center action button */}
          <div className="flex-1 flex justify-center">
            <CenterAddButton onClick={openAddOpportunity} />
          </div>

          {/* Render remaining navigation items (e.g. docs|admin & menu) */}
          {navItems.slice(2).map((item) => (
            <NavItem
              key={item.href}
              icon={item.icon}
              label={item.label}
              href={item.href}
              isActive={item.isActive}
              isButton={item.isButton}
              onClick={item.isButton ? item.onClick : closeMenus}
            />
          ))}
        </div>
        {/* Push up for safe-area-inset (iOS bottom bar and alike) */}
        <div className="h-safe-area-inset-bottom bg-background/95" />
      </nav>

      {/* Opportunity type picker — bottom-nav-aware mobile sheet */}
      {showOpportunitySelector && (
        <OpportunityTypeSelectorClient
          layout="mobile-sheet"
          onClose={closeOpportunitySelector}
          userRole={
            hasRole(UserRolesArray.member) ? 'member' : 'subscriber'
          }
          locale={locale}
        />
      )}

      {/* Ring (three-dots) platform-only fullscreen menu */}
      <BottomNavFullscreenMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        menuItems={menuItems}
        brandSubtitle={t('menu.subtitle', { default: 'Ring Platform' })}
      />

      {/* Admin supermenu mobile panel */}
      <AdminSupermenuMobile
        open={adminMenuOpen}
        onClose={() => setAdminMenuOpen(false)}
      />
    </>
  )
}
