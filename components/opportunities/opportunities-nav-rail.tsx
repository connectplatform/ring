'use client'

import { Link, toAppHref, usePathname } from '@/i18n/routing'
import { routing } from '@/i18n/routing'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import {
  canAccessOpportunityCreation,
  parseUserRole,
  UserRole,
} from '@/features/auth/user-role'
import { Briefcase, Plus, Search, User } from 'lucide-react'

interface OpportunitiesNavRailProps {
  locale: Locale
  onNavigate?: () => void
}

function stripLocalePrefix(path: string) {
  for (const loc of routing.locales) {
    const prefix = `/${loc}`
    if (path === prefix) return '/'
    if (path.startsWith(`${prefix}/`)) {
      return path.slice(prefix.length) || '/'
    }
  }
  return path
}

export default function OpportunitiesNavRail({ locale, onNavigate }: OpportunitiesNavRailProps) {
  const pathname = usePathname()
  const t = useTranslations('modules.opportunities')
  const { data: session } = useSession()

  const current = stripLocalePrefix(pathname)
  const isBrowse = current === '/opportunities'
  const isMy = current === '/opportunities/my' || current.startsWith('/opportunities/my/')
  const isAdd = current === '/opportunities/add' || current.startsWith('/opportunities/add/')

  const userRole = parseUserRole(session?.user?.role) ?? UserRole.visitor
  const canCreate = canAccessOpportunityCreation(userRole)
  const createHref = canCreate
    ? ROUTES.ADD_OPPORTUNITY(locale)
    : `${ROUTES.MEMBERSHIP(locale)}?returnTo=${encodeURIComponent(ROUTES.ADD_OPPORTUNITY(locale))}`

  const navItems = session?.user
    ? [
        {
          id: 'browse',
          label: t('browseOpportunities'),
          href: ROUTES.OPPORTUNITIES(locale),
          icon: Search,
          active: isBrowse,
        },
        {
          id: 'my',
          label: t('myOpportunities'),
          href: ROUTES.MY_OPPORTUNITIES(locale),
          icon: User,
          active: isMy,
        },
        {
          id: 'create',
          label: t('createOpportunity'),
          href: createHref,
          icon: Plus,
          active: isAdd,
          variant: 'outline' as const,
        },
      ]
    : []

  if (navItems.length === 0) return null

  return (
    <section aria-labelledby="opportunities-nav-rail" className="space-y-3">
      <h2
        id="opportunities-nav-rail"
        className="flex items-center gap-2 text-lg font-semibold"
      >
        <Briefcase className="h-5 w-5 shrink-0 text-[var(--davinci-beam)]" />
        {t('opportunities')}
      </h2>
      <div className="space-y-1">
        {navItems.map((item) => (
          <Button
            key={item.id}
            variant={item.active ? 'default' : item.variant ?? 'ghost'}
            className="h-9 w-full justify-start rounded-xl"
            asChild
          >
            <Link href={toAppHref(item.href)} onClick={() => onNavigate?.()}>
              <item.icon className="mr-2 h-4 w-4" />
              {item.label}
            </Link>
          </Button>
        ))}
      </div>
      <Separator />
    </section>
  )
}
