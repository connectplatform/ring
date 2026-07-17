'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Link, toAppHref } from '@/i18n/routing'
import { usePathname, useRouter, replaceLocalePath } from '@/i18n/routing'
import { useLocale, useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { toggleThemeWithTransition } from '@/lib/theme/ring-theme-transition'
import {
  Users,
  Briefcase,
  Store,
  FileText,
  Moon,
  Sun,
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import { hasMemberPrivileges } from '@/features/auth/user-role'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import {
  localeDisplayLabel,
  localeNativeTitle,
  nextLocaleInRoutingOrder,
  persistRingLocalePreference,
} from '@/lib/locale-pref'
import { useStoreCurrency } from '@/features/store/currency-context'
import { AdminSupermenuToggle } from './admin-supermenu'
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
  const { setTheme, theme, resolvedTheme } = useTheme()
  const { currency, toggleCurrency, nativeTokenCurrency, defaultCurrency } = useStoreCurrency()
  const nextLocale = nextLocaleInRoutingOrder(locale)
  const tEntities = useTranslations('modules.entities')
  const tOpp = useTranslations('modules.opportunities')
  const tStore = useTranslations('modules.store')
  const tNav = useTranslations('navigation')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])


  const switchLocale = useCallback(() => {
    persistRingLocalePreference(nextLocale)
    replaceLocalePath(router, pathname, nextLocale)
  }, [nextLocale, pathname, router])

  const isActive = (href: string) => {
    if (href === ROUTES.HOME(locale)) return pathname === ROUTES.HOME(locale)
    if (href === ROUTES.DOCS(locale)) {
      return pathname === href || pathname === `${href}/`
    }
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const primaryItems = [
    { href: ROUTES.ENTITIES(locale), label: tEntities('title'), icon: <Users className="size-[18px]" strokeWidth={1.5} /> },
    { href: ROUTES.OPPORTUNITIES(locale), label: tOpp('opportunities'), icon: <Briefcase className="size-[18px]" strokeWidth={1.5} /> },
    { href: ROUTES.STORE(locale), label: tStore('title'), icon: <Store className="size-[18px]" strokeWidth={1.5} /> },
    { href: ROUTES.DOCS(locale), label: tNav('sidebar.documentation'), icon: <FileText className="size-[18px]" strokeWidth={1.5} /> },
  ]

  const showAdminToggle = hasMemberPrivileges(session?.user?.role)

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
          {showAdminToggle && (
            <li>
              <AdminSupermenuToggle compact />
            </li>
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
            title={
              currency === nativeTokenCurrency
                ? `Switch to ${defaultCurrency}`
                : `Switch to ${nativeTokenCurrency}`
            }
            aria-label={
              currency === nativeTokenCurrency
                ? `Switch to ${defaultCurrency}`
                : `Switch to ${nativeTokenCurrency}`
            }
          >
            {currency === nativeTokenCurrency ? 'Ⓡ' : currency === 'UAH' ? '₴' : currency === 'USD' ? '$' : currency}
          </button>
        )}
        <button
          type="button"
          onClick={() => toggleThemeWithTransition(setTheme, theme, resolvedTheme)}
          className={cn(railLinkClass, 'border-0 bg-transparent cursor-pointer')}
          title={mounted ? (resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode') : 'Toggle theme'}
          aria-label="Toggle theme"
          suppressHydrationWarning
        >
          {!mounted ? (
            <Sun className="size-[18px]" strokeWidth={1.5} />
          ) : resolvedTheme === 'dark' ? (
            <Moon className="size-[18px]" strokeWidth={1.5} />
          ) : (
            <Sun className="size-[18px]" strokeWidth={1.5} />
          )}
        </button>
      </div>
    </div>
  )
}
