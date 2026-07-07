// TODO: Locate where this component is used in the app 
// and ssot logic for right-rail if needed.

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
import { parseUserRolesArray, resolveSessionUserRole } from '@/features/auth/user-role'
import { Building2, Plus, Search, User } from 'lucide-react'

interface EntitiesNavRailProps {
  locale: Locale
  onNavigate?: () => void
}

// Removes the locale prefix from a given pathname, e.g., `/en/entities` -> `/entities`
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

// TODO: Consider switching to React.useMemo for nav item computations for minor performance boost if props become reactive
// TODO: Leverage useOptimistic (React 19) for potentially optimistic navigation UI if needed in future (currently not necessary)
// TODO: Consider server/server components for session and translation retrieval if page structure allows, reducing hydration costs in Next.js 16

export default function EntitiesNavRail({ locale, onNavigate }: EntitiesNavRailProps) {
  // React hook to get the current pathname
  const pathname = usePathname()
  // Internationalization hook for translations in the 'modules.entities' namespace
  const t = useTranslations('modules.entities')
  // Retrieve current session data (user info)
  const { data: session } = useSession()

  // Compute route without locale prefix for section highlighting
  const current = stripLocalePrefix(pathname)
  // Determine which navigation item is active based on current route
  const isBrowse = current === '/entities'
  const isMy = current === '/entities/my' || current.startsWith('/entities/my/')
  const isAdd = current === '/entities/add' || current.startsWith('/entities/add/')

  // Resolve user role using helpers, favor array parsing otherwise fallback
  const userRole = parseUserRolesArray(session?.user?.role)
    ?? resolveSessionUserRole(session?.user?.role)
  // Permission logic: only allow create if user role permits
  const canCreate = userRole ? canCreateEntity(userRole) : false
  // Compute correct create link depending on permissions
  const createHref = canCreate
    ? ROUTES.ADD_ENTITY(locale)
    : `${ROUTES.MEMBERSHIP(locale)}?returnTo=${encodeURIComponent(ROUTES.ADD_ENTITY(locale))}`

  // Build navigation items array conditionally, only if user is logged in (session exists)
  const navItems = session?.user
    ? [
        {
          id: 'browse',
          label: t('browseEntities'), // Text label from i18n
          href: ROUTES.ENTITIES(locale), // Link target
          icon: Search, // Lucide icon component
          active: isBrowse, // Highlight if current route matches
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
          variant: 'outline' as const, // Specific button variant for "create"
        },
      ]
    : []

  // Guard: If there are no items to show (user not logged in), render nothing
  if (navItems.length === 0) return null

  // Render navigation rail
  return (
    <section aria-labelledby="entities-nav-rail" className="space-y-3">
      {/* Section title with icon */}
      <h2
        id="entities-nav-rail"
        className="flex items-center gap-2 text-lg font-semibold"
      >
        {/* Building2 icon provides context for the nav rail */}
        <Building2 className="h-5 w-5 shrink-0 text-[var(--davinci-beam)]" />
        {t('title')}
      </h2>
      <div className="space-y-1">
        {/* Render a button per nav item.
          - "asChild" prop lets Link be rendered inside the Button keeping styling
          - Button highlights (variant="default") if the nav item is active
        */}
        {navItems.map((item) => (
          <Button
            key={item.id}
            variant={item.active ? 'default' : item.variant ?? 'ghost'}
            className="h-9 w-full justify-start rounded-xl"
            asChild
          >
            <Link href={toAppHref(item.href)} onClick={() => onNavigate?.()}>
              {/* Icon for nav item */}
              <item.icon className="mr-2 h-4 w-4" />
              {/* Nav item label */}
              {item.label}
            </Link>
          </Button>
        ))}
      </div>
      {/* Section separator */}
      <Separator />
    </section>
  )
}
