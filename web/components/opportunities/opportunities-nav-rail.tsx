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
import {
  canAccessOpportunityCreation,
  hasMemberPrivileges,
  parseUserRolesArray,
  resolveSessionUserRole,
  UserRolesArray,
} from '@/features/auth/user-role'
import { Briefcase, Plus, Search, User } from 'lucide-react'
import { useState } from 'react'
import { OpportunityTypeSelectorClient } from '@/components/opportunities/opportunity-type-selector-client'
import { requestOpportunityTypeSelector } from '@/lib/opportunities/request-opportunity-type-selector'

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
  const [createOverlayOpen, setCreateOverlayOpen] = useState(false)

  const current = stripLocalePrefix(pathname)

  const isBrowse = current === '/opportunities'
  const isMy = current === '/opportunities/my' || current.startsWith('/opportunities/my/')
  const isAdd = current === '/opportunities/add' || current.startsWith('/opportunities/add/')

  const userRole =
    parseUserRolesArray(session?.user?.role) ??
    resolveSessionUserRole(session?.user?.role) ??
    UserRolesArray.visitor

  const canCreate = canAccessOpportunityCreation(userRole)

  const membershipHref = `${ROUTES.MEMBERSHIP(locale)}?returnTo=${encodeURIComponent(ROUTES.ADD_OPPORTUNITY(locale))}`

  if (!session?.user) return null

  const selectorRole = hasMemberPrivileges(userRole) ? 'member' : 'subscriber'

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
        <Button
          variant={isBrowse ? 'default' : 'ghost'}
          className="h-9 w-full justify-start rounded-xl"
          asChild
        >
          <Link href={toAppHref(ROUTES.OPPORTUNITIES(locale))} onClick={() => onNavigate?.()}>
            <Search className="mr-2 h-4 w-4" />
            {t('browseOpportunities')}
          </Link>
        </Button>

        <Button
          variant={isMy ? 'default' : 'ghost'}
          className="h-9 w-full justify-start rounded-xl"
          asChild
        >
          <Link href={toAppHref(ROUTES.MY_OPPORTUNITIES(locale))} onClick={() => onNavigate?.()}>
            <User className="mr-2 h-4 w-4" />
            {t('myOpportunities')}
          </Link>
        </Button>

        {canCreate ? (
          <Button
            type="button"
            variant={isAdd || createOverlayOpen ? 'default' : 'outline'}
            className="h-9 w-full justify-start rounded-xl"
            onClick={() => {
              // Mobile: open shared bottom-nav sheet, then close sidebar (sheet lives outside rail).
              // Desktop: keep overlay mounted in this rail (do not navigate-away).
              if (requestOpportunityTypeSelector()) {
                onNavigate?.()
                return
              }
              setCreateOverlayOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('createOpportunity')}
          </Button>
        ) : (
          <Button
            variant="outline"
            className="h-9 w-full justify-start rounded-xl"
            asChild
          >
            <Link href={toAppHref(membershipHref)} onClick={() => onNavigate?.()}>
              <Plus className="mr-2 h-4 w-4" />
              {t('createOpportunity')}
            </Link>
          </Button>
        )}
      </div>
      <Separator />

      {createOverlayOpen && (
        <OpportunityTypeSelectorClient
          layout="overlay"
          userRole={selectorRole}
          locale={locale}
          onClose={() => setCreateOverlayOpen(false)}
        />
      )}
    </section>
  )
}
