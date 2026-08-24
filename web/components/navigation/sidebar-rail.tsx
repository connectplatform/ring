'use client'

import React, { useEffect, useState } from 'react'
import { Link, toAppHref, usePathname } from '@/i18n/routing'
import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { toggleThemeWithTransition } from '@/lib/theme/ring-theme-transition'
import {
  Moon,
  Sun,
  FileText,
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import { hasMemberPrivileges } from '@/features/auth/user-role'
import { cn } from '@/lib/utils'
import type { Locale } from '@/i18n/shared'
import { LocaleCodeMenu } from '@/components/common/locale-code-menu'
import { useStorePaymentMethods } from '@/features/store/currency-context'
import { resolveDesktopPrimaryNav } from '@/lib/navigation/desktop-primary-nav'
import { getPrimaryNavIcon } from '@/lib/navigation/primary-nav-icons'
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
  const locale = useLocale() as Locale
  const { data: session } = useSession()
  const { setTheme, theme, resolvedTheme } = useTheme()
  const { currency, toggleCurrency, nativeTokenCurrency, mainCurrency } = useStorePaymentMethods()
  const tNav = useTranslations('navigation')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const searchParams = useSearchParams()
  const search = searchParams.toString()

  const primaryItems = resolveDesktopPrimaryNav(locale, tNav, pathname, search).map((item) => {
    const Icon = getPrimaryNavIcon(item.icon)
    return {
      href: item.href,
      label: item.label,
      icon: <Icon className="size-[22px]" strokeWidth={1.5} />,
      active: item.active,
    }
  })

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
              active={item.active}
            />
          ))}
          {showAdminToggle && (
            <li>
              <AdminSupermenuToggle compact />
            </li>
          )}
        </ul>
      </nav>

      <div className="relative z-10 mt-auto flex flex-col items-center gap-1.5 pt-2">
        {overlayMode && onOpenAside && (
          <button
            type="button"
            onClick={onOpenAside}
            className={cn(railLinkClass, 'border-0 bg-transparent cursor-pointer')}
            title="Open navigation panel"
            aria-label="Open navigation panel"
          >
            <FileText className="size-[22px]" strokeWidth={1.5} />
          </button>
        )}
        <LocaleCodeMenu variant="rail" />
        {toggleCurrency && (
          <button
            type="button"
            onClick={toggleCurrency}
            className={cn(railLinkClass, 'border-0 bg-transparent cursor-pointer text-xs font-semibold')}
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
            <Sun className="size-[22px]" strokeWidth={1.5} />
          ) : resolvedTheme === 'dark' ? (
            <Moon className="size-[22px]" strokeWidth={1.5} />
          ) : (
            <Sun className="size-[22px]" strokeWidth={1.5} />
          )}
        </button>
      </div>
    </div>
  )
}
