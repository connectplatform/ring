'use client'

/**
 * Toolbar-friendly Sort By dropdown — same SortOption contract as FloatingSortButton.
 * Use in dense chrome (gallery / editor); keep FloatingSortButton for feed FABs.
 */

import { useCallback, useTransition } from 'react'
import { ArrowUpDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export type SortOption = {
  value: string
  label: string
}

export type SortByMenuProps = {
  currentSort: string
  onSortChange: (sortBy: string) => void
  options: SortOption[]
  /** Menu heading / trigger title */
  title?: string
  /** Compact trigger label when no current option match */
  triggerLabel?: string
  className?: string
  triggerClassName?: string
  align?: 'start' | 'center' | 'end'
  disabled?: boolean
}

/**
 * Shared option rows — FloatingSortButton desktop panel can reuse later.
 */
export function SortOptionsList({
  options,
  currentSort,
  onSelect,
  className,
}: {
  options: SortOption[]
  currentSort: string
  onSelect: (value: string) => void
  className?: string
}) {
  return (
    <div className={cn('space-y-0.5', className)}>
      {options.map((option) => {
        const active = currentSort === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            className={cn(
              'flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <span className="font-medium">{option.label}</span>
            {active ? <Check className="h-4 w-4 shrink-0" /> : null}
          </button>
        )
      })}
    </div>
  )
}

export function SortByMenu({
  currentSort,
  onSortChange,
  options,
  title = 'Sort by',
  triggerLabel = 'Sort',
  className,
  triggerClassName,
  align = 'end',
  disabled = false,
}: SortByMenuProps) {
  const [pending, startTransition] = useTransition()
  const current = options.find((o) => o.value === currentSort)
  const label = current?.label ?? triggerLabel

  const handleSelect = useCallback(
    (value: string) => {
      startTransition(() => onSortChange(value))
    },
    [onSortChange],
  )

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || pending}
          className={cn('h-9 gap-1.5 px-2.5', triggerClassName)}
          aria-label={title}
          title={title}
        >
          <ArrowUpDown className="h-4 w-4 shrink-0" />
          <span className="max-w-[9rem] truncate text-xs font-medium sm:text-sm">
            {label}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={cn('z-[9300] w-56', className)}>
        <DropdownMenuLabel className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <ArrowUpDown className="h-3.5 w-3.5" />
          {title}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => {
          const active = currentSort === option.value
          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => handleSelect(option.value)}
              className={cn(active && 'bg-accent')}
            >
              <span className="flex-1 font-medium">{option.label}</span>
              {active ? <Check className="h-4 w-4 shrink-0" /> : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
