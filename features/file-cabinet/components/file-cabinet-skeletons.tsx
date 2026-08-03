'use client'

import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

/** Fixed-height placeholders so rail widgets do not jump while loading. */
export function FileCabinetTrusteeRowSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex h-11 w-full items-center gap-2 rounded-lg border border-border/40 px-2',
        className,
      )}
      aria-hidden
    >
      <Skeleton className="h-3 w-14 shrink-0" />
      <div className="ml-auto flex items-center gap-1">
        <Skeleton className="h-7 w-7 rounded-full" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-7 w-7 rounded-full" />
        <Skeleton className="h-3 w-10" />
      </div>
    </div>
  )
}

export function FileCabinetOptionsActionsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex h-8 flex-wrap gap-1.5', className)} aria-hidden>
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-8 w-14" />
      <Skeleton className="h-8 w-16" />
    </div>
  )
}

export function FileCabinetInfoMetaSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden>
      <div className="grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-2">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-8" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  )
}

export function FileCabinetPreviewSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn('h-40 w-full rounded-md', className)} aria-hidden />
}
