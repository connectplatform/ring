'use client'

import React, { useEffect, useRef } from 'react'
import { Link, toAppHref, usePathname } from '@/i18n/routing'
import { useLocale, useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { CircleEllipsis, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useVendorStatus } from '@/hooks/use-vendor-status'
import { useAdminSupermenu } from '@/features/admin/use-admin-supermenu'
import {
  useOptionalAdminSupermenuState,
} from '@/components/navigation/admin-supermenu-context'
import type { Locale } from '@/i18n/shared'
import type { SupermenuEntry, SupermenuGroup, SupermenuLeaf } from '@/features/admin/use-admin-supermenu'

function leafIsActive(leaf: SupermenuLeaf, pathWithQuery: string): boolean {
  if (leaf.isActive) return leaf.isActive(pathWithQuery)
  const target = (leaf.href.split('?')[0] ?? leaf.href).replace(/\/$/, '') || '/'
  const current = (pathWithQuery.split('?')[0] ?? pathWithQuery).replace(/\/$/, '') || '/'
  return current === target
}

function LeafLink({
  leaf,
  pathWithQuery,
  onNavigate,
}: {
  leaf: SupermenuLeaf
  pathWithQuery: string
  onNavigate: () => void
}) {
  const active = leafIsActive(leaf, pathWithQuery)
  const Icon = leaf.icon
  return (
    <Link
      href={toAppHref(leaf.href)}
      onClick={onNavigate}
      data-current={active ? '' : undefined}
      className={cn(
        'sidebar-nav-item flex h-7 min-h-7 max-h-8 items-center gap-1.5 rounded-md px-2 text-[12px] leading-tight transition-colors',
        'hover:bg-foreground/5 data-current:bg-foreground/8',
        active && 'font-semibold text-primary',
      )}
    >
      <Icon className="size-3.5 shrink-0 opacity-75" strokeWidth={1.5} />
      <span className="truncate">{leaf.label}</span>
    </Link>
  )
}

function GroupColumn({
  group,
  pathWithQuery,
  onNavigate,
}: {
  group: SupermenuGroup
  pathWithQuery: string
  onNavigate: () => void
}) {
  return (
    <section className="min-w-0">
      <h3 className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {group.title}
      </h3>
      <div className="space-y-0.5">
        {group.entries.map((entry: SupermenuEntry) => {
          if (entry.kind === 'heading') {
            return (
              <div
                key={entry.id}
                className="mt-2 px-2 pt-1 text-[10px] font-medium tracking-wide text-muted-foreground/90 first:mt-0"
              >
                {entry.label}
              </div>
            )
          }
          return (
            <LeafLink
              key={entry.id}
              leaf={entry}
              pathWithQuery={pathWithQuery}
              onNavigate={onNavigate}
            />
          )
        })}
      </div>
    </section>
  )
}

/** Dense overlay to the right of the desktop sidebar — all permitted leaves visible. */
export function AdminSupermenuOverlay() {
  const locale = useLocale() as Locale
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const tNav = useTranslations('navigation')
  const { hasVendor } = useVendorStatus()
  const state = useOptionalAdminSupermenuState()
  const { groups, dashboardItem, hasContent } = useAdminSupermenu(session?.user?.role, locale, {
    hasVendor,
  })
  const open = Boolean(state?.open && hasContent)
  const close = state?.close
  const headingRef = useRef<HTMLHeadingElement>(null)
  const pathWithQuery = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ''}`
  const panelDomId = 'admin-supermenu-panel'

  useEffect(() => {
    if (!open || !close) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close({ restoreFocus: true })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  // Close on route transitions (programmatic nav fallback).
  const prevPathRef = useRef(pathWithQuery)
  useEffect(() => {
    if (!state?.open) {
      prevPathRef.current = pathWithQuery
      return
    }
    if (prevPathRef.current !== pathWithQuery) {
      prevPathRef.current = pathWithQuery
      state.close({ restoreFocus: false })
    }
  }, [pathWithQuery, state])

  useEffect(() => {
    if (!open) return
    const id = window.requestAnimationFrame(() => {
      headingRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(id)
  }, [open])

  if (!state || !open || !close) return null

  const dashActive = dashboardItem ? leafIsActive(dashboardItem, pathWithQuery) : false
  const DashIcon = dashboardItem?.icon

  return (
    <div
      id={panelDomId}
      className="fixed inset-y-0 left-[var(--sidebar-total-w)] right-0 z-[60] hidden md:flex flex-col border-l border-border/40 bg-[hsl(var(--app-canvas))]/95 shadow-2xl"
      role="dialog"
      aria-modal="false"
      aria-labelledby="admin-supermenu-title"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-border/50 px-4 py-2.5">
        <h2
          id="admin-supermenu-title"
          ref={headingRef}
          tabIndex={-1}
          className="truncate text-base font-semibold tracking-tight outline-none"
        >
          {tNav('admin.label')}
        </h2>
        {dashboardItem && DashIcon && (
          <Link
            href={toAppHref(dashboardItem.href)}
            onClick={() => close({ restoreFocus: false })}
            title={dashboardItem.label}
            aria-label={dashboardItem.label}
            data-current={dashActive ? '' : undefined}
            className={cn(
              'inline-flex size-7 items-center justify-center rounded-md transition-colors',
              'hover:bg-foreground/5 data-current:bg-foreground/8',
              dashActive && 'text-primary',
            )}
          >
            <DashIcon className="size-4" strokeWidth={1.5} />
          </Link>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => close({ restoreFocus: true })}
          className="flex size-8 items-center justify-center rounded-full border border-border/60 bg-background/50 hover:bg-foreground/5"
          aria-label={tNav('close')}
        >
          <X className="size-4" strokeWidth={1.5} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:overflow-y-auto">
        <div
          className={cn(
            'grid gap-x-3 gap-y-4',
            'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
          )}
        >
          {groups.map((group) => (
            <GroupColumn
              key={group.id}
              group={group}
              pathWithQuery={pathWithQuery}
              onNavigate={() => close({ restoreFocus: false })}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/** Toggle row: label left, CircleEllipsis on the right — opens Admin supermenu. */
export function AdminSupermenuToggle({
  className,
  compact,
}: {
  className?: string
  /** Rail-sized control without label (icon only). */
  compact?: boolean
}) {
  const tNav = useTranslations('navigation')
  const { data: session } = useSession()
  const locale = useLocale() as Locale
  const { hasVendor } = useVendorStatus()
  const state = useOptionalAdminSupermenuState()
  const { hasContent, isMemberPlus } = useAdminSupermenu(session?.user?.role, locale, {
    hasVendor,
  })
  const panelDomId = 'admin-supermenu-panel'

  if (!state || !isMemberPlus || !hasContent) return null

  const active = state.open

  if (compact) {
    return (
      <button
        type="button"
        ref={state.toggleRef}
        onClick={state.toggle}
        data-current={active ? '' : undefined}
        className={cn(
          'sidebar-rail-link group relative z-[1] flex w-full items-center justify-center text-white hover:bg-white/10',
          'data-current:bg-[#333333] data-current:inset-ring-1 data-current:inset-ring-white/3',
          'h-9 min-h-9 max-h-9 border-0 bg-transparent cursor-pointer',
          className,
        )}
        title={tNav('admin.label')}
        aria-label={tNav('admin.label')}
        aria-expanded={active}
        aria-controls={panelDomId}
      >
        <CircleEllipsis className="size-[18px]" strokeWidth={1.5} />
      </button>
    )
  }

  return (
    <button
      type="button"
      ref={state.toggleRef}
      onClick={state.toggle}
      data-current={active ? '' : undefined}
      aria-expanded={active}
      aria-controls={panelDomId}
      className={cn(
        'sidebar-nav-item flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-lg px-2 text-[13px] font-medium transition-colors',
        'hover:bg-foreground/5 data-current:bg-foreground/8',
        className,
      )}
    >
      <span className="truncate">{tNav('admin.label')}</span>
      <CircleEllipsis
        className={cn('size-4.5 shrink-0 text-[var(--color-contrast-medium)]', active && 'text-primary')}
        strokeWidth={1.5}
      />
    </button>
  )
}

/**
 * Mobile Admin supermenu — grouped leaves above the bottom nav (z below nav).
 * Open state is owned by BottomNavigation (not desktop AdminSupermenuProvider).
 */
export function AdminSupermenuMobile({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const locale = useLocale() as Locale
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const tNav = useTranslations('navigation')
  const { hasVendor } = useVendorStatus()
  const { groups, dashboardItem, hasContent } = useAdminSupermenu(session?.user?.role, locale, {
    hasVendor,
  })
  const headingRef = useRef<HTMLHeadingElement>(null)
  const pathWithQuery = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ''}`
  const prevPathRef = useRef(pathWithQuery)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) {
      prevPathRef.current = pathWithQuery
      return
    }
    if (prevPathRef.current !== pathWithQuery) {
      prevPathRef.current = pathWithQuery
      onClose()
    }
  }, [pathWithQuery, open, onClose])

  useEffect(() => {
    if (!open) return
    const id = window.requestAnimationFrame(() => headingRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [open])

  if (!open || !hasContent) return null

  const dashActive = dashboardItem ? leafIsActive(dashboardItem, pathWithQuery) : false
  const DashIcon = dashboardItem?.icon

  return (
    <div
      id="admin-supermenu-mobile"
      className={cn(
        'fixed inset-x-0 top-0 z-[8990] flex flex-col md:hidden',
        'bottom-[var(--mobile-bottom-nav-h,calc(3.5rem+env(safe-area-inset-bottom,0px)))]',
        'border-b border-border/40 bg-[hsl(var(--app-canvas))]/95 shadow-2xl',
      )}
      role="dialog"
      aria-modal="false"
      aria-labelledby="admin-supermenu-mobile-title"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-border/50 px-3 py-2.5">
        <h2
          id="admin-supermenu-mobile-title"
          ref={headingRef}
          tabIndex={-1}
          className="truncate text-base font-semibold tracking-tight outline-none"
        >
          {tNav('admin.label')}
        </h2>
        {dashboardItem && DashIcon && (
          <Link
            href={toAppHref(dashboardItem.href)}
            onClick={onClose}
            title={dashboardItem.label}
            aria-label={dashboardItem.label}
            data-current={dashActive ? '' : undefined}
            className={cn(
              'inline-flex size-7 items-center justify-center rounded-md transition-colors',
              'hover:bg-foreground/5 data-current:bg-foreground/8',
              dashActive && 'text-primary',
            )}
          >
            <DashIcon className="size-4" strokeWidth={1.5} />
          </Link>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-full border border-border/60 bg-background/50 hover:bg-foreground/5"
          aria-label={tNav('close')}
        >
          <X className="size-4" strokeWidth={1.5} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <GroupColumn
              key={group.id}
              group={group}
              pathWithQuery={pathWithQuery}
              onNavigate={onClose}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
