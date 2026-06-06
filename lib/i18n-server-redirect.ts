import type { ComponentProps } from 'react'
import { Link, redirect } from '@/i18n/routing'
import type { Locale } from '@/i18n/routing'

/** Same pathname contract as `Link` — respects `pathnames: sharedPathnames`. */
export type LocalizedRedirectHref = ComponentProps<typeof Link>['href']

/**
 * Server-side redirect through next-intl (`createNavigation` `redirect`).
 * Prefer this over string-building `/${locale}/…` URLs.
 *
 * - No query: native `redirect({ href, locale })` (full `Href` typing).
 * - With query: canonical `redirect({ href: { pathname, query }, locale })` per next-intl.
 *
 * Keep `next/navigation` `redirect` for `/api/*` and absolute external URLs.
 */
export function localizedRedirect(args: {
  locale: Locale
  href: LocalizedRedirectHref
  query?: Record<string, string | undefined>
}): never {
  const { locale, href } = args
  const query =
    args.query &&
    (Object.fromEntries(
      Object.entries(args.query).filter(([, v]) => v !== undefined),
    ) as Record<string, string>)

  if (query && Object.keys(query).length > 0) {
    return redirect({
      href: {
        pathname: href as any,
        query,
      },
      locale,
    } as Parameters<typeof redirect>[0])
  }

  return redirect({ href, locale } as Parameters<typeof redirect>[0])
}
