'use client'

import * as React from 'react'
import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { FsModal } from '@/components/ui/fs-modal'
import { QuickSearchFilter } from '@/components/common/quick-search-filter'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Locked thick scrollbar width for davinci-droplist (SSOT). */
export const DAVINCI_DROPLIST_SCROLLBAR = 'w-3.5'

export type DavinciDroplistProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Localized noun for the modal title.
   * Title = `t('davinciDroplist.selectTitle', { scope: scopeLabel })`
   * e.g. scopeLabel from `t('davinciDroplist.scopes.country')` → "Select country".
   */
  scopeLabel: string
  /** Full title override — skips Select {scope} composition. */
  title?: string
  search: string
  onSearchChange: (value: string) => void
  filterPlaceholder?: string
  /** Shown when the list has no rows (caller decides empty). */
  emptyMessage?: string
  /** True when there are no filtered options to show. */
  empty?: boolean
  /** In-form trigger (Button combobox). Rendered outside the modal. */
  trigger: React.ReactNode
  children: React.ReactNode
  /** Optional footer inside the modal (e.g. clear selection). */
  footer?: React.ReactNode
  className?: string
  listClassName?: string
}

/**
 * Davinci-droplist — single-select FsModal picker (v1 close-on-tap).
 *
 * Mobile: full viewport W+H. sm+: full viewport height, keep `sm:max-w-lg`.
 * Z-index: FsModal `z-[9200]` above mobile menu / floating profile.
 */
export function DavinciDroplist({
  open,
  onOpenChange,
  scopeLabel,
  title,
  search,
  onSearchChange,
  filterPlaceholder,
  emptyMessage,
  empty = false,
  trigger,
  children,
  footer,
  className,
  listClassName,
}: DavinciDroplistProps) {
  const t = useTranslations('common.davinciDroplist')

  const modalTitle = title ?? t('selectTitle', { scope: scopeLabel })
  const filterPh = filterPlaceholder ?? t('filterPlaceholder')
  const emptyMsg = emptyMessage ?? t('noResults')

  const handleOpenChange = (next: boolean) => {
    if (!next) onSearchChange('')
    onOpenChange(next)
  }

  return (
    <>
      {trigger}
      <FsModal
        open={open}
        onOpenChange={handleOpenChange}
        title={modalTitle}
        hideHeaderSeparator
        className={cn(
          // iPad / sm+: full viewport height; keep max-w-lg card width
          'sm:h-[100dvh] sm:max-h-[100dvh]',
          className,
        )}
        contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden !p-0"
        footer={footer}
        footerClassName={footer ? 'border-t' : undefined}
      >
        <div className="shrink-0 px-4 pb-2 pt-1 sm:px-6">
          <QuickSearchFilter
            value={search}
            onChange={onSearchChange}
            placeholder={filterPh}
            autoFocus
            focusKey={open}
            aria-label={filterPh}
          />
        </div>
        <div className="min-h-0 flex-1">
          <ScrollArea
            className="h-full"
            scrollbarClassName={DAVINCI_DROPLIST_SCROLLBAR}
          >
            <div className={cn('px-2 pb-4 sm:px-3', listClassName)}>
              {empty ? (
                <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                  {emptyMsg}
                </p>
              ) : (
                children
              )}
            </div>
          </ScrollArea>
        </div>
      </FsModal>
    </>
  )
}

export type DavinciDroplistItemProps = {
  selected?: boolean
  onSelect: () => void
  children: React.ReactNode
  className?: string
  disabled?: boolean
}

/** Single-select row — tap selects and caller should close the modal. */
export function DavinciDroplistItem({
  selected = false,
  onSelect,
  children,
  className,
  disabled = false,
}: DavinciDroplistItemProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:bg-accent focus-visible:text-accent-foreground',
        'disabled:pointer-events-none disabled:opacity-50',
        selected && 'bg-accent',
        className,
      )}
    >
      <Check
        className={cn('h-4 w-4 shrink-0', selected ? 'opacity-100' : 'opacity-0')}
        aria-hidden
      />
      {children}
    </button>
  )
}

export type DavinciDroplistTriggerProps =
  React.ComponentPropsWithoutRef<typeof Button> & {
    open?: boolean
  }

/** Outline combobox trigger — shared look for form fields. */
export function DavinciDroplistTrigger({
  open = false,
  className,
  children,
  ...props
}: DavinciDroplistTriggerProps) {
  return (
    <Button
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={open}
      className={cn('h-11 w-full justify-between md:h-10', className)}
      {...props}
    >
      {children}
    </Button>
  )
}

export default DavinciDroplist
