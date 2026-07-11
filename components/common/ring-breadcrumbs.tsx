'use client'

import { Link } from '@/i18n/routing'
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
                <Link href={item.href as never} className="truncate hover:text-foreground">
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
