'use client'

import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'

export type TrusteeChip = {
  id: string
  name: string
  image?: string | null
}

type Props = {
  trustees: TrusteeChip[]
  label: string
  onClick?: () => void
  className?: string
}

function firstName(full: string): string {
  const part = full.trim().split(/\s+/)[0]
  return part || full.slice(0, 8)
}

/**
 * Full-width tappable trustee row — up to 3 avatars with first names to the right.
 */
export function FileCabinetTrusteeStack({ trustees, label, onClick, className }: Props) {
  const shown = trustees.slice(0, 3)
  const extra = Math.max(0, trustees.length - 3)

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left',
        'border border-[color-mix(in_oklch,var(--davinci-beam)_22%,transparent)]',
        'bg-[color-mix(in_oklch,var(--davinci-beam)_6%,transparent)]',
        onClick && 'hover:bg-[color-mix(in_oklch,var(--davinci-beam)_12%,transparent)]',
        'transition-colors',
        !onClick && 'cursor-default',
        className,
      )}
    >
      <span className="shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      <span className="flex min-w-0 flex-1 items-center justify-end gap-1 overflow-hidden">
        {shown.map((u, i) => (
          <span
            key={u.id}
            className={cn(
              'inline-flex max-w-[5.5rem] items-center gap-1',
              i > 0 && '-ml-1',
            )}
            style={{ zIndex: shown.length - i }}
            title={u.name}
          >
            <Avatar
              src={u.image}
              alt={u.name}
              size="sm"
              fallback={u.name.slice(0, 2).toUpperCase()}
              className="shrink-0 ring-1 ring-[color-mix(in_oklch,var(--davinci-beam)_35%,transparent)]"
            />
            <span className="truncate text-xs font-medium text-foreground">
              {firstName(u.name)}
            </span>
          </span>
        ))}
        {extra > 0 ? (
          <span className="flex h-7 shrink-0 items-center rounded-full bg-muted px-1.5 text-[10px] font-semibold">
            +{extra}
          </span>
        ) : null}
      </span>
    </button>
  )
}
