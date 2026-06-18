'use client'

import { Link, toAppHref } from '@/i18n/routing'
import { usePathname } from '@/i18n/routing'
import { routing } from '@/i18n/routing'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { LucideIcon } from 'lucide-react'

export interface ModuleSectionNavItem {
  id: string
  label: string
  href?: string
  onClick?: () => void
  icon: LucideIcon
  variant?: 'default' | 'outline' | 'ghost'
  match?: 'exact' | 'prefix'
}

interface ModuleSectionNavProps {
  title: string
  items: ModuleSectionNavItem[]
  className?: string
}

function stripLocalePrefix(path: string) {
  for (const locale of routing.locales) {
    const prefix = `/${locale}`
    if (path === prefix) return '/'
    if (path.startsWith(`${prefix}/`)) {
      return path.slice(prefix.length) || '/'
    }
  }
  return path
}

function isActive(pathname: string, href: string, match: ModuleSectionNavItem['match'] = 'exact') {
  const current = stripLocalePrefix(pathname)
  const target = stripLocalePrefix(href)
  if (match === 'prefix') {
    return current === target || current.startsWith(`${target}/`)
  }
  return current === target
}

/**
 * Horizontal top menu for module sections (browse / my / create).
 * Replaces legacy left Card nav + duplicate page headers on mobile.
 */
export default function ModuleSectionNav({ title, items, className }: ModuleSectionNavProps) {
  const pathname = usePathname()

  return (
    <div className={cn('border-b border-border/40', className)}>
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h1>
        <nav
          className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-0.5"
          aria-label={title}
        >
          {items.map((item) => {
            const Icon = item.icon
            const active = item.href
              ? isActive(pathname, item.href, item.match)
              : false
            const variant = item.variant ?? (active ? 'default' : 'ghost')

            if (item.onClick) {
              return (
                <Button
                  key={item.id}
                  type="button"
                  variant={variant}
                  size="sm"
                  onClick={item.onClick}
                  className="shrink-0 gap-1.5"
                >
                  <Icon className="h-4 w-4" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </Button>
              )
            }

            if (!item.href) return null

            return (
              <Button
                key={item.id}
                asChild
                variant={variant}
                size="sm"
                className={cn(
                  'shrink-0 gap-1.5',
                  active && variant === 'ghost' && 'bg-muted text-foreground',
                )}
              >
                <Link href={toAppHref(item.href)}>
                  <Icon className="h-4 w-4" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </Link>
              </Button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
