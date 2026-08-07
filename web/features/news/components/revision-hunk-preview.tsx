'use client'

import {
  buildDiffLines,
  groupDiffLines,
  contentToDiffText,
  type DiffLine,
} from '@/features/news/lib/revision-diff'
import { cn } from '@/lib/utils'

type RevisionHunkPreviewProps = {
  baseContent: string
  proposedContent: string
  className?: string
  emptyLabel?: string
  /** amendment = green/red community revisions; version = cyan/gray author history */
  palette?: 'amendment' | 'version'
}

function LineRow({
  line,
  palette,
}: {
  line: DiffLine
  palette: 'amendment' | 'version'
}) {
  const version = palette === 'version'
  return (
    <div
      className={cn(
        'flex gap-2 rounded-sm px-2 py-0.5 font-mono text-xs leading-relaxed',
        line.kind === 'add' && (version ? 'bg-cyan-500/15' : 'bg-[#e8f4ec]'),
        line.kind === 'remove' && (version ? 'bg-muted/80' : 'bg-[#f5ecec]'),
        line.kind === 'equal' && 'bg-transparent text-muted-foreground',
      )}
    >
      <span
        className={cn(
          'w-4 shrink-0 select-none text-center font-semibold',
          line.kind === 'add' && (version ? 'text-cyan-700 dark:text-cyan-400' : 'text-green-700'),
          line.kind === 'remove' && (version ? 'text-muted-foreground' : 'text-red-700'),
        )}
      >
        {line.kind === 'add' ? '+' : line.kind === 'remove' ? '−' : ' '}
      </span>
      <span
        className={cn(
          'flex-1 whitespace-pre-wrap break-words',
          line.kind === 'remove' &&
            (version
              ? 'text-muted-foreground line-through opacity-80'
              : 'text-red-900/80 line-through opacity-85'),
          line.kind === 'add' && (version ? 'text-cyan-900 dark:text-cyan-100' : 'text-green-900'),
        )}
      >
        {line.text || ' '}
      </span>
    </div>
  )
}

/**
 * Hunk preview — amendment: pale green/red; version: cyan add / gray remove.
 */
export function RevisionHunkPreview({
  baseContent,
  proposedContent,
  className,
  emptyLabel = 'No textual differences detected.',
  palette = 'amendment',
}: RevisionHunkPreviewProps) {
  const lines = buildDiffLines(contentToDiffText(baseContent), contentToDiffText(proposedContent))
  const hunks = groupDiffLines(lines)

  if (!lines.length) {
    return (
      <p className="text-sm text-muted-foreground">{emptyLabel}</p>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      {hunks.map((hunk) => (
        <div
          key={hunk.id}
          className={cn(
            'overflow-hidden rounded-lg border p-2',
            palette === 'version' && hunk.hasAdd && hunk.hasRemove && 'border-cyan-300/50 bg-cyan-50/30 dark:bg-cyan-950/20',
            palette === 'version' && hunk.hasAdd && !hunk.hasRemove && 'border-cyan-200/80',
            palette === 'version' && hunk.hasRemove && !hunk.hasAdd && 'border-muted',
            palette === 'amendment' && hunk.hasAdd && hunk.hasRemove && 'border-amber-300/60 bg-amber-50/40',
            palette === 'amendment' && hunk.hasAdd && !hunk.hasRemove && 'border-green-200/80',
            palette === 'amendment' && hunk.hasRemove && !hunk.hasAdd && 'border-red-200/80',
          )}
        >
          {hunk.lines.map((line) => (
            <LineRow key={line.id} line={line} palette={palette} />
          ))}
        </div>
      ))}
    </div>
  )
}
