'use client'

// Main imports
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, toAppHref } from '@/i18n/routing'
import { usePathname, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import AnimatedLogo from '@/components/common/widgets/animated-logo'

// Icon imports
import {
  Plus,
  ChevronRight,
  Moon,
  Sun,
  User,
} from 'lucide-react'
import { LocaleCodeMenu } from '@/components/common/locale-code-menu'

import { OpportunityTypeSelectorClient } from '@/components/opportunities/opportunity-type-selector-client'
import { useAuth } from '@/hooks/use-auth'
import { UserRolesArray, hasMemberPrivileges } from '@/features/auth/user-role'
import { useAdminSupermenu } from '@/features/admin/use-admin-supermenu'
import { useVendorStatus } from '@/hooks/use-vendor-status'
import { AdminSupermenuMobile } from '@/components/navigation/admin-supermenu'
import type { Locale } from '@/i18n/shared'
import { useTheme } from 'next-themes'
import { toggleThemeWithTransition } from '@/lib/theme/ring-theme-transition'
import { eventBus } from '@/lib/event-bus.client'
import { cn } from '@/lib/utils'
import { getBrandName } from '@/lib/site-branding'
import {
  getPrimaryNavManifest,
  navHrefIsActive,
  resolveNavLabel,
} from '@/lib/navigation/primary-nav'
import { getResolvedPlatformMenuItems } from '@/lib/navigation/platform-menu'
import { sidebarPathIsActive } from '@/lib/navigation/desktop-primary-nav'
import { getPrimaryNavIcon } from '@/lib/navigation/primary-nav-icons'
import { davinciGlassSurface } from '@/lib/ui/davinci'
import { NavLegalFooter } from '@/components/navigation/nav-legal-footer'
import { FsModal } from '@/components/ui/fs-modal'
import { LoginWidget } from '@/features/auth/components/login-widget'

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
  /** Overflow / login tab — used by the ghost-click swallow. */
  overflowTrigger?: boolean
}

/** iOS/Android: touchend then a delayed compatibility click on the same coordinates. */
const GHOST_CLICK_MS = 700

function armGhostClickGuard(ms: number = GHOST_CLICK_MS) {
  if (typeof document === 'undefined') return
  const until = Date.now() + ms
  const swallow = (event: Event) => {
    if (Date.now() > until) return
    const el = event.target
    if (!(el instanceof Element)) return
    const hitsOverlay =
      el.hasAttribute('data-radix-dialog-overlay') ||
      !!el.closest('[data-radix-dialog-overlay]')
    const hitsTrigger = !!el.closest('[data-overflow-trigger="true"]')
    if (hitsOverlay || hitsTrigger) {
      event.preventDefault()
      event.stopPropagation()
    }
  }
  document.addEventListener('click', swallow, true)
  document.addEventListener('pointerdown', swallow, true)
  document.addEventListener('pointerup', swallow, true)
  window.setTimeout(() => {
    document.removeEventListener('click', swallow, true)
    document.removeEventListener('pointerdown', swallow, true)
    document.removeEventListener('pointerup', swallow, true)
  }, ms)
}

/**
 * Navigation item component, reusable for both button and link navigation
 */
function NavItem({
  icon: Icon,
  label,
  href,
  isActive,
  onClick,
  isButton,
  overflowTrigger,
}: NavItemProps) {
  const lastActivate = useRef(0)
  const className = `flex flex-col items-center justify-center p-2 min-w-0 flex-1 touch-manipulation select-none transition-all duration-200 ${
    isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
  }`

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

  const activate = () => {
    if (!onClick) return
    const now = Date.now()
    if (now - lastActivate.current < 400) return
    lastActivate.current = now
    onClick()
  }

  if (isButton && onClick) {
    return (
      <button
        type="button"
        className={className}
        data-overflow-trigger={overflowTrigger ? 'true' : undefined}
        aria-expanded={isActive}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          activate()
        }}
      >
        {content}
      </button>
    )
  }

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
  const lastActivate = useRef(0)
  const activate = () => {
    const now = Date.now()
    if (now - lastActivate.current < 400) return
    lastActivate.current = now
    onClick()
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        activate()
      }}
      className="relative z-10 flex items-center justify-center w-[68px] h-[68px] bg-transparent hover:bg-primary/10 rounded-full transition-all duration-200 hover:scale-105 active:scale-95 -mt-6"
      aria-label="Add new"
    >
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
        <AnimatedLogo />
      </div>
      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
        <Plus className="h-5 w-5 text-primary drop-shadow-sm" />
      </div>
    </button>
  )
}


// Menu item data type for menu modals
type BottomNavMenuItem = {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  isActive?: boolean
}

/**
 * Props for fullscreen overlay menu
 */
interface BottomNavFullscreenMenuProps {
  isOpen: boolean
  onClose: () => void
  /** Unguarded — row tap / locale change, not the leftover trigger click. */
  onItemNavigate: () => void
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
  onItemNavigate,
  menuItems,
  brandTitle,
  brandSubtitle,
}: BottomNavFullscreenMenuProps) {
  const t = useTranslations('navigation')
  const { setTheme, theme, resolvedTheme } = useTheme()
  const [animateIn, setAnimateIn] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

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

  if (!isOpen) return null

  const title = brandTitle ?? getBrandName()
  const subtitle = brandSubtitle ?? t('menu.subtitle', { default: getBrandName() })

  return (
    <div
      className={cn(
        'fixed inset-x-0 top-0 z-[8990] md:hidden overflow-hidden transform-gpu',
        'bottom-[var(--mobile-bottom-nav-h,calc(3.5rem+env(safe-area-inset-bottom,0px)))]',
      )}
      style={{ transform: 'translateZ(0)' }}
      data-modal="true"
      role="dialog"
      aria-label={t('menu.title')}
    >
      <div
        className={cn(
          'absolute inset-0 bg-background transition-opacity duration-300',
          animateIn ? 'opacity-100' : 'opacity-0'
        )}
      />
      <div className="absolute inset-0 backdrop-blur-xl bg-background/80" />
      {!prefersReducedMotion && (
        <>
          <div
            className="pointer-events-none absolute -left-20 top-20 h-64 w-64 rounded-full blur-3xl bg-[color-mix(in_oklch,var(--davinci-beam)_22%,transparent)]"
          />
          <div
            className="pointer-events-none absolute -right-20 bottom-40 h-64 w-64 rounded-full blur-3xl bg-[color-mix(in_oklch,var(--davinci-beam)_14%,transparent)]"
          />
        </>
      )}

      <div className="relative h-full flex flex-col px-6 pt-8 pb-6 overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 flex size-10 items-center justify-center rounded-full border border-border bg-muted/60 text-foreground hover:bg-muted"
          aria-label={t('close', { default: 'Close' })}
        >
          <span className="text-lg leading-none" aria-hidden>
            ×
          </span>
        </button>

        <div
          className={cn(
            'mb-8 text-center transition-opacity duration-300',
            animateIn ? 'opacity-100' : 'opacity-0'
          )}
        >
          <h2 className="text-3xl font-black tracking-tight text-primary">
            {title}
          </h2>
          <p className="mt-1 text-sm font-medium text-muted-foreground">{subtitle}</p>
        </div>

        <div className="flex-1 space-y-3" role="list">
          {menuItems.length === 0 ? (
            <p className="px-2 text-center text-sm text-muted-foreground">
              {t('menu.empty')}
            </p>
          ) : (
            menuItems.map((item, index) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.id}
                  href={toAppHref(item.href)}
                  role="listitem"
                  aria-current={item.isActive ? 'page' : undefined}
                  onClick={onItemNavigate}
                  style={
                    prefersReducedMotion
                      ? undefined
                      : { transitionDelay: `${Math.min(index, 8) * 40}ms` }
                  }
                  className={cn(
                    'group flex w-full items-center gap-4 p-4 text-left',
                    davinciGlassSurface,
                    'transition-opacity duration-300',
                    animateIn ? 'opacity-100' : 'opacity-0',
                    item.isActive && 'border-primary/40 bg-primary/10',
                  )}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {item.title}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-all shrink-0" />
                </Link>
              )
            })
          )}
        </div>

        <div
          className={cn(
            'mt-auto border-t border-border pt-4 transition-opacity duration-300',
            animateIn ? 'opacity-100' : 'opacity-0'
          )}
        >
          <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2">
            <LocaleCodeMenu
              variant="icon"
              align="start"
              onLocaleChange={() => onItemNavigate()}
            />
            <NavLegalFooter
              density="comfortable"
              align="center"
              className="min-w-0 px-1"
            />
            <button
              type="button"
              onClick={() => toggleThemeWithTransition(setTheme, theme, resolvedTheme)}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/50 hover:bg-muted"
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
  const searchParams = useSearchParams()
  const search = searchParams.toString()
  const locale = useLocale() as Locale
  const { hasRole } = useAuth()
  const { data: session } = useSession()
  const t = useTranslations('navigation')
  const tAuth = useTranslations('modules.auth')
  const tOpp = useTranslations('modules.opportunities')
  const [showOpportunitySelector, setShowOpportunitySelector] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [adminMenuOpen, setAdminMenuOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const menuOpenedAt = useRef(0)
  const loginOpenedAt = useRef(0)

  const isLoggedIn = !!session?.user
  /** Authenticated subscriber+ → platform menu; unauth → Login FsModal. */
  const canOpenPlatformMenu = isLoggedIn
  const loginLabel = t.has('login') ? t('login') : t('signIn')
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
  const isActive = (href: string) => sidebarPathIsActive(pathname, href, locale)

  const menuItems: BottomNavMenuItem[] = useMemo(() => {
    const hasDocsSlot = getPrimaryNavManifest().mobile.some(
      (item) => item.kind === 'docs-or-admin',
    )
    const docsOnBar = hasDocsSlot && !(isMemberPlus && hasAdminSupermenu)
    return getResolvedPlatformMenuItems(locale, {
      excludeIds: docsOnBar ? ['docs'] : [],
    }).map((item) => ({
      id: item.id,
      title: resolveNavLabel(t, item.labelKeys),
      description: item.descriptionKeys.length
        ? resolveNavLabel(t, item.descriptionKeys)
        : '',
      icon: getPrimaryNavIcon(item.icon),
      href: item.href,
      isActive: sidebarPathIsActive(pathname, item.href, locale),
    }))
  }, [hasAdminSupermenu, isMemberPlus, locale, pathname, t])

  const closeMenus = useCallback(() => {
    setShowOpportunitySelector(false)
    setMenuOpen(false)
    setAdminMenuOpen(false)
    setLoginOpen(false)
  }, [])

  const closeRingMenu = useCallback(() => {
    if (Date.now() - menuOpenedAt.current < GHOST_CLICK_MS) return
    setMenuOpen(false)
  }, [])

  const dismissPlatformMenu = useCallback(() => {
    setMenuOpen(false)
  }, [])

  const openLoginModal = useCallback(() => {
    setShowOpportunitySelector(false)
    setAdminMenuOpen(false)
    setMenuOpen(false)
    loginOpenedAt.current = Date.now()
    setLoginOpen(true)
    window.setTimeout(() => armGhostClickGuard(), 0)
  }, [])

  const openRingMenu = useCallback(() => {
    setShowOpportunitySelector(false)
    setAdminMenuOpen(false)
    setLoginOpen(false)
    setMenuOpen((open) => {
      if (open) {
        if (Date.now() - menuOpenedAt.current < GHOST_CLICK_MS) return true
        return false
      }
      menuOpenedAt.current = Date.now()
      window.setTimeout(() => armGhostClickGuard(), 0)
      return true
    })
  }, [])

  const openAdminMenu = useCallback(() => {
    setShowOpportunitySelector(false)
    setMenuOpen(false)
    setLoginOpen(false)
    setAdminMenuOpen((v) => !v)
  }, [])

  const openAddOpportunity = useCallback(() => {
    setMenuOpen(false)
    setAdminMenuOpen(false)
    setLoginOpen(false)
    setShowOpportunitySelector(true)
  }, [])

  const closeOpportunitySelector = useCallback(() => {
    setShowOpportunitySelector(false)
  }, [])

  // Empty-state / right-rail Create Opportunity → same mobile-sheet as the '+' button
  useEffect(() => {
    return eventBus.on('opportunity:open-type-selector', () => {
      openAddOpportunity()
    })
  }, [openAddOpportunity])

  /**
   * Primary slots from getPrimaryNavManifest() — L1 community default or L2 pack overwrite.
   * docs-or-admin / overflow-menu are chrome actions; href items are links.
   */
  const navItems = useMemo(() => {
    const manifest = getPrimaryNavManifest()
    return manifest.mobile.map((item) => {
      if (item.kind === 'href') {
        const href = item.href(locale)
        return {
          id: item.id,
          icon: getPrimaryNavIcon(item.icon),
          label: resolveNavLabel(t, item.labelKeys),
          href,
          isActive: navHrefIsActive(href, pathname, search, isActive, item.activeMatch),
        }
      }
      if (item.kind === 'docs-or-admin') {
        if (isMemberPlus && hasAdminSupermenu) {
          return {
            id: item.id,
            icon: getPrimaryNavIcon(item.iconAdmin),
            label: resolveNavLabel(t, item.labelKeysAdmin),
            href: '#admin',
            isActive: adminMenuOpen,
            isButton: true as const,
            onClick: openAdminMenu,
          }
        }
        const href = item.docsHref(locale)
        return {
          id: item.id,
          icon: getPrimaryNavIcon(item.iconDocs),
          label: resolveNavLabel(t, item.labelKeysDocs),
          href,
          isActive: isActive(href),
        }
      }
      if (item.kind === 'overflow-menu') {
        return {
          id: item.id,
          icon: canOpenPlatformMenu ? getPrimaryNavIcon(item.icon) : User,
          label: canOpenPlatformMenu
            ? resolveNavLabel(t, item.labelKeys)
            : loginLabel,
          href: canOpenPlatformMenu ? '#menu' : '#login',
          isActive: canOpenPlatformMenu ? menuOpen : loginOpen,
          isButton: true as const,
          overflowTrigger: true as const,
          onClick: canOpenPlatformMenu ? openRingMenu : openLoginModal,
        }
      }
      const _exhaustive: never = item
      return _exhaustive
    })
  }, [
    adminMenuOpen,
    canOpenPlatformMenu,
    hasAdminSupermenu,
    isMemberPlus,
    locale,
    loginLabel,
    loginOpen,
    menuOpen,
    openAdminMenu,
    openLoginModal,
    openRingMenu,
    pathname,
    search,
    t,
  ])

  useEffect(() => {
    if (session?.user) setLoginOpen(false)
  }, [session?.user])

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
      <nav
        className="fixed bottom-0 left-0 right-0 z-[9000] md:hidden transform-gpu touch-manipulation"
        style={{ transform: 'translateZ(0)' }}
      >
        <div className="relative z-10 flex items-end justify-around bg-white/10 dark:bg-black/10 backdrop-blur-md border-t border-border px-2 py-1">
          {/* Render first two navigation items */}
          {navItems.slice(0, 2).map((item) => (
            <NavItem
              key={item.id}
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
              key={item.id}
              icon={item.icon}
              label={item.label}
              href={item.href}
              isActive={item.isActive}
              isButton={item.isButton}
              overflowTrigger={'overflowTrigger' in item ? item.overflowTrigger : undefined}
              onClick={item.isButton ? item.onClick : closeMenus}
            />
          ))}
        </div>
        {/* Push up for safe-area-inset (iOS bottom bar and alike) */}
        <div className="h-safe-area-inset-bottom bg-background/95" />
      </nav>

      {/* Opportunity type picker — FsModal (same chrome as unauth login) */}
      <FsModal
        open={showOpportunitySelector}
        onOpenChange={(open) => {
          if (!open) closeOpportunitySelector()
        }}
        title={tOpp('type_selector.title')}
        description={tOpp('type_selector.subtitle')}
      >
        <OpportunityTypeSelectorClient
          layout="embedded"
          onClose={closeOpportunitySelector}
          userRole={
            hasRole(UserRolesArray.member) ? 'member' : 'subscriber'
          }
          locale={locale}
        />
      </FsModal>

      {/* Ring (three-dots) platform-only fullscreen menu */}
      <BottomNavFullscreenMenu
        isOpen={menuOpen && canOpenPlatformMenu}
        onClose={closeRingMenu}
        onItemNavigate={dismissPlatformMenu}
        menuItems={menuItems}
        brandSubtitle={t('menu.subtitle', { default: getBrandName() })}
      />

      <FsModal
        open={loginOpen && !isLoggedIn}
        onOpenChange={(open) => {
          if (!open && Date.now() - loginOpenedAt.current < GHOST_CLICK_MS) return
          setLoginOpen(open)
        }}
        title={loginLabel}
        description={tAuth('signIn.subtitle')}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => {
          if (Date.now() - loginOpenedAt.current < GHOST_CLICK_MS) {
            event.preventDefault()
          }
        }}
        onInteractOutside={(event) => {
          if (Date.now() - loginOpenedAt.current < GHOST_CLICK_MS) {
            event.preventDefault()
          }
        }}
      >
        <LoginWidget
          locale={locale}
          from={search ? `${pathname}?${search}` : pathname}
          onAuthAction={() => setLoginOpen(false)}
        />
      </FsModal>

      {/* Admin supermenu mobile panel */}
      <AdminSupermenuMobile
        open={adminMenuOpen}
        onClose={() => setAdminMenuOpen(false)}
      />
    </>
  )
}
