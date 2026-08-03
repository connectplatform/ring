'use client'

import { RevisionHunkPreview } from '@/features/news/components/revision-hunk-preview'
import type { ContentCommit } from '@/lib/versioning'
import { cn } from '@/lib/utils'

type ArticleVersionSliderProps = {
  commits: ContentCommit[]
  selectedIndex: number
  onSelect: (index: number) => void
  showDiff?: boolean
  className?: string
}

/**
 * Horizontal version slider — bind to commit index; optional cyan/gray adjacent diff.
 */
export function ArticleVersionSlider({
  commits,
  selectedIndex,
  onSelect,
  showDiff = true,
  className,
}: ArticleVersionSliderProps) {
  if (commits.length < 2) return null

  const max = commits.length - 1
  const safeIndex = Math.min(Math.max(0, selectedIndex), max)
  const commit = commits[safeIndex]
  const prev = safeIndex > 0 ? commits[safeIndex - 1] : null

  return (
    <div className={cn('space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          v{safeIndex + 1} of {commits.length}
          {commit?.createdAt ? (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              · {new Date(commit.createdAt).toLocaleString()}
            </span>
          ) : null}
        </p>
        {commit?.label ? (
          <span className="text-xs text-muted-foreground">{commit.label}</span>
        ) : null}
      </div>

      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={safeIndex}
        onChange={(e) => onSelect(Number(e.target.value))}
        className="w-full accent-cyan-600"
        aria-label="Article version"
      />

      {showDiff && prev && commit ? (
        <RevisionHunkPreview
          baseContent={prev.content}
          proposedContent={commit.content}
          palette="version"
          emptyLabel="No changes between these versions."
        />
      ) : null}
    </div>
  )
}
