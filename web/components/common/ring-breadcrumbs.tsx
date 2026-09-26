'use client'

import { Link, toAppHref } from '@/i18n/routing'
import { cn } from '@/lib/utils'

export type RingBreadcrumbItem = {
  label: string
  href?: string
}

type RingBreadcrumbsProps = {
  items: RingBreadcrumbItem[]
  className?: string
  'aria-label'?: string
}

/**
 * Shared breadcrumb trail — docs-style slash separators, i18n Link.
 */
export function RingBreadcrumbs({
  items,
  className,
  'aria-label': ariaLabel = 'Breadcrumb',
}: RingBreadcrumbsProps) {
  if (!items.length) return null

  return (
    <nav aria-label={ariaLabel} className={cn('min-w-0', className)}>
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 ? (
                <span className="text-muted-foreground/60" aria-hidden>
                  /
                </span>
              ) : null}
              {item.href && !isLast ? (
                // Callers pass ROUTES.* (already locale-prefixed via withLocale);
                // toAppHref strips that prefix so next-intl Link prefixes the
                // active locale exactly once (fixes /uk/uk, /de/de double-locale).
                <Link href={toAppHref(item.href)} className="truncate hover:text-foreground">
                  {item.label}
                </Link>
              ) : (
                <span
                  className="truncate font-medium text-foreground"
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
