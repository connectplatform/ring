'use client'

import React, { useCallback } from 'react'
import { Link, toAppHref } from '@/i18n/routing'
import { usePathname, useRouter, replaceLocalePath } from '@/i18n/routing'
import { useLocale, useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import {
  Home,
  Users,
  Briefcase,
  Store,
  FileText,
  Shield,
  Moon,
  Sun,
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import {
  localeDisplayLabel,
  localeNativeTitle,
  nextLocaleInRoutingOrder,
  persistRingLocalePreference,
} from '@/lib/locale-pref'
import { useCurrency } from '@/features/store/currency-context'
const railLinkClass =
  'sidebar-rail-link group relative flex justify-center items-center rounded-lg size-10 text-white hover:not-data-current:bg-white/10 data-current:bg-[#333333] data-current:inset-ring-1 data-current:inset-ring-white/3 data-current:bg-radial-[at_0%_0%] data-current:from-white/10 data-current:to-transparent'

function RailLink({
  href,
  label,
  icon,
  active,
}: {
  href: string
  label: string
  icon: React.ReactNode
  active: boolean
}) {
  return (
    <li>
      <Link
        href={toAppHref(href)}
        title={label}
        aria-current={active ? 'page' : undefined}
        data-current={active ? '' : undefined}
        className={railLinkClass}
      >
        {icon}
        <span
          aria-hidden
          className="absolute inset-0 rounded-[inherit] bg-linear-to-br from-white/15 to-transparent to-35% pointer-events-none mask-clip-padding-only p-px hidden group-data-current:block"
        />
      </Link>
    </li>
  )
}

interface SidebarRailProps {
  onOpenAside?: () => void
  overlayMode?: boolean
  /** When true, rail is inside the shared dark column (no outer chrome). */
  embedded?: boolean
}

export function SidebarRail({ onOpenAside, overlayMode, embedded }: SidebarRailProps) {
  const pathname = usePathname()
  const router = useRouter()
  const locale = useLocale() as Locale
  const { data: session } = useSession()
  const { setTheme, theme, systemTheme } = useTheme()
  const { currency, toggleCurrency } = useCurrency()
  const nextLocale = nextLocaleInRoutingOrder(locale)
  const tEntities = useTranslations('modules.entities')
  const tOpp = useTranslations('modules.opportunities')
  const tStore = useTranslations('modules.store')
  const tNav = useTranslations('navigation')

  const currentTheme = theme === 'system' ? systemTheme : theme

  const switchLocale = useCallback(() => {
    persistRingLocalePreference(nextLocale)
    replaceLocalePath(router, pathname, nextLocale)
  }, [nextLocale, pathname, router])

  const isActive = (href: string) => {
    if (href === ROUTES.HOME(locale)) return pathname === ROUTES.HOME(locale)
    return pathname.startsWith(href)
  }

  const primaryItems = [
    { href: ROUTES.HOME(locale), label: tNav('mainNav.home'), icon: <Home className="size-[18px]" strokeWidth={1.5} /> },
    { href: ROUTES.ENTITIES(locale), label: tEntities('title'), icon: <Users className="size-[18px]" strokeWidth={1.5} /> },
    { href: ROUTES.OPPORTUNITIES(locale), label: tOpp('opportunities'), icon: <Briefcase className="size-[18px]" strokeWidth={1.5} /> },
    { href: ROUTES.STORE(locale), label: tStore('title'), icon: <Store className="size-[18px]" strokeWidth={1.5} /> },
    { href: ROUTES.DOCS(locale), label: tNav('sidebar.documentation'), icon: <FileText className="size-[18px]" strokeWidth={1.5} /> },
  ]

  return (
    <div
      data-main-nav
      className={cn(
        'isolate relative z-2 flex min-h-0 w-full flex-1 flex-col p-3',
        !embedded &&
          'h-full w-16 shrink-0 rounded-none rounded-r-[12px] bg-[#090909] shadow-[0px_259px_103px_rgba(0,0,0,0.03),0px_146px_87px_rgba(0,0,0,0.09),0px_65px_65px_rgba(0,0,0,0.15),0px_16px_36px_rgba(0,0,0,0.17)]',
      )}
    >
      <nav className="flex-1 pt-1">
        <ul className="flex flex-col gap-0">
          {primaryItems.map((item) => (
            <RailLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={isActive(item.href)}
            />
          ))}
          {session?.user && (session.user.role === 'admin' || session.user.role === 'superadmin') && (
            <RailLink
              href={ROUTES.ADMIN(locale)}
              label={tNav('sidebar.admin')}
              icon={<Shield className="size-[18px]" strokeWidth={1.5} />}
              active={isActive(ROUTES.ADMIN(locale))}
            />
          )}
        </ul>
      </nav>

      <div className="mt-auto flex flex-col items-center gap-1.5 pt-2">
        {overlayMode && onOpenAside && (
          <button
            type="button"
            onClick={onOpenAside}
            className={cn(railLinkClass, 'border-0 bg-transparent cursor-pointer')}
            title="Open navigation panel"
            aria-label="Open navigation panel"
          >
            <FileText className="size-[18px]" strokeWidth={1.5} />
          </button>
        )}
        <button
          type="button"
          onClick={switchLocale}
          className={cn(railLinkClass, 'border-0 bg-transparent cursor-pointer text-xs font-semibold uppercase')}
          title={`Switch to ${localeNativeTitle(nextLocale)}`}
          aria-label={`Switch to ${localeNativeTitle(nextLocale)}`}
        >
          {localeDisplayLabel(locale)}
        </button>
        {toggleCurrency && (
          <button
            type="button"
            onClick={toggleCurrency}
            className={cn(railLinkClass, 'border-0 bg-transparent cursor-pointer text-xs font-semibold')}
            title={currency === 'UAH' ? 'Switch to RING' : 'Switch to UAH'}
            aria-label={currency === 'UAH' ? 'Switch to RING' : 'Switch to UAH'}
          >
            {currency === 'UAH' ? '₴' : 'Ⓡ'}
          </button>
        )}
        <button
          type="button"
          onClick={() => setTheme(currentTheme === 'dark' ? 'light' : 'dark')}
          className={cn(railLinkClass, 'border-0 bg-transparent cursor-pointer')}
          title={currentTheme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          {currentTheme === 'dark' ? (
            <Moon className="size-[18px]" strokeWidth={1.5} />
          ) : (
            <Sun className="size-[18px]" strokeWidth={1.5} />
          )}
        </button>
      </div>
    </div>
  )
}
