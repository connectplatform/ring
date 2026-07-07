// TODO: Locate where this component is used in the app 
// and ssot logic for right-rail if needed.

'use client'

// Import routing helpers and hooks for i18n-aware navigation
import { Link, toAppHref, usePathname } from '@/i18n/routing'
import { routing } from '@/i18n/routing'
// Universal translations hook for i18n
import { useTranslations } from 'next-intl'
// Session hook for auth state
import { useSession } from 'next-auth/react'
// UI primitives
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import {
  canAccessOpportunityCreation,
  parseUserRolesArray,
  resolveSessionUserRole,
  UserRolesArray,
} from '@/features/auth/user-role'
import { Briefcase, Plus, Search, User } from 'lucide-react'

interface OpportunitiesNavRailProps {
  locale: Locale
  onNavigate?: () => void
}

// Remove locale prefix (e.g. "/en/foo" -> "/foo" or "/" for just "/en")
// TODO: Replace with Next.js 14+ Route Groups for i18n when available, remove manual locale strip
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
  // Get current pathname (i18n-aware)
  const pathname = usePathname()
  // Translate keys under modules.opportunities namespace
  const t = useTranslations('modules.opportunities')
  // Get user session state (authenticated user info)
  const { data: session } = useSession()

  // Locale-stripped path for active route comparison
  const current = stripLocalePrefix(pathname)

  // Boolean assignment for which sub-nav is "active"
  const isBrowse = current === '/opportunities'
  const isMy = current === '/opportunities/my' || current.startsWith('/opportunities/my/')
  const isAdd = current === '/opportunities/add' || current.startsWith('/opportunities/add/')

  // Resolve user role; checks for modern user role arrays, then fallback, else default visitor
  const userRole =
    parseUserRolesArray(session?.user?.role) ??
    resolveSessionUserRole(session?.user?.role) ??
    UserRolesArray.visitor

  // Permission logic: user must be allowed by role to create opportunity
  const canCreate = canAccessOpportunityCreation(userRole)

  // Pick create-opportunity href depending on permission; otherwise, send to membership/upgrade flow with returnTo
  const createHref = canCreate
    ? ROUTES.ADD_OPPORTUNITY(locale)
    : `${ROUTES.MEMBERSHIP(locale)}?returnTo=${encodeURIComponent(ROUTES.ADD_OPPORTUNITY(locale))}`

  // Construct navigation items only if user is authenticated (nav is invisible for visitors)
  // TODO: Consider using React 19 useOptimistic/useActionState for optimistic nav feedback, or Next 14/16 fetchers for nav data consistency
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
          // Use outline variant for "Create" nav item if it's not primary
          variant: 'outline' as const,
        },
      ]
    : []

  // Render nothing if there are no navigation items (i.e., session missing)
  if (navItems.length === 0) return null

  // Render the opportunities navigation rail
  return (
    <section
      aria-labelledby="opportunities-nav-rail"
      className="space-y-3">
      {/* Section title with icon and i18n label */}
      <h2
        id="opportunities-nav-rail"
        className="flex items-center gap-2 text-lg font-semibold"
      >
        <Briefcase className="h-5 w-5 shrink-0 text-[var(--davinci-beam)]" />
        {t('opportunities')}
      </h2>
      <div className="space-y-1">
        {/* Navigation buttons map, keyed by nav item id */}
        {navItems.map((item) => (
          <Button
            key={item.id}
            variant={item.active ? 'default' : item.variant ?? 'ghost'}
            className="h-9 w-full justify-start rounded-xl"
            asChild // Use native element via polymorphism
          >
            <Link
              href={toAppHref(item.href)}
              onClick={() => onNavigate?.()} // Call parent callback on nav
            >
              {/* Render icon per nav item */}
              <item.icon className="mr-2 h-4 w-4" />
              {item.label}
            </Link>
          </Button>
        ))}
      </div>
      {/* Divider for visual separation */}
      <Separator />
    </section>
  )
}
