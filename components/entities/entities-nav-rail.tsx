'use client'

import { Link, toAppHref, usePathname } from '@/i18n/routing'
import { routing } from '@/i18n/routing'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import { canCreateEntity } from '@/features/entities/lib/entity-permissions'
import { parseUserRole } from '@/features/auth/user-role'
import { Building2, Plus, Search, User } from 'lucide-react'

interface EntitiesNavRailProps {
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

export default function EntitiesNavRail({ locale, onNavigate }: EntitiesNavRailProps) {
  const pathname = usePathname()
  const t = useTranslations('modules.entities')
  const { data: session } = useSession()

  const current = stripLocalePrefix(pathname)
  const isBrowse = current === '/entities'
  const isMy = current === '/entities/my' || current.startsWith('/entities/my/')
  const isAdd = current === '/entities/add' || current.startsWith('/entities/add/')

  const userRole = parseUserRole(session?.user?.role)
  const canCreate = userRole ? canCreateEntity(userRole) : false
  const createHref = canCreate
    ? ROUTES.ADD_ENTITY(locale)
    : `${ROUTES.MEMBERSHIP(locale)}?returnTo=${encodeURIComponent(ROUTES.ADD_ENTITY(locale))}`

  const navItems = session?.user
    ? [
        {
          id: 'browse',
          label: t('browseEntities'),
          href: ROUTES.ENTITIES(locale),
          icon: Search,
          active: isBrowse,
        },
        {
          id: 'my',
          label: t('myEntities'),
          href: ROUTES.MY_ENTITIES(locale),
          icon: User,
          active: isMy,
        },
        {
          id: 'create',
          label: t('addMyEntity'),
          href: createHref,
          icon: Plus,
          active: isAdd,
          variant: 'outline' as const,
        },
      ]
    : []

  if (navItems.length === 0) return null

  return (
    <section aria-labelledby="entities-nav-rail" className="space-y-3">
      <h2
        id="entities-nav-rail"
        className="flex items-center gap-2 text-lg font-semibold"
      >
        <Building2 className="h-5 w-5 shrink-0 text-[var(--davinci-beam)]" />
        {t('title')}
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
